import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { QUESTIONS_DB } from './src/data';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy GoogleGenAI client initialization
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// Persistent Server Audio Cache Directory
const CACHE_DIR = path.join(process.cwd(), 'server_cache', 'audio');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Clean text key with question mark formatting for choice questions
function cleanTtsText(text: string): string {
  let cleaned = text.replace(/\[신규\]/g, '').replace(/→/g, ' 그리고 ').replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/([가-힣]+(?:어요|아요|여요|에요|예요|나요|까요|지요|죠|있나요|없나요|됩니까|합니까)),(\s*)([가-힣]+)/g, '$1?$2$3');
  return cleaned;
}

// In-Memory index of cached audio
const serverTtsIndex = new Map<string, { filename: string; mimeType: string }>();

// Load existing cached files from disk on boot
try {
  const indexFilePath = path.join(CACHE_DIR, 'index.json');
  if (fs.existsSync(indexFilePath)) {
    const rawData = fs.readFileSync(indexFilePath, 'utf-8');
    const parsed = JSON.parse(rawData);
    for (const [key, val] of Object.entries(parsed)) {
      serverTtsIndex.set(key, val as any);
    }
  }
} catch (e) {
  console.warn('Failed to load TTS index from disk:', e);
}

function saveTtsIndex() {
  try {
    const indexFilePath = path.join(CACHE_DIR, 'index.json');
    const obj: Record<string, any> = {};
    serverTtsIndex.forEach((v, k) => {
      obj[k] = v;
    });
    fs.writeFileSync(indexFilePath, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save TTS index to disk:', e);
  }
}

// Helper: Fetch Google Text-to-Speech raw audio with retry and timeout
async function fetchGoogleTTSAudio(text: string, retries = 3): Promise<Buffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ko&client=tw-ob`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/',
          'Accept': '*/*'
        }
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Google TTS engine returned status ${res.status}`);
      }
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength < 200) {
        throw new Error('TTS buffer too small or truncated');
      }
      return Buffer.from(arrayBuf);
    } catch (err: any) {
      if (attempt === retries) {
        throw err;
      }
      console.warn(`[TTS Retry ${attempt}/${retries}] for "${text.substring(0, 20)}":`, err.message);
      await new Promise(r => setTimeout(r, 600 * attempt));
    }
  }
  throw new Error('Failed to fetch TTS audio after retries');
}

// Transform raw audio into distinct, clear, crisp male Korean interviewer voices
// Eliminates muffled rumbling / animal-like bass distortion by using highpass filtering, vocal presence EQ, and crisp pitch scaling
function processVoiceAudio(rawMp3Buffer: Buffer, voice: string): Buffer {
  const tmpId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const rawFile = `/tmp/raw_tts_${tmpId}.mp3`;
  const outFile = `/tmp/out_tts_${tmpId}.mp3`;

  try {
    fs.writeFileSync(rawFile, rawMp3Buffer);

    let filter = '';
    if (voice === 'Charon') {
      // 👨 AI 남성 2 (신뢰감 있는 면접관): 
      // 120Hz 이하의 저음 뭉침을 방지하고, 2.8kHz~3.5kHz 영역을 부스팅하여 발음(자음/모음)이 또렷하고 분명하게 들리는 남성 톤
      filter = 'highpass=f=120,asetrate=24000*0.89,atempo=1.12,equalizer=f=3000:width_type=o:width=1.0:g=3.5,equalizer=f=4500:width_type=o:width=1.0:g=2.0,volume=1.25,dynaudnorm=f=50:g=11';
    } else {
      // 👨 AI 남성 1 (차분하고 또렷한 면접관 - 기본):
      // 아주 자연스럽고 깨끗한 표준 남성 면접관 발화 톤
      filter = 'highpass=f=110,asetrate=24000*0.92,atempo=1.085,equalizer=f=3200:width_type=o:width=1.0:g=3.0,equalizer=f=1500:width_type=o:width=1.0:g=1.5,volume=1.20,dynaudnorm=f=50:g=11';
    }

    execSync(`ffmpeg -y -i ${rawFile} -filter:a "${filter}" -b:a 96k ${outFile}`, { stdio: 'ignore' });
    const processedBuffer = fs.readFileSync(outFile);
    return processedBuffer;
  } catch (e: any) {
    console.warn('FFmpeg voice processing fallback:', e.message);
    return rawMp3Buffer;
  } finally {
    try {
      if (fs.existsSync(rawFile)) fs.unlinkSync(rawFile);
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    } catch (_) {}
  }
}

app.post('/api/generate-questions', async (req, res) => {
  try {
    const { count = 5 } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
    }

    const prompt = `당신은 HD현대삼호 외국인 근로자 기량평가의 한국어 면접관입니다.
면접은 현재 근로자의 고향(해외 현지)에서 진행 중이며, 이들은 한국에 가고 싶어하는 지원자들입니다.
한국에서의 생활 경험을 묻는 질문은 제외하세요. (예: "한국 음식 먹어봤어요?" 등은 제외)
대신, 한국 생활에 대한 기대, 일상적인 기초 회화, 그리고 제조업 현장에서의 간단한 대처(중급 회화)를 적절히 섞어주세요.
난이도는 한국어능력시험(TOPIK) 1급 수준으로 아주 쉽고 명확하게 질문해 주세요.
반드시 각 질문은 한 줄로 작성하되, 하나의 핵심 질문 뒤에 꼬리 질문을 '→' 로 이어주세요.
질문 앞에는 "[신규]" 라는 말머리를 꼭 붙여주세요.
[중요]: 둘 중 하나를 고르는 양자 택일 형태의 질문(예: ~했어요? ~했어요?, ~좋아요? ~좋아요?, 첫째예요? 막내예요?)은 중간 쉼표(,) 대신 반드시 물음표(?)를 각각 넣어주세요. (예: '버스를 탔어요? 걸어왔어요?', '첫째예요? 막내예요?')

예시:
[신규] 오늘 아침에 몇 시에 일어났어요? → 일어나서 제일 먼저 무엇을 했어요?
[신규] 오늘 면접장에 올 때 버스를 탔어요? 걸어왔어요? → 오는데 시간이 얼마나 걸렸어요?
[신규] 용접을 할 때 제일 중요한 것이 무엇이라고 생각해요? → 불이 나면 어떻게 해요?

총 ${count}개의 질문만 반환해주세요.`;

    let response;
    let retries = 3;
    let delay = 2000;
    const aiInstance = getAI();
    while (retries > 0) {
      try {
        response = await aiInstance.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
        });
        break; // Success
      } catch (err: any) {
        console.warn(`Attempt failed (${retries} left), retrying in ${delay}ms...`, err.message);
        retries--;
        if (retries === 0) throw err;
        await new Promise(r => setTimeout(r, delay));
        delay *= 2; // Exponential backoff
      }
    }

    const text = response.text || '';
    const questions = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.startsWith('[신규]'));

    res.json({ questions });
  } catch (error: any) {
    console.error('Error generating questions:', error);
    res.status(500).json({ error: error.message || 'Failed to generate questions' });
  }
});

// TTS Synthesis & Persistent Audio Cache Handler (Male Interviewers Only)
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'Fenrir' } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text parameter is required.' });
    }

    // Clean text key with question mark formatting for choice questions
    const cleanKey = cleanTtsText(text);
    
    // Normalize voice selection to Male voices:
    // 'Fenrir': 👨 AI 남성 1 (차분하고 또렷한 면접관 - 기본)
    // 'Charon': 👨 AI 남성 2 (신뢰감 있는 면접관)
    let validVoice = 'Fenrir';
    if (voice === 'Charon') {
      validVoice = 'Charon';
    } else {
      validVoice = 'Fenrir';
    }
    
    // Versioned hash key for audio caching
    const cacheVersion = 'v3_crisp_male';
    const hash = crypto.createHash('sha256').update(`${cacheVersion}:::${validVoice}:::${cleanKey}`).digest('hex').substring(0, 24);
    const cacheKey = `${cacheVersion}_${validVoice}_${cleanKey}`;

    // 1. Check if audio is already saved on server disk
    if (serverTtsIndex.has(cacheKey)) {
      const info = serverTtsIndex.get(cacheKey)!;
      const filePath = path.join(CACHE_DIR, info.filename);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        return res.json({
          audioBase64: fileBuffer.toString('base64'),
          mimeType: info.mimeType,
          cached: true,
          source: 'server_disk'
        });
      }
    }

    // Check direct file existence by hash
    const possibleMp3 = path.join(CACHE_DIR, `${hash}.mp3`);
    if (fs.existsSync(possibleMp3)) {
      const fileBuffer = fs.readFileSync(possibleMp3);
      serverTtsIndex.set(cacheKey, { filename: `${hash}.mp3`, mimeType: 'audio/mpeg' });
      saveTtsIndex();
      return res.json({
        audioBase64: fileBuffer.toString('base64'),
        mimeType: 'audio/mpeg',
        cached: true,
        source: 'server_disk'
      });
    }

    // 2. Generate crisp, high-definition male voice audio
    let finalBuffer: Buffer | null = null;
    const rawAudioBuffer = await fetchGoogleTTSAudio(cleanKey);
    finalBuffer = processVoiceAudio(rawAudioBuffer, validVoice);

    if (!finalBuffer) {
      return res.status(500).json({ error: '음성 생성에 실패했습니다.' });
    }

    // 3. Save permanently to server disk cache
    const targetFilename = `${hash}.mp3`;
    const targetFilePath = path.join(CACHE_DIR, targetFilename);
    fs.writeFileSync(targetFilePath, finalBuffer);

    // Update index & save
    serverTtsIndex.set(cacheKey, { filename: targetFilename, mimeType: 'audio/mpeg' });
    saveTtsIndex();

    console.log(`[TTS Generated] Voice: ${validVoice} | Text: "${cleanKey.substring(0, 25)}..." -> ${targetFilename}`);

    // 4. Return audio to client
    return res.json({
      audioBase64: finalBuffer.toString('base64'),
      mimeType: 'audio/mpeg',
      cached: false,
      savedOnServer: true
    });

  } catch (error: any) {
    console.error('Error generating TTS:', error);
    res.status(500).json({ error: error.message || '음성 처리에 실패했습니다.' });
  }
});

async function ensureAudioCached(text: string, voice = 'Fenrir'): Promise<boolean> {
  try {
    const cleanKey = cleanTtsText(text);
    if (!cleanKey) return false;

    const cacheVersion = 'v3_crisp_male';
    const hash = crypto.createHash('sha256').update(`${cacheVersion}:::${voice}:::${cleanKey}`).digest('hex').substring(0, 24);
    const cacheKey = `${cacheVersion}_${voice}_${cleanKey}`;

    if (serverTtsIndex.has(cacheKey)) {
      const info = serverTtsIndex.get(cacheKey)!;
      if (fs.existsSync(path.join(CACHE_DIR, info.filename))) return true;
    }

    const possibleMp3 = path.join(CACHE_DIR, `${hash}.mp3`);
    if (fs.existsSync(possibleMp3)) {
      serverTtsIndex.set(cacheKey, { filename: `${hash}.mp3`, mimeType: 'audio/mpeg' });
      saveTtsIndex();
      return true;
    }

    const rawBuffer = await fetchGoogleTTSAudio(cleanKey);
    const finalBuffer = processVoiceAudio(rawBuffer, voice);
    const targetFilename = `${hash}.mp3`;
    fs.writeFileSync(path.join(CACHE_DIR, targetFilename), finalBuffer);
    serverTtsIndex.set(cacheKey, { filename: targetFilename, mimeType: 'audio/mpeg' });
    saveTtsIndex();
    return true;
  } catch (e: any) {
    console.warn(`[Prewarm failed] for "${text.substring(0, 20)}":`, e.message);
    return false;
  }
}

// Background audio warmup for all questions in database
async function startAudioWarmup() {
  try {
    console.log('[TTS Pre-warm] Starting background audio pre-caching for all question sets...');
    const allQuestions: string[] = [];
    for (const set of QUESTIONS_DB) {
      for (const q of set) {
        if (!allQuestions.includes(q)) allQuestions.push(q);
      }
    }

    // Pre-warm primarily for Fenrir (default) and Charon
    for (const q of allQuestions) {
      await ensureAudioCached(q, 'Fenrir');
      await new Promise(r => setTimeout(r, 80)); // polite throttle
    }
    console.log(`[TTS Pre-warm] Completed caching for Fenrir (${serverTtsIndex.size} total audios ready).`);
  } catch (err: any) {
    console.warn('[TTS Pre-warm] Background warmup encountered error (continuing normally):', err?.message || err);
  }
}

// TTS Cache Status API (for monitoring)
app.get('/api/tts/stats', (req, res) => {
  res.json({
    totalCachedAudios: serverTtsIndex.size,
    cacheDir: CACHE_DIR,
    files: Array.from(serverTtsIndex.entries()).map(([k, v]) => ({ key: k, ...v }))
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Start non-blocking warmup in background
    setTimeout(startAudioWarmup, 1000);
  });
}

startServer();

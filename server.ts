import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Persistent Server Audio Cache Directory
const CACHE_DIR = path.join(process.cwd(), 'server_cache', 'audio');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
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

// Helper: Convert PCM to standard WAV buffer
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1): Buffer {
  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // Linear PCM
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * numChannels * 2, 28);
  wavHeader.writeUInt16LE(numChannels * 2, 32);
  wavHeader.writeUInt16LE(16, 34); // 16-bit
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([wavHeader, pcmBuffer]);
}

// Helper: Fetch Google Text-to-Speech API as high-reliability fallback
async function fetchGoogleTTSAudio(text: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ko&client=tw-ob`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; AppleWebKit/537.36) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/'
    }
  });
  if (!res.ok) {
    throw new Error(`Google TTS engine returned status ${res.status}`);
  }
  const arrayBuf = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuf),
    mimeType: 'audio/mpeg'
  };
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

예시:
[신규] 오늘 아침에 몇 시에 일어났어요? → 일어나서 제일 먼저 무엇을 했어요?
[신규] 고향에서 가장 유명한 것은 무엇인가요? → 왜 그것이 유명해요?
[신규] 용접을 할 때 제일 중요한 것이 무엇이라고 생각해요? → 불이 나면 어떻게 해요?

총 ${count}개의 질문만 반환해주세요.`;

    let response;
    let retries = 3;
    let delay = 2000;
    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
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

// TTS Synthesis & Persistent Audio Cache Handler
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'Puck' } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text parameter is required.' });
    }

    // Clean text key
    const cleanKey = text.replace(/\[신규\]/g, '').replace(/→/g, ' 그리고 ').replace(/\s+/g, ' ').trim();
    const validVoice = ['Puck', 'Fenrir', 'Charon', 'Aoede', 'Kore'].includes(voice) ? voice : 'Puck';
    
    // Generate unique hash key for this text and voice
    const hash = crypto.createHash('sha256').update(`${validVoice}:::${cleanKey}`).digest('hex').substring(0, 24);
    const cacheKey = `${validVoice}_${cleanKey}`;

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
    const possibleWav = path.join(CACHE_DIR, `${hash}.wav`);
    const possibleMp3 = path.join(CACHE_DIR, `${hash}.mp3`);
    if (fs.existsSync(possibleWav)) {
      const fileBuffer = fs.readFileSync(possibleWav);
      serverTtsIndex.set(cacheKey, { filename: `${hash}.wav`, mimeType: 'audio/wav' });
      saveTtsIndex();
      return res.json({
        audioBase64: fileBuffer.toString('base64'),
        mimeType: 'audio/wav',
        cached: true,
        source: 'server_disk'
      });
    } else if (fs.existsSync(possibleMp3)) {
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

    // 2. Generate Audio (First attempt: Gemini AI Voice; Fallback: Google Voice)
    let finalBuffer: Buffer | null = null;
    let finalMimeType = 'audio/wav';
    let fileExt = 'wav';

    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: [{ parts: [{ text: cleanKey }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: validVoice }
              }
            }
          }
        } as any);

        const inlineData = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData && inlineData.data) {
          const rawBase64 = inlineData.data;
          const rawMime = inlineData.mimeType || 'audio/l16';
          
          if (rawMime.includes('audio/l16') || rawMime.includes('audio/pcm')) {
            const pcmBuffer = Buffer.from(rawBase64, 'base64');
            finalBuffer = pcmToWav(pcmBuffer, 24000, 1);
            finalMimeType = 'audio/wav';
            fileExt = 'wav';
          } else {
            finalBuffer = Buffer.from(rawBase64, 'base64');
            finalMimeType = rawMime;
            fileExt = rawMime.includes('mp3') ? 'mp3' : 'wav';
          }
        }
      } catch (geminiErr: any) {
        console.warn('Gemini TTS synthesis attempt failed or quota reached, switching to high-quality fallback engine:', geminiErr.message);
      }
    }

    // If Gemini TTS was not available or failed, use Google Voice TTS fallback
    if (!finalBuffer) {
      try {
        const googleAudio = await fetchGoogleTTSAudio(cleanKey);
        finalBuffer = googleAudio.buffer;
        finalMimeType = googleAudio.mimeType;
        fileExt = 'mp3';
      } catch (fallbackErr: any) {
        console.error('All TTS engines failed:', fallbackErr);
        return res.status(500).json({ error: '음성 합성 생성에 실패했습니다.' });
      }
    }

    // 3. Save permanently to server disk cache
    const targetFilename = `${hash}.${fileExt}`;
    const targetFilePath = path.join(CACHE_DIR, targetFilename);
    fs.writeFileSync(targetFilePath, finalBuffer);

    // Update index & save
    serverTtsIndex.set(cacheKey, { filename: targetFilename, mimeType: finalMimeType });
    saveTtsIndex();

    console.log(`[TTS Cache Saved] Voice: ${validVoice} | Text: "${cleanKey.substring(0, 20)}..." | Size: ${finalBuffer.length} bytes -> ${targetFilename}`);

    // 4. Return audio to client
    return res.json({
      audioBase64: finalBuffer.toString('base64'),
      mimeType: finalMimeType,
      cached: false,
      savedOnServer: true
    });

  } catch (error: any) {
    console.error('Error generating TTS:', error);
    res.status(500).json({ error: error.message || '음성 처리에 실패했습니다.' });
  }
});

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
  });
}

startServer();


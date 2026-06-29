import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });
    } catch (err: any) {
      console.warn('First attempt failed, retrying with gemini-3.1-pro-preview...', err.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });
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

app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
    }

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
              voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' }
              }
          }
        }
      } as any);
    } catch (err: any) {
      console.warn('First TTS attempt failed, retrying...', err.message);
      // simple 1s delay
      await new Promise(r => setTimeout(r, 1000));
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
              voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' }
              }
          }
        }
      } as any);
    }

    let audioBase64 = null;
    let mimeType = 'audio/wav'; // default
    if (response && response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0] && response.candidates[0].content.parts[0].inlineData) {
      audioBase64 = response.candidates[0].content.parts[0].inlineData.data;
      if (response.candidates[0].content.parts[0].inlineData.mimeType) {
        mimeType = response.candidates[0].content.parts[0].inlineData.mimeType;
      }
    }

    if (audioBase64) {
      res.json({ audioBase64, mimeType });
    } else {
      res.status(500).json({ error: 'Failed to generate audio output from model.' });
    }
  } catch (error: any) {
    console.error('Error generating TTS:', error);
    res.status(500).json({ error: error.message || 'Failed to generate TTS' });
  }
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

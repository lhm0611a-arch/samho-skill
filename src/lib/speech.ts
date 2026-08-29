// High-Fidelity AI Voice TTS Engine (Male Interviewer Dedicated)
// Uses High-Definition Audio TTS with persistent server disk caching and male-only fallback safety.

const audioCache = new Map<string, HTMLAudioElement>();

let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;

// Male AI Interviewer Voices:
// 'Fenrir': 👨 AI 남성 1 (차분하고 또렷한 면접관 - 기본)
// 'Charon': 👨 AI 남성 2 (신뢰감 있는 면접관)
export type TTSVoiceType = 'Fenrir' | 'Charon';

let currentVoice: TTSVoiceType = typeof window !== 'undefined' 
  ? (() => {
      const saved = localStorage.getItem('hd_tts_voice');
      if (saved === 'Charon' || saved === 'Fenrir') return saved;
      return 'Fenrir';
    })()
  : 'Fenrir';

export function setTTSVoice(voice: TTSVoiceType | string) {
  let normalized: TTSVoiceType = 'Fenrir';
  if (voice === 'Charon') normalized = 'Charon';
  else normalized = 'Fenrir';

  currentVoice = normalized;
  if (typeof window !== 'undefined') {
    localStorage.setItem('hd_tts_voice', normalized);
  }
}

export function getTTSVoice(): TTSVoiceType {
  return currentVoice;
}

// Get best Korean MALE voice available in the browser (strictly prioritizing male voices)
function getKoreanMaleVoice(): { voice: SpeechSynthesisVoice | null; isExplicitMale: boolean } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { voice: null, isExplicitMale: false };
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return { voice: null, isExplicitMale: false };
  }
  
  // 1. Look specifically for explicit Male Korean voices in Windows, Mac, Android, Chrome, Edge, iOS
  const maleKeywords = [
    'male', '남성', 'injoon', 'bongjin', 'minho', 'gihun', 'hyun', 
    'jungho', 'seung', 'young', 'dong', 'chul', 'dae', 'kyu', 'nam'
  ];
  
  const maleKo = voices.find(v => 
    v.lang.startsWith('ko') && maleKeywords.some(kw => v.name.toLowerCase().includes(kw))
  );
  if (maleKo) return { voice: maleKo, isExplicitMale: true };

  // 2. Filter out explicit female voices (Heami, Yuna, SunHi, 여성, female, Jinho female etc.)
  const femaleKeywords = ['female', '여성', 'heami', 'yuna', 'sunhi', 'seoyeon', 'minsu_f', 'hana', 'jiyeon'];
  const nonFemaleKo = voices.find(v => 
    v.lang.startsWith('ko') && !femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
  );
  if (nonFemaleKo) return { voice: nonFemaleKo, isExplicitMale: false };

  // 3. Fallback to any Korean voice if none found
  const anyKo = voices.find(v => v.lang.startsWith('ko'));
  return { voice: anyKo || null, isExplicitMale: false };
}

// Pre-load speech synthesis voices
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    getKoreanMaleVoice();
  };
}

/**
 * Stop any ongoing TTS audio immediately
 */
export function stopTTS() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = '';
    } catch (_) {}
    currentAudio = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    currentUtterance = null;
  }
}

/**
 * Fetch server TTS with retry logic to avoid unnecessary fallback to browser speech
 */
async function fetchServerTTSAudio(text: string, voice: TTSVoiceType, signal: AbortSignal, maxRetries = 2): Promise<any> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal.aborted) throw new Error('AbortError');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
        signal
      });
      if (!res.ok) {
        throw new Error(`Server TTS returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data?.audioBase64) {
        return data;
      }
      throw new Error('No audio data returned from server');
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError' || signal.aborted) throw err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Speak text with clear, crisp, natural Korean voice
 */
export function speakText(
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err?: any) => void;
  },
  voiceOverride?: TTSVoiceType
): () => void {
  // Stop previous playback
  stopTTS();

  const voiceTarget = voiceOverride || currentVoice;

  // Clean text: remove [신규] tags and format arrows
  const cleanText = text
    .replace(/\[신규\]/g, '')
    .replace(/→/g, ' 그리고 ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) {
    callbacks?.onEnd?.();
    return () => {};
  }

  let cancelled = false;
  const cacheKey = `v3_${voiceTarget}_${cleanText}`;

  // 1. Check client-side audio memory cache first
  if (audioCache.has(cacheKey)) {
    const cachedAudio = audioCache.get(cacheKey)!;
    cachedAudio.currentTime = 0;
    currentAudio = cachedAudio;

    cachedAudio.onplay = () => {
      if (!cancelled) callbacks?.onStart?.();
    };
    cachedAudio.onended = () => {
      currentAudio = null;
      if (!cancelled) callbacks?.onEnd?.();
    };
    cachedAudio.onerror = (e) => {
      console.warn('Cached audio playback failed, trying server refetch:', e);
      currentAudio = null;
      if (!cancelled) playFallbackBrowserSpeech(cleanText, callbacks, voiceTarget);
    };

    cachedAudio.play().catch(e => {
      console.warn('Cached audio play promise rejected, trying Web Speech fallback:', e);
      if (!cancelled) playFallbackBrowserSpeech(cleanText, callbacks, voiceTarget);
    });

    return () => {
      cancelled = true;
      stopTTS();
    };
  }

  // 2. Fetch from backend TTS endpoint (persisted server audio) with retry
  const fetchController = new AbortController();

  fetchServerTTSAudio(cleanText, voiceTarget, fetchController.signal)
    .then((data) => {
      if (cancelled) return;

      if (data?.audioBase64) {
        const audioSrc = `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`;
        const audio = new Audio(audioSrc);
        audio.preload = 'auto';

        audio.onplay = () => {
          if (!cancelled) callbacks?.onStart?.();
        };

        audio.onended = () => {
          currentAudio = null;
          if (!cancelled) callbacks?.onEnd?.();
        };

        audio.onerror = (e) => {
          console.warn('Audio playback error, falling back to Web Speech:', e);
          currentAudio = null;
          if (!cancelled) playFallbackBrowserSpeech(cleanText, callbacks, voiceTarget);
        };

        // Cache in client memory
        audioCache.set(cacheKey, audio);
        currentAudio = audio;

        audio.play().catch(err => {
          console.warn('Audio play() rejected, trying Web Speech fallback:', err);
          if (!cancelled) playFallbackBrowserSpeech(cleanText, callbacks, voiceTarget);
        });
      } else {
        throw new Error('No audio data received from server');
      }
    })
    .catch((err) => {
      if (cancelled) return;
      if (err.name !== 'AbortError') {
        console.warn('Server TTS failed, using low-pitch male browser speech fallback:', err);
        playFallbackBrowserSpeech(cleanText, callbacks, voiceTarget);
      }
    });

  return () => {
    cancelled = true;
    fetchController.abort();
    stopTTS();
  };
}

/**
 * Fallback to browser Web Speech API with deep, low pitch to strictly preserve male interviewer tone
 */
function playFallbackBrowserSpeech(
  cleanText: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err?: any) => void;
  },
  voiceTarget: TTSVoiceType = currentVoice
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks?.onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ko-KR';
    
    const { voice, isExplicitMale } = getKoreanMaleVoice();
    if (voice) {
      utterance.voice = voice;
    }

    // If explicit male voice is found: standard natural pitch
    // If only generic/female voice is available: significantly lower the pitch (0.68~0.75) to prevent high-pitched female robot sound
    if (isExplicitMale) {
      utterance.rate = voiceTarget === 'Fenrir' ? 0.95 : 0.92;
      utterance.pitch = voiceTarget === 'Fenrir' ? 0.92 : 0.85;
    } else {
      // Deep pitch filter for fallback to simulate a calm male interviewer voice
      utterance.rate = 0.90;
      utterance.pitch = voiceTarget === 'Fenrir' ? 0.72 : 0.65;
    }

    utterance.onstart = () => {
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      currentUtterance = null;
      callbacks?.onEnd?.();
    };

    utterance.onerror = (e) => {
      currentUtterance = null;
      callbacks?.onError?.(e);
      callbacks?.onEnd?.();
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('Speech synthesis fallback failed:', e);
    callbacks?.onEnd?.();
  }
}

/**
 * Preload question audio in the background
 */
export function preloadTTS(text: string, voice?: TTSVoiceType) {
  const targetVoice = voice || currentVoice;
  const cleanText = text.replace(/\[신규\]/g, '').replace(/→/g, ' 그리고 ').replace(/\s+/g, ' ').trim();
  const cacheKey = `v3_${targetVoice}_${cleanText}`;
  
  if (audioCache.has(cacheKey)) return;

  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleanText, voice: targetVoice })
  })
    .then(r => r.json())
    .then(data => {
      if (data?.audioBase64) {
        const audio = new Audio(`data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`);
        audio.preload = 'auto';
        audioCache.set(cacheKey, audio);
      }
    })
    .catch(() => {});
}

/**
 * Stop any current speech
 */
export function stopSpeech() {
  stopTTS();
}

export const playTTS = speakText;

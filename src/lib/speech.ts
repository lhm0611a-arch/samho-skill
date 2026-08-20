// High-Fidelity AI Human Voice TTS Engine
// Uses Google Gemini AI Audio TTS as primary with persistent server disk caching and high-quality fallback.

const audioCache = new Map<string, HTMLAudioElement>();

let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;

// Stored preferred AI voice: 'Puck' (친절하고 또렷한 남성 AI - 기본), 'Fenrir' (신뢰감 있는 중후한 남성 AI), 'Aoede' (자연스러운 여성 AI), 'Kore' (차분한 여성 AI)
let currentVoice: string = typeof window !== 'undefined' ? (localStorage.getItem('hd_tts_voice') || 'Puck') : 'Puck';

export function setTTSVoice(voice: 'Puck' | 'Fenrir' | 'Aoede' | 'Kore') {
  currentVoice = voice;
  if (typeof window !== 'undefined') {
    localStorage.setItem('hd_tts_voice', voice);
  }
}

export function getTTSVoice(): string {
  return currentVoice;
}

// Get best Korean voice available in the browser (for offline fallback)
function getKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  
  // Prefer Korean Male voice if available for male profile
  const isMaleSelected = currentVoice === 'Puck' || currentVoice === 'Fenrir';
  if (isMaleSelected) {
    const maleKo = voices.find(v => 
      v.lang.startsWith('ko') && (
        v.name.includes('Male') ||
        v.name.includes('남성') ||
        v.name.includes('InJoon') ||
        v.name.includes('BongJin') ||
        v.name.includes('MinHo') ||
        v.name.includes('Gihun')
      )
    );
    if (maleKo) return maleKo;
  }

  const preferredKo = voices.find(v => 
    v.lang.startsWith('ko') && (
      v.name.includes('Google') || 
      v.name.includes('Natural') || 
      v.name.includes('Online') || 
      v.name.includes('Premium') ||
      v.name.includes('Sun-Hi') ||
      v.name.includes('Heami') ||
      v.name.includes('Yuna')
    )
  );
  if (preferredKo) return preferredKo;

  const anyKo = voices.find(v => v.lang.startsWith('ko') || v.lang.includes('KR'));
  if (anyKo) return anyKo;

  return null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    getKoreanVoice();
  };
}

/**
 * Play text using High-Fidelity AI Human Voice (Google / Gemini TTS).
 * Uses server-cached audio (0 tokens on repeat/cross-device playback).
 * Falls back to browser Web Speech API if server TTS is unreachable.
 */
export function playTTS(
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err?: any) => void;
  },
  voiceOption?: 'Puck' | 'Fenrir' | 'Aoede' | 'Kore'
): () => void {
  const cleanText = text.replace(/\[신규\]/g, '').replace(/→/g, ' 그리고 ').trim();
  if (!cleanText) {
    callbacks?.onEnd?.();
    return () => {};
  }

  // Stop any currently playing audio/speech
  stopTTS();

  const voiceToUse = voiceOption || currentVoice || 'Puck';
  const cacheKey = `${voiceToUse}_${cleanText}`;

  // 1. Primary: Cached High-Fidelity Audio in Client Memory
  if (audioCache.has(cacheKey)) {
    try {
      const cachedAudio = audioCache.get(cacheKey)!;
      cachedAudio.currentTime = 0;
      currentAudio = cachedAudio;
      callbacks?.onStart?.();
      cachedAudio.onended = () => {
        currentAudio = null;
        callbacks?.onEnd?.();
      };
      cachedAudio.onerror = () => {
        currentAudio = null;
        callbacks?.onError?.();
      };
      cachedAudio.play().catch(() => {
        playFallbackBrowserSpeech(cleanText, callbacks);
      });
      return () => stopTTS();
    } catch (e) {
      console.warn('Cached audio playback failed, fetching fresh audio', e);
    }
  }

  // 2. Fetch High-Fidelity AI Voice from Server (which serves from persistent disk cache or synthesizes once)
  callbacks?.onStart?.();
  let cancelled = false;

  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleanText, voice: voiceToUse })
  })
    .then(async (res) => {
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (cancelled) return;
      if (data.audioBase64) {
        const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
        audioCache.set(cacheKey, audio);
        currentAudio = audio;
        audio.onended = () => {
          currentAudio = null;
          callbacks?.onEnd?.();
        };
        audio.onerror = () => {
          currentAudio = null;
          playFallbackBrowserSpeech(cleanText, callbacks);
        };
        audio.play().catch(() => {
          playFallbackBrowserSpeech(cleanText, callbacks);
        });
      } else {
        throw new Error(data.error || '음성 생성 응답 없음');
      }
    })
    .catch(err => {
      if (cancelled) return;
      console.warn('Server TTS unavailable, falling back to browser speech:', err.message);
      playFallbackBrowserSpeech(cleanText, callbacks);
    });

  return () => {
    cancelled = true;
    stopTTS();
  };
}

/**
 * Fallback to browser Web Speech API with optimized parameters
 */
function playFallbackBrowserSpeech(
  cleanText: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err?: any) => void;
  }
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks?.onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ko-KR';
    
    // Set pitch & rate for natural male tone
    const isMale = currentVoice === 'Puck' || currentVoice === 'Fenrir';
    utterance.rate = 0.95;
    utterance.pitch = isMale ? 0.95 : 1.1;

    const koVoice = getKoreanVoice();
    if (koVoice) {
      utterance.voice = koVoice;
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
 * Stop currently playing TTS audio immediately
 */
export function stopTTS() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
  }
  currentUtterance = null;
}

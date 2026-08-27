// High-Fidelity AI Voice TTS Engine (Male Interviewer Dedicated)
// Uses High-Definition Audio TTS with persistent server disk caching and high-quality fallback.

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

// Get best Korean male voice available in the browser (for offline fallback)
function getKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  
  // Look specifically for Male Korean voices in Windows, Mac, Android, iOS
  const maleKo = voices.find(v => 
    v.lang.startsWith('ko') && (
      v.name.toLowerCase().includes('male') ||
      v.name.includes('남성') ||
      v.name.includes('InJoon') ||
      v.name.includes('BongJin') ||
      v.name.includes('MinHo') ||
      v.name.includes('Gihun') ||
      v.name.includes('Hyun')
    )
  );
  if (maleKo) return maleKo;

  // Fallback to any Korean voice
  const anyKo = voices.find(v => v.lang.startsWith('ko'));
  if (anyKo) return anyKo;

  return null;
}

// Pre-load speech synthesis voices
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    getKoreanVoice();
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
      console.warn('Cached audio playback failed, falling back:', e);
      currentAudio = null;
      if (!cancelled) playFallbackBrowserSpeech(cleanText, callbacks, voiceTarget);
    };

    cachedAudio.play().catch(e => {
      console.warn('Cached audio play promise rejected, using fallback:', e);
      if (!cancelled) playFallbackBrowserSpeech(cleanText, callbacks, voiceTarget);
    });

    return () => {
      cancelled = true;
      stopTTS();
    };
  }

  // 2. Fetch from backend TTS endpoint (persisted server audio)
  const fetchController = new AbortController();

  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleanText, voice: voiceTarget }),
    signal: fetchController.signal
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Server TTS returned HTTP ${res.status}`);
      }
      return res.json();
    })
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
        console.warn('Server TTS failed, falling back to browser speech:', err);
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
 * Fallback to browser Web Speech API with clean, natural male pronunciation
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
    
    // Male voice settings: articulate tempo and clean pitch
    utterance.rate = voiceTarget === 'Fenrir' ? 0.95 : 0.92;
    utterance.pitch = voiceTarget === 'Fenrir' ? 0.94 : 0.88; 

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
 * Stop any current speech
 */
export function stopSpeech() {
  stopTTS();
}

export const playTTS = speakText;

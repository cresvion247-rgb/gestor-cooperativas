import { useEffect, useRef, useState } from 'react';

const SPEECH_DELAY_MS = 2500;

const cleanForSpeech = (text) => String(text || '')
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/[#*`_\[\]|]/g, ' ')
  .replace(/^\s*[-•]\s*/gm, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 1200);

const messageKey = (m, index) => m.id || `idx-${index}`;

const LANG_BCP47 = { es: 'es-ES', en: 'en-US', fr: 'fr-FR', eu: 'eu-ES' };

/**
 * Speak text via browser SpeechSynthesis (Phase 4 client equivalent).
 * Base44 concierge_hablar / Core.GenerateSpeech removed from live path.
 * Full neural TTS remains a checklist item (Edge Function stub exists).
 */
function speakWithBrowserTts(text, lang, { onEnd, onError }) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onError?.();
    return null;
  }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_BCP47[lang] || lang || 'es-ES';
    u.onend = () => onEnd?.();
    u.onerror = () => onError?.();
    window.speechSynthesis.speak(u);
    return u;
  } catch {
    onError?.();
    return null;
  }
}

// Lee en voz alta la última respuesta del conserje cuando el altavoz está
// activado. Espera a que la respuesta termine de escribirse antes de sintetizar.
export function useSpokenReplies(messages, { enabled, lang, loading }) {
  const [speakingId, setSpeakingId] = useState(null);
  const spokenRef = useRef(null);
  const primedRef = useRef(false);
  const utteranceRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* already stopped */ }
    }
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!primedRef.current && messages.length > 0 && !loading) {
      primedRef.current = true;
      spokenRef.current = new Set(messages.map((m, i) => messageKey(m, i)));
      return;
    }
    if (!primedRef.current) return;

    if (!enabled) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) { /* already stopped */ }
      }
      utteranceRef.current = null;
      setSpeakingId(null);
      return;
    }

    timerRef.current = setTimeout(() => {
      const msgs = messages || [];
      let lastIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant' && msgs[i].content) { lastIdx = i; break; }
      }
      if (lastIdx < 0) return;
      const last = msgs[lastIdx];
      const busy = (last.tool_calls || []).some(tc => ['pending', 'running', 'in_progress'].includes(tc.status));
      if (busy) return;
      msgs.forEach((m, i) => { if (i < lastIdx) spokenRef.current.add(messageKey(m, i)); });
      const key = messageKey(last, lastIdx);
      if (spokenRef.current.has(key)) return;
      spokenRef.current.add(key);
      const text = cleanForSpeech(last.content);
      if (!text) return;
      setSpeakingId(key);
      utteranceRef.current = speakWithBrowserTts(text, lang, {
        onEnd: () => { setSpeakingId(null); utteranceRef.current = null; },
        onError: () => { setSpeakingId(null); utteranceRef.current = null; },
      });
    }, SPEECH_DELAY_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [messages, enabled, lang, loading]);

  return { speakingId };
}

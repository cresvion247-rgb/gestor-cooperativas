import { useCallback, useEffect, useRef, useState } from 'react';

const LANG_TAGS = { es: 'es-ES', en: 'en-US', eu: 'eu-ES', fr: 'fr-FR' };

// Dictado por voz del navegador: transcribe a texto en el idioma de la
// interfaz activa y lo entrega como mensaje listo para enviar. En
// navegadores sin soporte queda desactivado y se escribe normalmente.
export function useSpeechInput({ lang, onResult }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  const supported = typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => {
    if (recRef.current) {
      try { recRef.current.abort(); } catch (e) { /* ya cerrado */ }
    }
  }, []);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (recRef.current) {
      try { recRef.current.stop(); } catch (e) { /* ya detenido */ }
      recRef.current = null;
      setListening(false);
      return;
    }
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = LANG_TAGS[lang] || 'es-ES';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = e => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ').trim();
      if (transcript) cbRef.current?.(transcript);
    };
    rec.onend = () => { recRef.current = null; setListening(false); };
    rec.onerror = () => { recRef.current = null; setListening(false); };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [lang, supported]);

  return { supported, listening, toggle };
}
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { TRANSLATIONS, STATUS_TRANSLATIONS } from '@/lib/translations';

const I18nContext = createContext(null);
export const LANG_STORAGE_KEY = 'urbalex_lang';

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(LANG_STORAGE_KEY) || 'es'; } catch (e) { return 'es'; }
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !active) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('interface_language')
          .eq('id', session.user.id)
          .maybeSingle();
        if (active && profile?.interface_language) {
          setLangState(profile.interface_language);
          try { localStorage.setItem(LANG_STORAGE_KEY, profile.interface_language); } catch (e) { /* almacenamiento no disponible */ }
        }
      } catch {
        /* sin sesión */
      }
    })();
    return () => { active = false; };
  }, []);

  const setLang = useCallback(async next => {
    setLangState(next);
    try { localStorage.setItem(LANG_STORAGE_KEY, next); } catch (e) { /* almacenamiento no disponible */ }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase
        .from('profiles')
        .update({ interface_language: next })
        .eq('id', session.user.id);
    } catch (e) { /* sin sesión */ }
  }, []);

  const t = useCallback(key => (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) ?? TRANSLATIONS.es[key] ?? key, [lang]);
  const st = useCallback(value => (STATUS_TRANSLATIONS[lang] && STATUS_TRANSLATIONS[lang][value]) || value, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t, st }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

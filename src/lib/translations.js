// Registro central de traducciones. Los diccionarios viven en archivos JSON
// por idioma (src/lib/locales/*.json) para mantener cada archivo ligero.

import ES from '@/lib/locales/es.json';
import EN from '@/lib/locales/en.json';
import EU from '@/lib/locales/eu.json';
import FR from '@/lib/locales/fr.json';
import STATUS from '@/lib/locales/status.json';

export const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'eu', label: 'Euskara' },
  { code: 'fr', label: 'Français' }
];

export const TRANSLATIONS = { es: ES, en: EN, eu: EU, fr: FR };

export const STATUS_TRANSLATIONS = STATUS;
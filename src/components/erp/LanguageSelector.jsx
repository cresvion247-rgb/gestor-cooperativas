import React from 'react';
import { Check, Languages } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useI18n } from '@/lib/i18n';
import { LANGUAGES } from '@/lib/translations';

// Selector de idioma del encabezado: botón compacto (icono + código) con
// menú desplegable, visible en todos los tamaños de pantalla.
export default function LanguageSelector({ className = '' }) {
  const { lang, setLang } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-teal-600 ${className}`}
        aria-label="Idioma / Language / Hizkuntza / Langue"
      >
        <Languages className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wide">{lang}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {LANGUAGES.map(l => (
          <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)} className="gap-2 text-sm">
            <span className="w-4">{l.code === lang && <Check className="h-4 w-4 text-teal-700" />}</span>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
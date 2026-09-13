import React from 'react';
import { Bot } from 'lucide-react';
import { useConcierge } from '@/components/concierge/ConciergeProvider';
import { useI18n } from '@/lib/i18n';

// Botón de acceso al conserje: compacto para la cabecera, con etiqueta para
// el portal del socio.
export default function ConciergeButton({ compact = false }) {
  const { t } = useI18n();
  const { setOpen } = useConcierge();
  if (compact) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-xl border border-slate-200 p-2 text-teal-700 transition hover:bg-teal-50" aria-label={t('concierge.title')} title={t('concierge.title')}>
        <Bot className="h-4 w-4" />
      </button>
    );
  }
  return (
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#102A43] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#173F5F]">
      <Bot className="h-4 w-4" />
      {t('concierge.open')}
    </button>
  );
}
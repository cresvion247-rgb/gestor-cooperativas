import React from 'react';
import { useI18n } from '@/lib/i18n';
import { formatEur } from '@/lib/format';
import { effectiveEstado, importePendiente } from '@/lib/finance';

// Tarjetas resumen del módulo financiero: exigible, cobrado, pendiente y vencido.
export default function FinanzasStats({ aportaciones }) {
  const { t } = useI18n();
  const rows = aportaciones.filter(a => a.estado !== 'cancelada');
  const debido = rows.reduce((s, a) => s + (a.importe_debido || 0), 0);
  const pagado = rows.reduce((s, a) => s + (a.importe_pagado || 0), 0);
  const vencidas = rows.filter(a => effectiveEstado(a) === 'vencida');
  const cards = [
    { key: 'due', label: t('fin.stats.due'), value: formatEur(debido, true) },
    { key: 'collected', label: t('fin.stats.collected'), value: formatEur(pagado, true) },
    { key: 'pending', label: t('fin.stats.pending'), value: formatEur(debido - pagado, true) },
    { key: 'overdue', label: t('fin.stats.overdue'), value: `${vencidas.length}`, hint: vencidas.length ? formatEur(vencidas.reduce((s, a) => s + importePendiente(a), 0), true) : null, danger: Boolean(vencidas.length) }
  ];
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(c => (
        <div key={c.key} className={`rounded-2xl border bg-white p-5 shadow-sm ${c.danger ? 'border-red-200' : 'border-slate-200'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
          <p className={`mt-2 text-2xl font-bold ${c.danger ? 'text-red-600' : 'text-[#102A43]'}`}>{c.value}</p>
          {c.hint && <p className="mt-1 text-xs text-red-500">{c.hint}</p>}
        </div>
      ))}
    </div>
  );
}
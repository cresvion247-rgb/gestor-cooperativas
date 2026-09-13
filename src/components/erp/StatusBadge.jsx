import React from 'react';
import { useI18n } from '@/lib/i18n';
const tones = { inactiva: 'bg-amber-50 text-amber-700', inactivo: 'bg-red-50 text-red-700', cerrada: 'bg-slate-100 text-slate-500', pre_formacion: 'bg-blue-50 text-blue-700', activa: 'bg-emerald-50 text-emerald-700', construccion: 'bg-teal-50 text-teal-700', activo: 'bg-emerald-50 text-emerald-700', pendiente_aprobacion: 'bg-amber-50 text-amber-700', vencida: 'bg-red-50 text-red-700', alto: 'bg-red-50 text-red-700', critico: 'bg-red-100 text-red-800', medio: 'bg-amber-50 text-amber-700', bajo: 'bg-slate-100 text-slate-600' };

export default function StatusBadge({ value }) {
  const { st } = useI18n();
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[value] || 'bg-slate-100 text-slate-600'}`}>{String(st(value || '—')).replaceAll('_', ' ')}</span>;
}
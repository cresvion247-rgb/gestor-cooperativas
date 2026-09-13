import React from 'react';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import StatusBadge from '@/components/erp/StatusBadge';
import { useI18n } from '@/lib/i18n';
import { formatDate } from '@/lib/format';

// Campana de notificaciones del encabezado: lista las alertas abiertas
// (no resueltas) de la organización con prioridad y fecha límite.
export default function NotificationsBell() {
  const { t } = useI18n();
  const { data = [] } = useQuery({ queryKey: ['alertas-notificaciones'], queryFn: () => base44.entities.Alerta.list('-created_date', 50) });
  const open = data.filter(a => a.estado !== 'resuelta');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex h-9 shrink-0 items-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-teal-600"
        aria-label={t('header.alerts')}
      >
        <Bell className="h-4 w-4" />
        {open.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">{open.length}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <p className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">{t('header.alerts')}</p>
        <div className="max-h-80 overflow-y-auto p-2">
          {open.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">{t('home.noAlerts')}</p>
          ) : open.slice(0, 10).map(a => (
            <div key={a.id} className="rounded-lg p-3 transition hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 break-words text-sm font-semibold text-slate-900">{a.titulo}</p>
                <StatusBadge value={a.prioridad} />
              </div>
              {a.fecha_limite && <p className="mt-1 text-xs text-slate-500">{t('fin.col.expiry')}: {formatDate(a.fecha_limite)}</p>}
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
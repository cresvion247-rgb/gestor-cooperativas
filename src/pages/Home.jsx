import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import StatCard from '@/components/erp/StatCard';
import StatusBadge from '@/components/erp/StatusBadge';
import { useI18n } from '@/lib/i18n';
import { formatEur, formatDate } from '@/lib/format';

export default function Home() {
  const { t, st } = useI18n();
  const { data = [], isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => Promise.all([base44.entities.Cooperativa.list(), base44.entities.Proyecto.list(), base44.entities.Contrato.list(), base44.entities.Aportacion.list(), base44.entities.Alerta.list()]) });
  if (isLoading) return <div className="py-20 text-center text-slate-500">{t('home.loadingDashboard')}</div>;
  const [coops = [], projects = [], contracts = [], payments = [], alerts = []] = data;
  const budget = projects.reduce((s, p) => s + (p.presupuesto_total || 0), 0);
  const actual = projects.reduce((s, p) => s + (p.coste_real || 0), 0);
  const overdue = payments.filter(p => p.estado === 'vencida').reduce((s, p) => s + (p.importe_pendiente || 0), 0);
  return (
    <>
      <PageHeader title={t('home.title')} description={t('home.desc')} action={t('home.action')} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('home.coopsActive')} value={coops.filter(c => c.estado === 'activa').length} />
        <StatCard label={t('home.homes')} value={projects.reduce((s, p) => s + (p.viviendas || 0), 0)} tone="teal" />
        <StatCard label={t('home.budget')} value={formatEur(budget)} detail={`${t('home.executed')} ${formatEur(actual)}`} />
        <StatCard label={t('home.overdue')} value={formatEur(overdue)} tone="red" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-[#102A43]">{t('home.activeProjects')}</h2>
          <div className="mt-4 space-y-4">
            {projects.map(p => (
              <div key={p.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-900">{p.nombre}</p>
                    <p className="text-xs text-slate-500">{p.municipio} · {p.viviendas} {t('home.homesUnit')}</p>
                  </div>
                  <StatusBadge value={p.riesgo} />
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-teal-600" style={{ width: `${p.progreso_real || 0}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">{t('home.realProgress')} {p.progreso_real || 0}% · {t('home.scheduled')} {p.progreso_previsto || 0}%</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-[#102A43]">{t('home.priorityAlerts')}</h2>
          <div className="mt-4 space-y-3">
            {alerts.slice(0, 6).map(a => (
              <div key={a.id} className="border-l-2 border-red-500 pl-3">
                <p className="break-words text-sm font-semibold text-slate-800">{a.titulo}</p>
                <p className="text-xs text-slate-500">{formatDate(a.fecha_limite)} · {st(a.prioridad)}</p>
              </div>
            ))}
            {!alerts.length && <p className="text-sm text-slate-400">{t('home.noAlerts')}</p>}
          </div>
        </section>
      </div>
    </>
  );
}
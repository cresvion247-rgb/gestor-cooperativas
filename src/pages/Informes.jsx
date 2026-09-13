import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { exportInformePdf } from '@/lib/pdf';
import { formatEur } from '@/lib/format';
import { effectiveEstado } from '@/lib/finance';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0F766E', '#102A43', '#F59E0B', '#EF4444', '#64748B', '#38BDF8', '#84CC16', '#F97316', '#A78BFA', '#FBBF24'];

const countBy = (rows, key) => {
  const map = new Map();
  rows.forEach(r => { const k = r[key] || '—'; map.set(k, (map.get(k) || 0) + 1); });
  return [...map.entries()].map(([name, value]) => ({ name, value }));
};

const Section = ({ title, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="mb-4 font-bold text-[#102A43]">{title}</h2>
    {children}
  </section>
);

// Informes: métricas agregadas de promociones, finanzas, contratos e
// incidencias, en modo de solo lectura para toda la organización.
export default function Informes() {
  const { t, st } = useI18n();
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery({ queryKey: ['informes'], queryFn: () => Promise.all([
    base44.entities.Proyecto.list(),
    base44.entities.Aportacion.list(),
    base44.entities.Contrato.list(),
    base44.entities.Incidencia.list(),
    base44.entities.Cooperativa.list()
  ]) });
  if (isLoading) return <p className="text-slate-500">{t('common.loading')}</p>;
  const [proyectos = [], aportaciones = [], contratos = [], incidencias = [], cooperativas = []] = data;

  const fases = countBy(proyectos, 'estado').map(d => ({ ...d, name: st(d.name) }));
  const contratosPorEstado = countBy(contratos, 'estado').map(d => ({ ...d, name: st(d.name) }));
  const incidenciasPorEstado = countBy(incidencias, 'estado').map(d => ({ ...d, name: st(d.name) }));

  const finanzaData = cooperativas.map(c => {
    const rows = aportaciones.filter(a => a.cooperativa_id === c.id && a.estado !== 'cancelada');
    return {
      name: c.nombre,
      debido: rows.reduce((s, a) => s + (a.importe_debido || 0), 0),
      pagado: rows.reduce((s, a) => s + (a.importe_pagado || 0), 0)
    };
  });
  const vencidas = aportaciones.filter(a => effectiveEstado(a) === 'vencida').length;

  // Informe ejecutivo en PDF (pipeline, finanzas, contratos, incidencias).
  const exportReport = async () => {
    try {
      exportInformePdf({ cooperativas, proyectos, contratos, incidencias, aportaciones, t, st });
      await logAudit({ accion: 'pdf_exportado', entidad_tipo: 'Informe', detalle: 'Informe ejecutivo' });
      toast({ title: t('pdf.exported') });
    } catch (e) {
      toast({ title: t('pdf.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
  };

  return (
    <>
      <PageHeader title={t('nav.informes')} description={t('module.informes.desc')} action={t('inf.action')} onAction={exportReport} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={t('inf.projects')}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fases} dataKey="value" nameKey="name" outerRadius={100} label>
                  {fases.map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title={t('inf.finance')}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={finanzaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => formatEur(v, true)} />
                <Legend />
                <Bar dataKey="debido" name={t('fin.stats.due')} fill="#102A43" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pagado" name={t('inf.collected')} fill="#0F766E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {vencidas > 0 && <p className="mt-2 text-sm font-semibold text-red-600">{t('fin.stats.overdue')}: {vencidas}</p>}
        </Section>
        <Section title={t('inf.contracts')}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contratosPorEstado}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name={t('common.status')} fill="#0F766E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title={t('inf.incidences')}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={incidenciasPorEstado} dataKey="value" nameKey="name" outerRadius={100} label>
                  {incidenciasPorEstado.map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>
    </>
  );
}
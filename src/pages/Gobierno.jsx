import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import StatusBadge from '@/components/erp/StatusBadge';
import { useI18n } from '@/lib/i18n';
import { formatDate } from '@/lib/format';

// Gobierno cooperativo: panorama por cooperativa (socios, viviendas,
// adjudicaciones, alertas) y documentos reservados al consejo rector.
export default function Gobierno() {
  const { t } = useI18n();
  const { data = [], isLoading } = useQuery({ queryKey: ['gobierno'], queryFn: () => Promise.all([
    base44.entities.Cooperativa.list(),
    base44.entities.Socio.list(),
    base44.entities.Proyecto.list(),
    base44.entities.Vivienda.list(),
    base44.entities.Adjudicacion.list(),
    base44.entities.Alerta.list(),
    base44.entities.DocumentoLegal.list()
  ]) });
  if (isLoading) return <p className="text-slate-500">{t('common.loading')}</p>;
  const [cooperativas = [], socios = [], proyectos = [], viviendas = [], adjudicaciones = [], alertas = [], documentos = []] = data;

  const coopProyectos = c => proyectos.filter(p => p.cooperativa_id === c.id).map(p => p.id);
  const statsOf = c => ({
    members: socios.filter(s => s.cooperativa_id === c.id && s.estado === 'activo').length,
    homes: viviendas.filter(v => coopProyectos(c).includes(v.proyecto_id)).length,
    allocations: adjudicaciones.filter(a => a.cooperativa_id === c.id && a.estado === 'activa').length,
    openAlerts: alertas.filter(a => a.tenant_id === c.tenant_id && a.estado !== 'resuelta').length
  });

  const consejoDocs = documentos.filter(d => d.visibilidad === 'consejo_rector');
  const coopOf = d => cooperativas.find(c => c.id === d.cooperativa_id);

  return (
    <>
      <PageHeader title={t('nav.gobierno')} description={t('module.gobierno.desc')} />
      <div className="grid gap-4 md:grid-cols-2">
        {cooperativas.map(c => {
          const s = statsOf(c);
          return (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{c.nombre}</p>
                  <p className="text-xs text-slate-500">{c.municipio || ''}</p>
                </div>
                <StatusBadge value={c.estado} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <p className="text-slate-600">{t('gob.members')}: <span className="font-bold text-[#102A43]">{s.members}</span></p>
                <p className="text-slate-600">{t('gob.homes')}: <span className="font-bold text-[#102A43]">{s.homes}</span></p>
                <p className="text-slate-600">{t('gob.allocations')}: <span className="font-bold text-[#102A43]">{s.allocations}</span></p>
                <p className={`font-semibold ${s.openAlerts ? 'text-red-600' : 'text-slate-600'}`}>{t('gob.openAlerts')}: {s.openAlerts}</p>
              </div>
            </div>
          );
        })}
        {!cooperativas.length && <p className="text-sm text-slate-400">{t('common.empty')}</p>}
      </div>
      <h2 className="mb-3 mt-8 font-bold text-[#102A43]">{t('gob.docs')}</h2>
      <DataTable columns={[
        { key: 'titulo', label: t('inc.f.title') },
        { key: 'tipo', label: t('leg.col.type') },
        { key: 'cooperativa_id', label: t('nav.cooperativas'), render: (_, d) => coopOf(d)?.nombre || '—' },
        { key: 'fecha_documento', label: t('leg.col.date'), render: formatDate },
        { key: 'estado', label: t('common.status'), badge: true }
      ]} rows={consejoDocs} />
    </>
  );
}
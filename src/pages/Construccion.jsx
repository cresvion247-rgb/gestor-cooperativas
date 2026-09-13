import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import StatusBadge from '@/components/erp/StatusBadge';
import ProgresoDialog from '@/components/construccion/ProgresoDialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff } from '@/lib/permissions';
import { formatEur, formatDate } from '@/lib/format';

const FASES_ACTIVAS = ['viabilidad', 'adquisicion_suelo', 'urbanismo', 'licencias', 'licitacion', 'construccion', 'entrega', 'garantia'];

// Seguimiento de obra: tarjetas de promociones activas con progreso real
// frente al previsto y control de coste comprometido y real.
export default function Construccion() {
  const { t } = useI18n();
  const { user } = useAuth();
  const staff = isCoopStaff(user);
  const { data: proyectos = [], isLoading } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-updated_date', 500) });
  const { data: cooperativas = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date', 500) });
  const [dialog, setDialog] = useState(null);

  const coopOf = p => cooperativas.find(c => c.id === p.cooperativa_id);
  const rows = proyectos.filter(p => FASES_ACTIVAS.includes(p.estado));

  return (
    <>
      <PageHeader title={t('nav.construccion')} description={t('module.construccion.desc')} />
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(p => (
            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{p.nombre}</p>
                  <p className="text-xs text-slate-500">{coopOf(p)?.nombre || '—'} · {p.municipio || ''}</p>
                </div>
                <StatusBadge value={p.estado} />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(100, p.progreso_real || 0)}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{t('constr.real')} {p.progreso_real || 0}% · {t('constr.planned')} {p.progreso_previsto || 0}%</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <p>{t('constr.budget')}: <span className="font-semibold">{formatEur(p.presupuesto_total, true)}</span></p>
                <p>{t('constr.committed')}: <span className="font-semibold">{formatEur(p.coste_comprometido, true)}</span></p>
                <p>{t('constr.f.cost')}: <span className="font-semibold">{formatEur(p.coste_real, true)}</span></p>
                <p>{t('constr.f.end')}: <span className="font-semibold">{formatDate(p.fin_estimado)}</span></p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <StatusBadge value={p.riesgo} />
                {staff && <Button size="sm" variant="outline" onClick={() => setDialog(p)}>{t('constr.action')}</Button>}
              </div>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-slate-400">{t('common.empty')}</p>}
        </div>
      )}
      {dialog && <ProgresoDialog proyecto={dialog} onClose={() => setDialog(null)} />}
    </>
  );
}
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import StatusBadge from '@/components/erp/StatusBadge';
import ArchiveTabs from '@/components/erp/ArchiveTabs';
import ProgresoDialog from '@/components/construccion/ProgresoDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff } from '@/lib/permissions';
import { formatEur, formatDate } from '@/lib/format';
import { logAudit } from '@/lib/audit';
import { archiveCounts, filterByArchiveTab, isProyectoArchived } from '@/lib/archive';

export default function Construccion() {
  const { t } = useI18n();
  const { user } = useAuth();
  const staff = isCoopStaff(user);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: proyectos = [], isLoading } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-updated_date', 500) });
  const { data: cooperativas = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date', 500) });
  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState('active');
  const [busy, setBusy] = useState(false);

  const coopOf = p => cooperativas.find(c => c.id === p.cooperativa_id);
  const counts = useMemo(() => archiveCounts(proyectos, isProyectoArchived), [proyectos]);
  const rows = useMemo(() => filterByArchiveTab(proyectos, tab, isProyectoArchived), [proyectos, tab]);

  const setEstado = async (p, estado) => {
    setBusy(true);
    try {
      await base44.entities.Proyecto.update(p.id, { estado });
      await logAudit({
        tenant_id: p.tenant_id,
        accion: estado === 'cerrado' ? 'proyecto_archivado' : 'proyecto_reactivado',
        entidad_tipo: 'Proyecto',
        entidad_id: p.id,
        valores_anteriores: { estado: p.estado },
        valores_nuevos: { estado },
      });
      qc.invalidateQueries({ queryKey: ['proyectos'] });
      toast({ title: t(estado === 'cerrado' ? 'archive.done' : 'archive.restored') });
      setTab(estado === 'cerrado' ? 'archived' : 'active');
    } catch (e) {
      toast({ title: t('archive.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title={t('nav.construccion')} description={t('module.construccion.desc')} />
      <ArchiveTabs value={tab} onChange={setTab} activeCount={counts.active} archivedCount={counts.archived} />
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
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <StatusBadge value={p.riesgo} />
                <div className="flex flex-wrap gap-2">
                  {staff && tab === 'active' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setDialog(p)}>{t('constr.action')}</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setEstado(p, 'cerrado')}>{t('archive.action')}</Button>
                    </>
                  )}
                  {staff && tab === 'archived' && (
                    <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" disabled={busy} onClick={() => setEstado(p, 'construccion')}>{t('archive.unarchive')}</Button>
                  )}
                </div>
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

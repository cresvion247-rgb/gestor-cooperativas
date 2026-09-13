import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { findMySocio, findMyCooperativa } from '@/lib/member';
import { isCoopStaff } from '@/lib/permissions';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import StatusBadge from '@/components/erp/StatusBadge';
import ArchiveTabs from '@/components/erp/ArchiveTabs';
import IncidenciaDialog from '@/components/incidencias/IncidenciaDialog';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { archiveCounts, filterByArchiveTab, isCerradaArchived } from '@/lib/archive';

export default function Incidencias() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const staff = isCoopStaff(user);

  const socioQ = useQuery({ queryKey: ['portal-socio', user?.email], queryFn: () => findMySocio(user?.email), enabled: Boolean(user?.email) });
  const socio = socioQ.data;
  const coopsQ = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list() });
  const cooperativa = findMyCooperativa(coopsQ.data, user);
  const { data: incs = [], isLoading } = useQuery({ queryKey: ['incidencias'], queryFn: () => base44.entities.Incidencia.list('-created_date') });

  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState('active');
  const [busy, setBusy] = useState(false);

  const scoped = useMemo(
    () => (staff ? incs : incs.filter(i => socio && i.socio_id === socio.id)),
    [incs, staff, socio],
  );
  const counts = useMemo(() => archiveCounts(scoped, isCerradaArchived), [scoped]);
  const rows = useMemo(() => filterByArchiveTab(scoped, tab, isCerradaArchived), [scoped, tab]);

  const setArchiveState = async (i, next) => {
    setBusy(true);
    try {
      const payload = { estado: next };
      if (next === 'cerrada') payload.fecha_resolucion = new Date().toISOString().slice(0, 10);
      await base44.entities.Incidencia.update(i.id, payload);
      await logAudit({
        tenant_id: i.tenant_id,
        accion: next === 'cerrada' ? 'incidencia_archivada' : 'incidencia_reactivada',
        entidad_tipo: 'Incidencia',
        entidad_id: i.id,
        valores_anteriores: { estado: i.estado },
        valores_nuevos: payload,
      });
      qc.invalidateQueries({ queryKey: ['incidencias'] });
      toast({ title: t(next === 'cerrada' ? 'archive.done' : 'archive.restored') });
    } catch (e) {
      toast({ title: t('archive.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title={t('inc.title')} description={t('inc.desc')} action={t('inc.action')} onAction={() => setDialog('new')} />
      <ArchiveTabs value={tab} onChange={setTab} activeCount={counts.active} archivedCount={counts.archived} />
      {isLoading || socioQ.isLoading || coopsQ.isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'titulo', label: t('inc.col.title') },
          { key: 'categoria', label: t('inc.col.category'), render: v => t(`inc.cat.${v}`) },
          { key: 'prioridad', label: t('inc.col.priority'), render: v => <StatusBadge value={v} /> },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'created_date', label: t('inc.col.date'), render: formatDate },
          { key: 'acciones', label: '', render: (_, i) => (
            <div className="flex flex-wrap gap-2">
              {staff && tab === 'active' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setDialog(i)}>{t('inc.manage')}</Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setArchiveState(i, 'cerrada')}>{t('archive.action')}</Button>
                </>
              )}
              {staff && tab === 'archived' && (
                <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" disabled={busy} onClick={() => setArchiveState(i, 'en_gestion')}>{t('archive.unarchive')}</Button>
              )}
            </div>
          ) }
        ]} rows={rows} />
      )}
      {dialog && (
        <IncidenciaDialog
          incidencia={dialog === 'new' ? null : dialog}
          staff={staff}
          cooperativa={cooperativa}
          socioId={socio?.id || null}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

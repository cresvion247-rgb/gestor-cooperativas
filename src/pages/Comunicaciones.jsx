import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ArchiveTabs from '@/components/erp/ArchiveTabs';
import ComunicacionDialog from '@/components/comunicaciones/ComunicacionDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { notifyCooperative } from '@/lib/notify';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { archiveCounts, filterByArchiveTab, isAlertaArchived } from '@/lib/archive';

export default function Comunicaciones() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const staff = isCoopStaff(user);

  const { data: alertas = [], isLoading } = useQuery({ queryKey: ['alertas'], queryFn: () => base44.entities.Alerta.list('-created_date', 500) });
  const { data: cooperativas = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date', 500) });

  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('active');

  const counts = useMemo(() => archiveCounts(alertas, isAlertaArchived), [alertas]);
  const rows = useMemo(() => filterByArchiveTab(alertas, tab, isAlertaArchived), [alertas, tab]);

  const advance = async (a, estado, okKey = 'comm.alertUpdated') => {
    setBusy(true);
    try {
      await base44.entities.Alerta.update(a.id, { estado });
      await logAudit({
        tenant_id: a.tenant_id,
        accion: estado === 'archivado' ? 'alerta_archivada' : (a.estado === 'archivado' ? 'alerta_reactivada' : 'alerta_actualizada'),
        entidad_tipo: 'Alerta',
        entidad_id: a.id,
        valores_anteriores: { estado: a.estado },
        valores_nuevos: { estado },
      });
      qc.invalidateQueries({ queryKey: ['alertas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: t(okKey) });
    } catch (e) {
      toast({ title: t('archive.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  const send = async (payload) => {
    setBusy(true);
    try {
      const record = { ...payload, tipo: 'comunicado', estado: 'abierta', entidad_tipo: 'manual' };
      const res = await base44.entities.Alerta.create(record);
      await logAudit({ tenant_id: payload.tenant_id, accion: 'alerta_creada', entidad_tipo: 'Alerta', entidad_id: res?.id || null, valores_nuevos: record });
      await notifyCooperative({ tenant_id: payload.tenant_id, tipo: 'comunicado', titulo: payload.titulo, descripcion: payload.descripcion, prioridad: payload.prioridad });
      qc.invalidateQueries({ queryKey: ['alertas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: t('comm.sent') });
      setDialog(false);
    } catch (e) {
      toast({ title: t('comm.sendFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        title={t('nav.comunicaciones')}
        description={t('module.comunicaciones.desc')}
        action={staff ? t('comm.action') : undefined}
        onAction={() => setDialog(true)}
      />
      <ArchiveTabs value={tab} onChange={setTab} activeCount={counts.active} archivedCount={counts.archived} />
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'titulo', label: t('comm.col.title') },
          { key: 'tipo', label: t('comm.col.type') },
          { key: 'prioridad', label: t('comm.f.priority'), badge: true },
          { key: 'fecha_limite', label: t('common.deadline'), render: formatDate },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'acciones', label: '', render: (_, a) => staff ? (
            <div className="flex flex-wrap gap-2">
              {tab === 'active' && (
                <>
                  {a.estado === 'abierta' && <Button size="sm" variant="outline" disabled={busy} onClick={() => advance(a, 'en_gestion')}>{t('common.manage')}</Button>}
                  {a.estado !== 'resuelta' && <Button size="sm" className="bg-teal-700 hover:bg-teal-800" disabled={busy} onClick={() => advance(a, 'resuelta')}>{t('comm.resolve')}</Button>}
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => advance(a, 'archivado', 'archive.done')}>{t('archive.action')}</Button>
                </>
              )}
              {tab === 'archived' && (
                <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" disabled={busy} onClick={() => advance(a, 'en_gestion', 'archive.restored')}>{t('archive.unarchive')}</Button>
              )}
            </div>
          ) : null }
        ]} rows={rows} />
      )}
      {dialog && <ComunicacionDialog cooperativas={cooperativas} onSave={send} onClose={() => setDialog(false)} />}
    </>
  );
}

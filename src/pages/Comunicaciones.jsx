import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ComunicacionDialog from '@/components/comunicaciones/ComunicacionDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { notifyCooperative } from '@/lib/notify';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';

// Comunicaciones: bandeja de alertas de las cooperativas con gestión de estado
// y difusión de comunicados (alerta en la app + email a los usuarios).
export default function Comunicaciones() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const staff = isCoopStaff(user);

  const { data: alertas = [], isLoading } = useQuery({ queryKey: ['alertas'], queryFn: () => base44.entities.Alerta.list('-created_date', 500) });
  const { data: cooperativas = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date', 500) });

  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  const advance = async (a, estado) => {
    setBusy(true);
    try {
      await base44.entities.Alerta.update(a.id, { estado });
      await logAudit({ tenant_id: a.tenant_id, accion: 'alerta_actualizada', entidad_tipo: 'Alerta', entidad_id: a.id, valores_anteriores: { estado: a.estado }, valores_nuevos: { estado } });
      qc.invalidateQueries({ queryKey: ['alertas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: t('comm.alertUpdated') });
    } catch (e) {
      toast({ title: t('comm.alertFailed'), description: String(e?.message || e), variant: 'destructive' });
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
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'titulo', label: t('inc.f.title') },
          { key: 'tipo', label: t('fin.f.type') },
          { key: 'prioridad', label: t('comm.f.priority'), badge: true },
          { key: 'fecha_limite', label: t('common.deadline'), render: formatDate },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'acciones', label: '', render: (_, a) => staff && a.estado !== 'resuelta' ? (
            <div className="flex gap-2">
              {a.estado === 'abierta' && <Button size="sm" variant="outline" disabled={busy} onClick={() => advance(a, 'en_gestion')}>{t('common.manage')}</Button>}
              <Button size="sm" className="bg-teal-700 hover:bg-teal-800" disabled={busy} onClick={() => advance(a, 'resuelta')}>{t('comm.resolve')}</Button>
            </div>
          ) : null }
        ]} rows={alertas} />
      )}
      {dialog && <ComunicacionDialog cooperativas={cooperativas} onSave={send} onClose={() => setDialog(false)} />}
    </>
  );
}
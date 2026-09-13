import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ConfirmDialog from '@/components/erp/ConfirmDialog';
import CooperativaDialog from '@/components/erp/cooperativas/CooperativaDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';
import { isSuperAdmin, canEditCooperativa } from '@/lib/permissions';

const ESTADOS = ['todas', 'pre_formacion', 'activa', 'inactiva', 'cerrada'];

export default function Cooperativas() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date') });
  const [filter, setFilter] = useState('todas');
  const [dialog, setDialog] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const admin = isSuperAdmin(user);
  const canEdit = c => canEditCooperativa(user, c);
  const rows = filter === 'todas' ? data : data.filter(c => c.estado === filter);

  const setEstado = async (coop, estado) => {
    setBusy(true);
    try {
      await base44.entities.Cooperativa.update(coop.id, { estado });
      await logAudit({
        tenant_id: coop.tenant_id,
        accion: estado === 'cerrada' ? 'cooperativa_cerrada' : 'cooperativa_desactivada',
        entidad_tipo: 'Cooperativa',
        entidad_id: coop.id,
        valores_anteriores: { estado: coop.estado },
        valores_nuevos: { estado }
      });
      qc.invalidateQueries({ queryKey: ['cooperativas'] });
      toast({ title: t('coop.updated') });
      setConfirming(null);
    } catch (e) {
      toast({ title: t('coop.updateFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        title={t('coop.title')}
        description={t('coop.desc')}
        action={admin ? t('coop.action') : undefined}
        onAction={admin ? () => setDialog('new') : undefined}
      />
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">{t('common.status')}</label>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {ESTADOS.map(e => <option key={e} value={e}>{e === 'todas' ? t('audit.all') : st(e)}</option>)}
        </select>
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'nombre', label: t('coop.col.name') },
          { key: 'cif', label: t('coop.col.cif') },
          { key: 'municipio', label: t('coop.col.municipality') },
          { key: 'administrador_urbalex', label: t('coop.col.manager') },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'acciones', label: '', render: (_, c) => (
            <div className="flex gap-2">
              {canEdit(c) && <Button variant="outline" size="sm" onClick={() => setDialog(c)}>{t('common.edit')}</Button>}
              {admin && c.estado !== 'cerrada' && <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setConfirming(c)}>{t('coop.deactivate')}</Button>}
            </div>
          )}
        ]} rows={rows} />
      )}
      {dialog && <CooperativaDialog cooperativa={dialog === 'new' ? null : dialog} existingTenantIds={data.map(c => c.tenant_id)} canChangeStatus={admin} onClose={() => setDialog(null)} />}
      {confirming && (
        <ConfirmDialog
          title={t('coop.deactivateTitle')}
          description={t('coop.deactivateBody')}
          busy={busy}
          onClose={() => setConfirming(null)}
          actions={[
            { label: t('coop.markInactive'), onConfirm: () => setEstado(confirming, 'inactiva') },
            { label: t('coop.markClosed'), destructive: true, onConfirm: () => setEstado(confirming, 'cerrada') }
          ]}
        />
      )}
    </>
  );
}
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import DataTable from '@/components/erp/DataTable';
import ConfirmDialog from '@/components/erp/ConfirmDialog';
import ProveedorDialog from '@/components/proveedores/ProveedorDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';
import { isCoopStaff } from '@/lib/permissions';

// Homologación de proveedores: candidato → homologado → suspendido,
// con auditoría de cada cambio de estado.
export default function ProveedoresTab() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: coops = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date', 500) });
  const { data: proveedores = [], isLoading } = useQuery({ queryKey: ['proveedores'], queryFn: () => base44.entities.Proveedor.list('-created_date', 500) });

  const [coopFilter, setCoopFilter] = useState('todas');
  const [dialog, setDialog] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const staff = isCoopStaff(user);
  const coopOf = p => coops.find(c => c.id === p.cooperativa_id);
  const rows = proveedores.filter(p => coopFilter === 'todas' || p.cooperativa_id === coopFilter);

  const auditActionFor = (estado) =>
    estado === 'homologado' ? 'proveedor_homologado' : estado === 'suspendido' ? 'proveedor_suspendido' : 'proveedor_actualizado';

  const setEstado = async (proveedor, estado, msgKey) => {
    setBusy(true);
    try {
      const payload = { estado };
      if (estado === 'homologado' && !proveedor.fecha_homologacion) payload.fecha_homologacion = new Date().toISOString().slice(0, 10);
      await base44.entities.Proveedor.update(proveedor.id, payload);
      await logAudit({
        tenant_id: coopOf(proveedor)?.tenant_id,
        accion: auditActionFor(estado),
        entidad_tipo: 'Proveedor',
        entidad_id: proveedor.id,
        valores_anteriores: { estado: proveedor.estado },
        valores_nuevos: payload
      });
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      toast({ title: t(msgKey) });
      setConfirming(null);
    } catch (e) {
      toast({ title: t('prov.updateFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">{t('users.cooperative')}</label>
          <select value={coopFilter} onChange={e => setCoopFilter(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm">
            <option value="todas">{t('common.all')}</option>
            {coops.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        {staff && <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" onClick={() => setDialog('new')}>{t('prov.action')}</Button>}
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'nombre', label: t('prov.col.name') },
          { key: 'cif_nif', label: t('prov.col.cif') },
          { key: 'categoria', label: t('prov.col.category') },
          { key: 'valoracion', label: t('prov.col.rating'), render: v => v ? st(v) : '—' },
          { key: 'cooperativa_id', label: t('users.cooperative'), render: (_, p) => coopOf(p)?.nombre || '—' },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'acciones', label: '', render: (_, p) => staff ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setDialog(p)}>{t('common.edit')}</Button>
              {p.estado === 'candidato' && (
                <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" disabled={busy} onClick={() => setEstado(p, 'homologado', 'prov.homologated')}>{t('prov.homologate')}</Button>
              )}
              {p.estado === 'homologado' && (
                <Button variant="outline" size="sm" className="text-amber-700 hover:bg-amber-50" onClick={() => setConfirming(p)}>{t('prov.suspend')}</Button>
              )}
              {p.estado === 'suspendido' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setEstado(p, 'homologado', 'prov.reactivated')}>{t('prov.reactivate')}</Button>
              )}
            </div>
          ) : null }
        ]} rows={rows} />
      )}
      {dialog && <ProveedorDialog proveedor={dialog === 'new' ? null : dialog} cooperativas={coops} onClose={() => setDialog(null)} />}
      {confirming && (
        <ConfirmDialog
          title={t('prov.suspendTitle')}
          description={t('prov.suspendBody')}
          busy={busy}
          onClose={() => setConfirming(null)}
          actions={[{ label: t('prov.confirmSuspend'), destructive: true, onConfirm: () => setEstado(confirming, 'suspendido', 'prov.updated') }]}
        />
      )}
    </>
  );
}
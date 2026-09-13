import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import DataTable from '@/components/erp/DataTable';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { notifyCooperative } from '@/lib/notify';
import { useI18n } from '@/lib/i18n';
import { canApproveContract } from '@/lib/contracts';
import { formatEur, formatDate } from '@/lib/format';

// Histórico de modificaciones de un contrato y sus transiciones:
// pendiente de aprobación → aprobada → firmada y aplicada (o rechazada).
// Al aplicar, los nuevos valores se trasladan al contrato y la diferencia de
// importe ajusta el coste comprometido del proyecto.
export default function ModificacionesList({ contrato }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const { data: modificaciones = [] } = useQuery({
    queryKey: ['modificaciones', contrato.id],
    queryFn: () => base44.entities.ContratoModificacion.filter({ contrato_id: contrato.id }, '-created_date', 200)
  });
  const { data: proyectos = [] } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-created_date', 500) });

  const transition = async (mod, payload, accion, msgKey) => {
    setBusy(true);
    try {
      await base44.entities.ContratoModificacion.update(mod.id, payload);
      await logAudit({
        tenant_id: contrato.tenant_id,
        accion,
        entidad_tipo: 'ContratoModificacion',
        entidad_id: mod.id,
        valores_anteriores: { estado: mod.estado },
        valores_nuevos: payload
      });
      qc.invalidateQueries({ queryKey: ['modificaciones', contrato.id] });
      toast({ title: t(msgKey) });
    } catch (e) {
      toast({ title: t('con.am.updateFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  const apply = async (mod) => {
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await base44.entities.ContratoModificacion.update(mod.id, { estado: 'aplicado', fecha_aplicacion: today });
      const cPayload = {};
      if (mod.importe_total_nuevo != null) cPayload.importe_total = mod.importe_total_nuevo;
      if (mod.fecha_vencimiento_nueva) cPayload.fecha_vencimiento = mod.fecha_vencimiento_nueva;
      if (mod.terminos_pago_nuevos) cPayload.terminos_pago = mod.terminos_pago_nuevos;
      if (Object.keys(cPayload).length) await base44.entities.Contrato.update(contrato.id, cPayload);
      const delta = (mod.importe_total_nuevo || 0) - (mod.importe_total_anterior || 0);
      if (delta && contrato.proyecto_id) {
        const proyecto = proyectos.find(p => p.id === contrato.proyecto_id);
        if (proyecto) await base44.entities.Proyecto.update(proyecto.id, { coste_comprometido: (proyecto.coste_comprometido || 0) + delta });
      }
      await logAudit({
        tenant_id: contrato.tenant_id,
        accion: 'contrato_modificacion_aplicada',
        entidad_tipo: 'ContratoModificacion',
        entidad_id: mod.id,
        valores_anteriores: { estado: mod.estado, importe_total: contrato.importe_total },
        valores_nuevos: { estado: 'aplicado', ...cPayload }
      });
      await notifyCooperative({ tenant_id: contrato.tenant_id, tipo: 'contrato', titulo: `${t('con.title')}: ${contrato.codigo}`, descripcion: t('con.am.applied'), prioridad: 'media' });
      qc.invalidateQueries({ queryKey: ['modificaciones', contrato.id] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      qc.invalidateQueries({ queryKey: ['proyectos'] });
      toast({ title: t('con.am.applied') });
    } catch (e) {
      toast({ title: t('con.am.updateFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <DataTable columns={[
      { key: 'motivo', label: t('con.am.f.motivo') },
      { key: 'fecha_solicitud', label: t('leg.col.date'), render: v => formatDate(v) },
      { key: 'importe', label: t('con.f.total'), render: (_, m) => (
        <span>{formatEur(m.importe_total_anterior, true)} → {formatEur(m.importe_total_nuevo, true)}</span>
      )},
      { key: 'estado', label: t('common.status'), badge: true },
      { key: 'acciones', label: '', render: (_, m) => (
        <div className="flex flex-wrap gap-2">
          {m.estado === 'pendiente_aprobacion' && canApproveContract(user) && (
            <Button size="sm" disabled={busy} className="bg-[#102A43] hover:bg-[#173F5F]" onClick={() => transition(m, { estado: 'aprobado' }, 'contrato_modificacion_aprobada', 'con.am.approved')}>{t('con.am.approve')}</Button>
          )}
          {m.estado === 'pendiente_aprobacion' && (
            <Button size="sm" variant="outline" disabled={busy} className="text-red-600 hover:bg-red-50" onClick={() => transition(m, { estado: 'rechazado' }, 'contrato_modificacion_rechazada', 'con.am.rejected')}>{t('con.am.reject')}</Button>
          )}
          {m.estado === 'aprobado' && (
            <Button size="sm" disabled={busy} className="bg-teal-700 hover:bg-teal-800" onClick={() => apply(m)}>{t('con.am.sign')}</Button>
          )}
        </div>
      )}
    ]} rows={modificaciones} empty={t('common.empty')} />
  );
}
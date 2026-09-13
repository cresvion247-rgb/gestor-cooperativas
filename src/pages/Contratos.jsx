import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ConfirmDialog from '@/components/erp/ConfirmDialog';
import ContratoDialog from '@/components/contratos/ContratoDialog';
import ContratoDetailDialog from '@/components/contratos/ContratoDetailDialog';
import ModificacionDialog from '@/components/contratos/ModificacionDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { notifyCooperative } from '@/lib/notify';
import { useI18n } from '@/lib/i18n';
import { isCoopStaff } from '@/lib/permissions';
import { PIPELINE, canApproveContract } from '@/lib/contracts';
import { formatEur, formatDate } from '@/lib/format';
import { exportContratoPdf } from '@/lib/pdf';

const ESTADOS = ['todos', ...PIPELINE, 'suspendido', 'cerrado'];

export default function Contratos() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: coops = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date', 500) });
  const { data: proyectos = [] } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-created_date', 500) });
  const { data: contratos = [], isLoading } = useQuery({ queryKey: ['contratos'], queryFn: () => base44.entities.Contrato.list('-created_date', 500) });

  const [coopFilter, setCoopFilter] = useState('todas');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [dialog, setDialog] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const staff = isCoopStaff(user);
  const isOverdue = c => c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date();
  const rows = contratos.filter(c =>
    (coopFilter === 'todas' || c.cooperativa_id === coopFilter) &&
    (estadoFilter === 'todos' || c.estado === estadoFilter)
  );

  const setEstado = async (c, estado) => {
    setBusy(true);
    try {
      const payload = { estado };
      if (estado === 'activo') payload.fecha_firma = new Date().toISOString().slice(0, 10);
      await base44.entities.Contrato.update(c.id, payload);
      await logAudit({
        tenant_id: c.tenant_id,
        accion: 'contrato_estado',
        entidad_tipo: 'Contrato',
        entidad_id: c.id,
        valores_anteriores: { estado: c.estado },
        valores_nuevos: payload
      });
      if (estado === 'activo') {
        if (c.proyecto_id && c.importe_total) {
          const proyecto = proyectos.find(p => p.id === c.proyecto_id);
          if (proyecto) await base44.entities.Proyecto.update(proyecto.id, { coste_comprometido: (proyecto.coste_comprometido || 0) + c.importe_total });
        }
        qc.invalidateQueries({ queryKey: ['proyectos'] });
        await notifyCooperative({ tenant_id: c.tenant_id, tipo: 'contrato', titulo: `${t('con.title')}: ${c.titulo}`, descripcion: t('con.activated'), prioridad: 'media' });
        toast({ title: t('con.activated') });
      } else {
        toast({ title: t('con.updated') });
      }
      qc.invalidateQueries({ queryKey: ['contratos'] });
      setConfirming(null);
    } catch (e) {
      toast({ title: t('con.advanceFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  const advance = (c) => {
    const idx = PIPELINE.indexOf(c.estado);
    if (idx < 0 || idx === PIPELINE.length - 1) return;
    const next = PIPELINE[idx + 1];
    if (next === 'aprobado' && !canApproveContract(user)) {
      toast({ title: t('con.noApproval'), variant: 'destructive' });
      return;
    }
    setEstado(c, next);
  };

  // Contratos activos con modificación obligatoria: la edición directa se
  // bloquea y se enruta a registrar una modificación firmada.
  // Exportación PDF de la ficha del contrato con su histórico de
  // modificaciones; el evento queda registrado en el log de auditoría.
  const exportContract = async (c) => {
    try {
      const modificaciones = await base44.entities.ContratoModificacion.filter({ contrato_id: c.id }, '-created_date', 200);
      exportContratoPdf({
        contrato: c,
        cooperativa: coops.find(x => x.id === c.cooperativa_id),
        proyecto: proyectos.find(p => p.id === c.proyecto_id),
        modificaciones,
        t,
        st
      });
      await logAudit({ tenant_id: c.tenant_id, accion: 'pdf_exportado', entidad_tipo: 'Contrato', entidad_id: c.id, detalle: `Ficha de contrato ${c.codigo}` });
      toast({ title: t('pdf.exported') });
    } catch (e) {
      toast({ title: t('pdf.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const openEdit = (c) => {
    if (c.estado === 'activo' && c.exige_modificacion) {
      toast({ title: t('con.amendmentBlocked'), variant: 'destructive' });
      setDialog({ type: 'amend', contrato: c });
    } else {
      setDialog({ type: 'edit', contrato: c });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={t('con.eyebrow')}
        title={t('con.title')}
        description={t('con.desc')}
        action={staff ? t('con.action') : undefined}
        onAction={staff ? () => setDialog({ type: 'edit', contrato: null }) : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">{t('users.cooperative')}</label>
          <Select value={coopFilter} onValueChange={setCoopFilter}>
            <SelectTrigger className="h-9 w-[16rem] rounded-xl border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">{t('common.all')}</SelectItem>
              {coops.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">{t('common.status')}</label>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="h-9 w-[13rem] rounded-xl border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map(e => (
                <SelectItem key={e} value={e}>{e === 'todos' ? t('common.all') : st(e)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'codigo', label: t('con.col.code') },
          { key: 'titulo', label: t('con.col.contract') },
          { key: 'contraparte', label: t('con.col.counterpart') },
          { key: 'importe_total', label: t('con.col.amount'), render: v => formatEur(v, true) },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'fecha_vencimiento', label: t('con.col.expiry'), render: (v, c) => (
            <span className={isOverdue(c) ? 'font-semibold text-red-600' : ''}>{formatDate(v)}</span>
          )},
          { key: 'riesgo', label: t('common.risk'), badge: true },
          { key: 'acciones', label: '', render: (_, c) => staff ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setDialog({ type: 'detail', contrato: c })}>{t('common.manage')}</Button>
              <Button variant="outline" size="sm" onClick={() => openEdit(c)}>{t('common.edit')}</Button>
            </div>
          ) : null }
        ]} rows={rows} />
      )}
      {dialog?.type === 'edit' && <ContratoDialog contrato={dialog.contrato} cooperativas={coops} proyectos={proyectos} onClose={() => setDialog(null)} />}
      {dialog?.type === 'detail' && (
        <ContratoDetailDialog
          contrato={dialog.contrato}
          cooperativas={coops}
          proyectos={proyectos}
          onAdvance={advance}
          onLifecycle={(c, estado) => setConfirming({ contrato: c, estado })}
          onNewAmendment={c => setDialog({ type: 'amend', contrato: c })}
          onExport={exportContract}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'amend' && <ModificacionDialog contrato={dialog.contrato} onClose={() => setDialog(null)} />}
      {confirming && (
        <ConfirmDialog
          title={confirming.estado === 'suspendido' ? t('con.suspendTitle') : t('con.closeTitle')}
          description={confirming.estado === 'suspendido' ? t('con.suspendBody') : t('con.closeBody')}
          busy={busy}
          onClose={() => setConfirming(null)}
          actions={[{
            label: confirming.estado === 'suspendido' ? t('con.confirmSuspend') : t('con.confirmClose'),
            destructive: true,
            onConfirm: () => setEstado(confirming.contrato, confirming.estado)
          }]}
        />
      )}
    </>
  );
}
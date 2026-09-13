import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';

// Registro de modificación de contrato: conserva los valores anteriores del
// contrato y propone los nuevos; entra en el flujo de aprobación y firma.
export default function ModificacionDialog({ contrato, onClose }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    motivo: '',
    descripcion: '',
    importe_total_nuevo: contrato.importe_total ?? '',
    fecha_vencimiento_nueva: contrato.fecha_vencimiento || '',
    terminos_pago_nuevos: contrato.terminos_pago || ''
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.motivo) {
      toast({ title: t('con.amendmentRequired'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tenant_id: contrato.tenant_id,
        cooperativa_id: contrato.cooperativa_id,
        contrato_id: contrato.id,
        motivo: form.motivo,
        descripcion: form.descripcion || null,
        importe_total_anterior: contrato.importe_total ?? null,
        importe_total_nuevo: form.importe_total_nuevo === '' ? null : Number(form.importe_total_nuevo),
        fecha_vencimiento_anterior: contrato.fecha_vencimiento || null,
        fecha_vencimiento_nueva: form.fecha_vencimiento_nueva || null,
        terminos_pago_nuevos: form.terminos_pago_nuevos || null,
        estado: 'pendiente_aprobacion',
        fecha_solicitud: new Date().toISOString().slice(0, 10),
        solicitado_por: user?.email || null
      };
      const res = await base44.entities.ContratoModificacion.create(payload);
      await logAudit({ tenant_id: contrato.tenant_id, accion: 'contrato_modificacion_creada', entidad_tipo: 'ContratoModificacion', entidad_id: res?.id || null, valores_nuevos: payload });
      qc.invalidateQueries({ queryKey: ['modificaciones', contrato.id] });
      toast({ title: t('con.amendmentCreated') });
      onClose();
    } catch (e) {
      toast({ title: t('con.amendmentFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{t('con.amendmentTitle')} · {contrato.codigo}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('con.am.f.motivo')} *</Label>
            <Input value={form.motivo} onChange={e => set('motivo', e.target.value)} className="bg-slate-50" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('inc.f.description')}</Label>
            <Textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('con.am.f.newTotal')}</Label>
            <Input type="number" value={form.importe_total_nuevo} onChange={e => set('importe_total_nuevo', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('con.am.f.newExpiry')}</Label>
            <Input type="date" value={form.fecha_vencimiento_nueva} onChange={e => set('fecha_vencimiento_nueva', e.target.value)} className="bg-slate-50" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('con.am.f.newTerms')}</Label>
            <Input value={form.terminos_pago_nuevos} onChange={e => set('terminos_pago_nuevos', e.target.value)} className="bg-slate-50" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={saving} className="bg-[#102A43] hover:bg-[#173F5F]">{saving ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
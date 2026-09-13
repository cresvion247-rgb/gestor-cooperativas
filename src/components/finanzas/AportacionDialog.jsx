import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';

const TIPOS = ['entrada', 'periodica', 'extraordinaria', 'ajuste', 'devolucion', 'liquidacion_final'];

export default function AportacionDialog({ aportacion, cooperativas, socios, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(aportacion?.id);
  const [coopId, setCoopId] = useState(aportacion?.cooperativa_id || '');
  const [socioId, setSocioId] = useState(aportacion?.socio_id || '');
  const [form, setForm] = useState({
    tipo: aportacion?.tipo || 'entrada',
    fecha_vencimiento: aportacion?.fecha_vencimiento || '',
    importe_debido: aportacion?.importe_debido ?? '',
    referencia: aportacion?.referencia || ''
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!coopId || !socioId || !form.fecha_vencimiento || form.importe_debido === '') {
      toast({ title: t('fin.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const cooperativa = cooperativas.find(c => c.id === coopId);
      const importe = Number(form.importe_debido);
      const payload = {
        tipo: form.tipo,
        fecha_vencimiento: form.fecha_vencimiento,
        importe_debido: importe,
        referencia: form.referencia || null
      };
      if (isEdit) {
        await base44.entities.Aportacion.update(aportacion.id, payload);
        await logAudit({ tenant_id: aportacion.tenant_id, accion: 'aportacion_actualizada', entidad_tipo: 'Aportacion', entidad_id: aportacion.id, valores_nuevos: payload });
        toast({ title: t('fin.updated') });
      } else {
        payload.tenant_id = cooperativa.tenant_id;
        payload.cooperativa_id = coopId;
        payload.socio_id = socioId;
        payload.importe_pagado = 0;
        payload.importe_pendiente = importe;
        payload.estado = 'pendiente';
        const res = await base44.entities.Aportacion.create(payload);
        await logAudit({ tenant_id: cooperativa.tenant_id, accion: 'aportacion_creada', entidad_tipo: 'Aportacion', entidad_id: res?.id || null, valores_nuevos: payload });
        toast({ title: t('fin.created') });
      }
      qc.invalidateQueries({ queryKey: ['aportaciones'] });
      onClose();
    } catch (e) {
      toast({ title: isEdit ? t('fin.updateFailed') : t('fin.createFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? t('fin.editTitle') : t('fin.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="mb-1">{t('fin.f.coop')} *</Label>
            <select value={coopId} onChange={e => { setCoopId(e.target.value); setSocioId(''); }} disabled={isEdit} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm disabled:opacity-60">
              <option value="">—</option>
              {cooperativas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('fin.f.member')} *</Label>
            <select value={socioId} onChange={e => setSocioId(e.target.value)} disabled={isEdit} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm disabled:opacity-60">
              <option value="">—</option>
              {socios.filter(s => s.cooperativa_id === coopId).map(s => <option key={s.id} value={s.id}>{s.nombre_completo}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('fin.f.type')}</Label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              {TIPOS.map(tipo => <option key={tipo} value={tipo}>{st(tipo)}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('fin.col.expiry')} *</Label>
            <Input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('fin.f.due')} *</Label>
            <Input type="number" value={form.importe_debido} onChange={e => set('importe_debido', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('fin.col.reference')}</Label>
            <Input value={form.referencia} onChange={e => set('referencia', e.target.value)} className="bg-slate-50" />
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
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

export default function OfertaDialog({ licitacion, proveedores, onClose }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [proveedorId, setProveedorId] = useState('');
  const [form, setForm] = useState({ importe: '', plazo_ejecucion: '', puntuacion: '', observaciones: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!proveedorId || !form.importe) {
      toast({ title: t('lic.bidRequired'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tenant_id: licitacion.tenant_id,
        cooperativa_id: licitacion.cooperativa_id,
        licitacion_id: licitacion.id,
        proveedor_id: proveedorId,
        importe: Number(form.importe),
        plazo_ejecucion: form.plazo_ejecucion || null,
        puntuacion: form.puntuacion === '' ? null : Number(form.puntuacion),
        observaciones: form.observaciones || null,
        estado: 'presentada',
        fecha_presentacion: new Date().toISOString().slice(0, 10)
      };
      const res = await base44.entities.Oferta.create(payload);
      await logAudit({ tenant_id: licitacion.tenant_id, accion: 'oferta_registrada', entidad_tipo: 'Oferta', entidad_id: res?.id || null, valores_nuevos: payload });
      qc.invalidateQueries({ queryKey: ['ofertas'] });
      toast({ title: t('lic.bidCreated') });
      onClose();
    } catch (e) {
      toast({ title: t('lic.bidFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('lic.bidTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="mb-1">{t('lic.selectSupplier')} *</Label>
            <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              <option value="">—</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('fin.col.amount')} *</Label>
            <Input type="number" value={form.importe} onChange={e => set('importe', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('lic.f.delivery')}</Label>
            <Input value={form.plazo_ejecucion} onChange={e => set('plazo_ejecucion', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('lic.f.score')}</Label>
            <Input type="number" value={form.puntuacion} onChange={e => set('puntuacion', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('lic.f.observations')}</Label>
            <Input value={form.observaciones} onChange={e => set('observaciones', e.target.value)} className="bg-slate-50" />
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
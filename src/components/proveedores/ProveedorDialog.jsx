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

const VALORACIONES = ['', 'excelente', 'buena', 'regular', 'baja'];
const FIELDS = ['nombre', 'cif_nif', 'categoria', 'contacto_nombre', 'email', 'telefono', 'direccion', 'fecha_homologacion', 'notas'];

export default function ProveedorDialog({ proveedor, cooperativas, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(proveedor?.id);
  const [cooperativaId, setCooperativaId] = useState(proveedor?.cooperativa_id || '');
  const [valoracion, setValoracion] = useState(proveedor?.valoracion || '');
  const [form, setForm] = useState(() => {
    const base = Object.fromEntries(FIELDS.map(k => [k, '']));
    if (proveedor) FIELDS.forEach(k => { base[k] = proveedor[k] ?? ''; });
    return base;
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.nombre || !form.cif_nif || !cooperativaId) {
      toast({ title: t('prov.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const coop = cooperativas.find(c => c.id === cooperativaId);
      const payload = Object.fromEntries(FIELDS.map(k => [k, form[k] === '' ? null : form[k]]));
      payload.valoracion = valoracion || null;
      if (isEdit) {
        await base44.entities.Proveedor.update(proveedor.id, payload);
        await logAudit({ tenant_id: coop.tenant_id, accion: 'proveedor_actualizado', entidad_tipo: 'Proveedor', entidad_id: proveedor.id, valores_nuevos: payload });
        toast({ title: t('prov.updated') });
      } else {
        payload.tenant_id = coop.tenant_id;
        payload.cooperativa_id = cooperativaId;
        payload.estado = 'candidato';
        const res = await base44.entities.Proveedor.create(payload);
        await logAudit({ tenant_id: coop.tenant_id, accion: 'proveedor_creado', entidad_tipo: 'Proveedor', entidad_id: res?.id || null, valores_nuevos: payload });
        toast({ title: t('prov.created') });
      }
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      onClose();
    } catch (e) {
      toast({ title: isEdit ? t('prov.updateFailed') : t('prov.createFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  const field = (key, label, type = 'text') => (
    <div key={key}>
      <Label className="mb-1">{label}</Label>
      <Input type={type} value={form[key] || ''} onChange={e => set(key, e.target.value)} className="bg-slate-50" />
    </div>
  );

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? t('prov.editTitle') : t('prov.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('nombre', t('prov.f.name'))}
          {field('cif_nif', t('prov.f.cif'))}
          {field('categoria', t('prov.f.category'))}
          {field('contacto_nombre', t('prov.f.contact'))}
          {field('email', t('users.email'), 'email')}
          {field('telefono', t('coop.f.phone'))}
          {field('fecha_homologacion', t('prov.f.homologation'), 'date')}
          <div>
            <Label className="mb-1">{t('prov.f.rating')}</Label>
            <select value={valoracion} onChange={e => setValoracion(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              {VALORACIONES.map(v => <option key={v} value={v}>{v ? st(v) : '—'}</option>)}
            </select>
          </div>
          {field('direccion', t('coop.f.address'))}
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('coop.f.notes')}</Label>
            <Textarea value={form.notas || ''} onChange={e => set('notas', e.target.value)} rows={2} className="bg-slate-50" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('users.cooperative')} *</Label>
            <select value={cooperativaId} onChange={e => setCooperativaId(e.target.value)} disabled={isEdit} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm disabled:opacity-60">
              <option value="">—</option>
              {cooperativas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
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
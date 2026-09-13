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

const FIELDS = ['titulo', 'categoria', 'referencia', 'fecha_apertura', 'fecha_limite', 'presupuesto_base', 'requisitos', 'notas'];

export default function LicitacionDialog({ licitacion, proyectos, onClose }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(licitacion?.id);
  const [proyectoId, setProyectoId] = useState(licitacion?.proyecto_id || '');
  const [form, setForm] = useState(() => {
    const base = Object.fromEntries(FIELDS.map(k => [k, '']));
    if (licitacion) FIELDS.forEach(k => { base[k] = licitacion[k] ?? ''; });
    return base;
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.titulo || !proyectoId) {
      toast({ title: t('lic.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const proyecto = proyectos.find(p => p.id === proyectoId);
      const payload = Object.fromEntries(FIELDS.map(k => [k, form[k] === '' ? null : form[k]]));
      if (payload.presupuesto_base != null) payload.presupuesto_base = Number(payload.presupuesto_base);
      payload.proyecto_id = proyectoId;
      if (isEdit) {
        await base44.entities.Licitacion.update(licitacion.id, payload);
        await logAudit({ tenant_id: proyecto.tenant_id, accion: 'licitacion_actualizada', entidad_tipo: 'Licitacion', entidad_id: licitacion.id, valores_nuevos: payload });
        toast({ title: t('lic.updated') });
      } else {
        payload.tenant_id = proyecto.tenant_id;
        payload.cooperativa_id = proyecto.cooperativa_id;
        payload.estado = 'abierta';
        const res = await base44.entities.Licitacion.create(payload);
        await logAudit({ tenant_id: proyecto.tenant_id, accion: 'licitacion_creada', entidad_tipo: 'Licitacion', entidad_id: res?.id || null, valores_nuevos: payload });
        toast({ title: t('lic.created') });
      }
      qc.invalidateQueries({ queryKey: ['licitaciones'] });
      onClose();
    } catch (e) {
      toast({ title: isEdit ? t('lic.updateFailed') : t('lic.createFailed'), description: String(e?.message || e), variant: 'destructive' });
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
        <DialogHeader><DialogTitle>{isEdit ? t('lic.editTitle') : t('lic.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('common.project')} *</Label>
            <select value={proyectoId} onChange={e => setProyectoId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              <option value="">—</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {field('titulo', t('inc.f.title'))}
          {field('categoria', t('prov.col.category'))}
          {field('referencia', t('lic.f.ref'))}
          {field('fecha_apertura', t('lic.f.opening'), 'date')}
          {field('fecha_limite', t('urba.f.deadline'), 'date')}
          {field('presupuesto_base', t('lic.f.budget'), 'number')}
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('urba.f.requirements')}</Label>
            <Textarea value={form.requisitos || ''} onChange={e => set('requisitos', e.target.value)} rows={2} className="bg-slate-50" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('coop.f.notes')}</Label>
            <Textarea value={form.notas || ''} onChange={e => set('notas', e.target.value)} rows={2} className="bg-slate-50" />
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
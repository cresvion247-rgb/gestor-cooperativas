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

const ESTADOS = ['pre_formacion', 'activa', 'inactiva', 'cerrada'];
const FIELDS = ['nombre', 'cif', 'forma_juridica', 'direccion', 'municipio', 'provincia', 'codigo_postal', 'email', 'telefono', 'fecha_constitucion', 'administrador_urbalex', 'estado', 'notas'];
const EMPTY = Object.fromEntries(FIELDS.map(k => [k, '']));
EMPTY.estado = 'pre_formacion';

const slugify = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'coop';

// Lifecycle status changes get their own auditable action name.
const auditActionFor = (prevEstado, nextEstado) => {
  if (prevEstado === nextEstado) return 'cooperativa_actualizada';
  if (nextEstado === 'activa' && (prevEstado === 'inactiva' || prevEstado === 'cerrada')) return 'cooperativa_reactivada';
  if (nextEstado === 'inactiva') return 'cooperativa_desactivada';
  if (nextEstado === 'cerrada') return 'cooperativa_cerrada';
  return 'cooperativa_actualizada';
};

export default function CooperativaDialog({ cooperativa, existingTenantIds = [], canChangeStatus = true, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(cooperativa?.id);
  const [form, setForm] = useState(() => {
    if (!cooperativa) return { ...EMPTY };
    const f = { ...EMPTY };
    FIELDS.forEach(k => { f[k] = cooperativa[k] ?? ''; });
    return f;
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.nombre || !form.cif) {
      toast({ title: t('coop.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(FIELDS.map(k => [k, form[k] === '' ? null : form[k]]));
      if (isEdit && !canChangeStatus) payload.estado = cooperativa.estado;
      if (isEdit) {
        await base44.entities.Cooperativa.update(cooperativa.id, payload);
        const valores_anteriores = Object.fromEntries(FIELDS.map(k => [k, cooperativa[k] ?? null]));
        await logAudit({
          tenant_id: cooperativa.tenant_id,
          accion: auditActionFor(cooperativa.estado, payload.estado),
          entidad_tipo: 'Cooperativa',
          entidad_id: cooperativa.id,
          valores_anteriores,
          valores_nuevos: payload
        });
        toast({ title: t('coop.updated') });
      } else {
        let tenant_id = slugify(form.nombre);
        let n = 2;
        while (existingTenantIds.includes(tenant_id)) tenant_id = `${slugify(form.nombre)}-${n++}`;
        const res = await base44.entities.Cooperativa.create({ ...payload, tenant_id });
        await logAudit({ tenant_id, accion: 'cooperativa_creada', entidad_tipo: 'Cooperativa', entidad_id: res?.id || null, valores_nuevos: { ...payload, tenant_id } });
        toast({ title: t('coop.created') });
      }
      qc.invalidateQueries({ queryKey: ['cooperativas'] });
      onClose();
    } catch (e) {
      toast({ title: isEdit ? t('coop.updateFailed') : t('coop.createFailed'), description: String(e?.message || e), variant: 'destructive' });
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
        <DialogHeader><DialogTitle>{isEdit ? t('coop.editTitle') : t('coop.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('nombre', t('coop.f.name'))}
          {field('cif', t('coop.col.cif'))}
          {field('forma_juridica', t('coop.f.legalForm'))}
          {field('fecha_constitucion', t('coop.f.constitution'), 'date')}
          {field('administrador_urbalex', t('coop.f.manager'))}
          {field('email', t('users.email'), 'email')}
          {field('telefono', t('coop.f.phone'))}
          {field('direccion', t('coop.f.address'))}
          {field('municipio', t('coop.col.municipality'))}
          {field('provincia', t('coop.f.province'))}
          {field('codigo_postal', t('coop.f.postalCode'))}
          <div>
            <Label className="mb-1">{t('common.status')}</Label>
            <select value={form.estado} onChange={e => set('estado', e.target.value)} disabled={!canChangeStatus} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm disabled:opacity-60">
              {ESTADOS.map(e => <option key={e} value={e}>{st(e)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('coop.f.notes')}</Label>
            <Textarea value={form.notas || ''} onChange={e => set('notas', e.target.value)} rows={3} className="bg-slate-50" />
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
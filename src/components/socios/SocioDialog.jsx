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

const ESTADOS = ['candidato', 'activo', 'lista_espera', 'baja', 'completado'];
const FIELDS = ['nombre_completo', 'dni_nie', 'email', 'telefono', 'direccion', 'fecha_admision', 'referencia_pago', 'preferencia_comunicacion'];

// Lifecycle status changes get their own auditable action name.
const auditActionFor = (prev, next) => {
  if (prev === next) return 'socio_actualizado';
  if (next === 'activo') return 'socio_admitido';
  if (next === 'baja') return 'socio_baja';
  return 'socio_actualizado';
};

export default function SocioDialog({ socio, cooperativas, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(socio?.id);
  const [cooperativaId, setCooperativaId] = useState(socio?.cooperativa_id || '');
  const [form, setForm] = useState(() => {
    const base = { estado: 'candidato', ...Object.fromEntries(FIELDS.map(k => [k, ''])) };
    if (socio) {
      FIELDS.forEach(k => { base[k] = socio[k] ?? ''; });
      base.estado = socio.estado;
    }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.nombre_completo || !form.dni_nie || !cooperativaId) {
      toast({ title: t('soc.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const coop = cooperativas.find(c => c.id === cooperativaId);
      const payload = Object.fromEntries(FIELDS.map(k => [k, form[k] === '' ? null : form[k]]));
      payload.estado = form.estado;
      if (isEdit) {
        await base44.entities.Socio.update(socio.id, payload);
        await logAudit({
          tenant_id: coop?.tenant_id,
          accion: auditActionFor(socio.estado, form.estado),
          entidad_tipo: 'Socio',
          entidad_id: socio.id,
          valores_anteriores: Object.fromEntries([...FIELDS, 'estado'].map(k => [k, socio[k] ?? null])),
          valores_nuevos: payload
        });
        toast({ title: t('soc.updated') });
      } else {
        payload.tenant_id = coop.tenant_id;
        payload.cooperativa_id = cooperativaId;
        const res = await base44.entities.Socio.create(payload);
        await logAudit({ tenant_id: coop.tenant_id, accion: 'socio_creado', entidad_tipo: 'Socio', entidad_id: res?.id || null, valores_nuevos: payload });
        toast({ title: t('soc.created') });
      }
      qc.invalidateQueries({ queryKey: ['socios'] });
      onClose();
    } catch (e) {
      toast({ title: isEdit ? t('soc.updateFailed') : t('soc.createFailed'), description: String(e?.message || e), variant: 'destructive' });
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
        <DialogHeader><DialogTitle>{isEdit ? t('soc.editTitle') : t('soc.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('nombre_completo', t('intake.fullName'))}
          {field('dni_nie', t('intake.dni'))}
          <div>
            <Label className="mb-1">{t('users.cooperative')}</Label>
            <select value={cooperativaId} onChange={e => setCooperativaId(e.target.value)} disabled={isEdit} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm disabled:opacity-60">
              <option value="">—</option>
              {cooperativas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('common.status')}</Label>
            <select value={form.estado} onChange={e => set('estado', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              {ESTADOS.map(e => <option key={e} value={e}>{st(e)}</option>)}
            </select>
          </div>
          {field('fecha_admision', t('portal.memberSince'), 'date')}
          {field('email', t('users.email'), 'email')}
          {field('telefono', t('coop.f.phone'))}
          {field('referencia_pago', t('soc.f.paymentRef'))}
          {field('direccion', t('coop.f.address'))}
          {field('preferencia_comunicacion', t('soc.f.commPref'))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={saving} className="bg-[#102A43] hover:bg-[#173F5F]">{saving ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
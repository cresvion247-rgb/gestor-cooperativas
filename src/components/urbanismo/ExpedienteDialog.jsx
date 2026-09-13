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
import { notifyCooperative } from '@/lib/notify';

const RIESGOS = ['', 'bajo', 'medio', 'alto', 'critico'];
const FIELDS = ['tipo', 'administracion', 'referencia_oficial', 'estado', 'fecha_presentacion', 'fecha_limite', 'responsable', 'riesgo', 'requisitos', 'notas'];
const DEADLINE_WINDOW_DAYS = 15;

export default function ExpedienteDialog({ expediente, proyectos, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(expediente?.id);
  const [proyectoId, setProyectoId] = useState(expediente?.proyecto_id || '');
  const [form, setForm] = useState(() => {
    const base = Object.fromEntries(FIELDS.map(k => [k, '']));
    if (expediente) FIELDS.forEach(k => { base[k] = expediente[k] ?? ''; });
    return base;
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Plazos vencidos o próximos generan una alerta visible en el panel de la cooperativa.
  const raiseDeadlineAlert = async (payload, tenant_id) => {
    if (!payload.fecha_limite) return false;
    const days = Math.ceil((new Date(payload.fecha_limite) - new Date()) / 86400000);
    if (days >= 0 && days > DEADLINE_WINDOW_DAYS) return false;
    await notifyCooperative({
      tenant_id,
      tipo: 'urbanismo',
      titulo: `${t('urba.title')}: ${payload.tipo}`,
      descripcion: `${payload.referencia_oficial || ''} — ${days < 0 ? t('urba.deadlineOverdue') : t('urba.deadlineSoon')}`,
      prioridad: days < 0 ? 'critica' : 'alta'
    });
    return true;
  };

  const save = async () => {
    if (!form.tipo || !proyectoId) {
      toast({ title: t('urba.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const proyecto = proyectos.find(p => p.id === proyectoId);
      const payload = Object.fromEntries(FIELDS.map(k => [k, form[k] === '' ? null : form[k]]));
      payload.proyecto_id = proyectoId;
      if (isEdit) {
        await base44.entities.ExpedienteUrbanistico.update(expediente.id, payload);
        await logAudit({
          tenant_id: proyecto.tenant_id,
          accion: 'expediente_urbanistico_actualizado',
          entidad_tipo: 'ExpedienteUrbanistico',
          entidad_id: expediente.id,
          valores_anteriores: Object.fromEntries(FIELDS.map(k => [k, expediente[k] ?? null])),
          valores_nuevos: payload
        });
        toast({ title: t('urba.updated') });
      } else {
        payload.tenant_id = proyecto.tenant_id;
        if (!payload.estado) payload.estado = 'en_tramite';
        const res = await base44.entities.ExpedienteUrbanistico.create(payload);
        await logAudit({ tenant_id: proyecto.tenant_id, accion: 'expediente_urbanistico_creado', entidad_tipo: 'ExpedienteUrbanistico', entidad_id: res?.id || null, valores_nuevos: payload });
        toast({ title: t('urba.created') });
      }
      if (await raiseDeadlineAlert(payload, proyecto.tenant_id)) toast({ title: t('urba.alertRaised') });
      qc.invalidateQueries({ queryKey: ['expedientes'] });
      onClose();
    } catch (e) {
      toast({ title: isEdit ? t('urba.updateFailed') : t('urba.createFailed'), description: String(e?.message || e), variant: 'destructive' });
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
        <DialogHeader><DialogTitle>{isEdit ? t('urba.editTitle') : t('urba.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('common.project')}</Label>
            <select value={proyectoId} onChange={e => setProyectoId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              <option value="">—</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {field('tipo', t('urba.f.type'))}
          {field('administracion', t('urba.f.agency'))}
          {field('referencia_oficial', t('urba.f.ref'))}
          {field('estado', t('urba.f.status'))}
          {field('fecha_presentacion', t('urba.f.submission'), 'date')}
          {field('fecha_limite', t('urba.f.deadline'), 'date')}
          {field('responsable', t('urba.col.responsible'))}
          <div>
            <Label className="mb-1">{t('common.risk')}</Label>
            <select value={form.riesgo || ''} onChange={e => set('riesgo', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              {RIESGOS.map(r => <option key={r} value={r}>{r ? st(r) : '—'}</option>)}
            </select>
          </div>
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
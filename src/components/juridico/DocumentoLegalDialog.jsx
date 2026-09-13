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

const VISIBILIDADES = ['todos', 'interno', 'consejo_rector'];
const ESTADOS = ['activo', 'archivado', 'caducado'];
const FIELDS = ['titulo', 'tipo', 'referencia', 'fecha_documento', 'visibilidad', 'resumen'];

// Los documentos legales nunca se eliminan: se archivan o caducan, y cada
// cambio de estado queda registrado con su propia acción de auditoría.
const auditActionFor = (prev, next) => {
  if (prev === next) return 'documento_legal_actualizado';
  if (next === 'archivado') return 'documento_legal_archivado';
  if (next === 'caducado') return 'documento_legal_caducado';
  return 'documento_legal_actualizado';
};

export default function DocumentoLegalDialog({ documento, cooperativas, proyectos, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(documento?.id);
  const [cooperativaId, setCooperativaId] = useState(documento?.cooperativa_id || '');
  const [proyectoId, setProyectoId] = useState(documento?.proyecto_id || '');
  const [form, setForm] = useState(() => {
    const base = { visibilidad: 'todos', estado: 'activo', ...Object.fromEntries(FIELDS.map(k => [k, ''])) };
    if (documento) {
      FIELDS.forEach(k => { base[k] = documento[k] ?? ''; });
      base.visibilidad = documento.visibilidad || 'todos';
      base.estado = documento.estado || 'activo';
    }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.titulo || !form.tipo || !cooperativaId) {
      toast({ title: t('leg.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const coop = cooperativas.find(c => c.id === cooperativaId);
      const payload = Object.fromEntries(FIELDS.map(k => [k, form[k] === '' ? null : form[k]]));
      payload.cooperativa_id = cooperativaId;
      payload.proyecto_id = proyectoId || null;
      payload.estado = form.estado;
      if (isEdit) {
        await base44.entities.DocumentoLegal.update(documento.id, payload);
        await logAudit({
          tenant_id: coop.tenant_id,
          accion: auditActionFor(documento.estado, form.estado),
          entidad_tipo: 'DocumentoLegal',
          entidad_id: documento.id,
          valores_anteriores: { estado: documento.estado, visibilidad: documento.visibilidad },
          valores_nuevos: { estado: form.estado, visibilidad: form.visibilidad }
        });
        toast({ title: t('leg.updated') });
      } else {
        payload.tenant_id = coop.tenant_id;
        const res = await base44.entities.DocumentoLegal.create(payload);
        await logAudit({ tenant_id: coop.tenant_id, accion: 'documento_legal_creado', entidad_tipo: 'DocumentoLegal', entidad_id: res?.id || null, valores_nuevos: payload });
        toast({ title: t('leg.created') });
      }
      qc.invalidateQueries({ queryKey: ['documentos_legales'] });
      onClose();
    } catch (e) {
      toast({ title: isEdit ? t('leg.updateFailed') : t('leg.createFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  const field = (key, label, type = 'text') => (
    <div key={key}>
      <Label className="mb-1">{label}</Label>
      <Input type={type} value={form[key] || ''} onChange={e => set(key, e.target.value)} className="bg-slate-50" />
    </div>
  );

  const coopProyectos = proyectos.filter(p => p.cooperativa_id === cooperativaId);

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? t('leg.editTitle') : t('leg.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('titulo', t('inc.f.title'))}
          {field('tipo', t('leg.f.type'))}
          {field('referencia', t('leg.f.ref'))}
          {field('fecha_documento', t('leg.f.date'), 'date')}
          <div>
            <Label className="mb-1">{t('users.cooperative')}</Label>
            <select value={cooperativaId} onChange={e => { setCooperativaId(e.target.value); setProyectoId(''); }} disabled={isEdit} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm disabled:opacity-60">
              <option value="">—</option>
              {cooperativas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('common.project')}</Label>
            <select value={proyectoId} onChange={e => setProyectoId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              <option value="">—</option>
              {coopProyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('leg.f.visibility')}</Label>
            <select value={form.visibilidad} onChange={e => set('visibilidad', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              {VISIBILIDADES.map(v => <option key={v} value={v}>{t(`vis.${v}`)}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('common.status')}</Label>
            <select value={form.estado} onChange={e => set('estado', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              {ESTADOS.map(e => <option key={e} value={e}>{st(e)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('leg.f.summary')}</Label>
            <Textarea value={form.resumen || ''} onChange={e => set('resumen', e.target.value)} rows={3} className="bg-slate-50" />
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
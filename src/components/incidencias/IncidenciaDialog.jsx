import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { uploadPublicFile } from '@/api/storage';
import { useI18n } from '@/lib/i18n';
import { logAudit } from '@/lib/audit';
import { emailMember } from '@/lib/notify';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIAS = ['estructura', 'areas_comunes', 'instalaciones', 'acabados', 'otra'];
const PRIORIDADES = ['baja', 'media', 'alta', 'critica'];
const ESTADOS = ['abierta', 'en_gestion', 'resuelta', 'cerrada'];

export default function IncidenciaDialog({ incidencia, staff, cooperativa, socioId, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(incidencia?.id);
  const [form, setForm] = useState(() => ({
    titulo: incidencia?.titulo || '',
    descripcion: incidencia?.descripcion || '',
    categoria: incidencia?.categoria || 'otra',
    prioridad: incidencia?.prioridad || 'media',
    estado: incidencia?.estado || 'abierta',
    asignado_a: incidencia?.asignado_a || '',
    resolucion: incidencia?.resolucion || ''
  }));
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.titulo.trim()) return toast({ title: t('intake.required'), variant: 'destructive' });
    setSaving(true);
    try {
      if (!isEdit) {
        if (!cooperativa) throw new Error(t('sup.noCoop'));
        let foto_url = null;
        if (file) {
          const r = await uploadPublicFile({ file, tenant_id: cooperativa.tenant_id });
          foto_url = r?.file_url || null;
        }
        const res = await base44.entities.Incidencia.create({
          tenant_id: cooperativa.tenant_id,
          cooperativa_id: cooperativa.id,
          socio_id: socioId || null,
          titulo: form.titulo,
          descripcion: form.descripcion || null,
          categoria: form.categoria,
          prioridad: form.prioridad,
          estado: 'abierta',
          foto_url
        });
        await logAudit({
          tenant_id: cooperativa.tenant_id,
          accion: 'incidencia_registrada',
          entidad_tipo: 'Incidencia',
          entidad_id: res.id,
          valores_nuevos: { titulo: form.titulo, categoria: form.categoria, prioridad: form.prioridad }
        });
        toast({ title: t('inc.created') });
      } else {
        const payload = { estado: form.estado, asignado_a: form.asignado_a || null, resolucion: form.resolucion || null };
        if (['resuelta', 'cerrada'].includes(form.estado)) payload.fecha_resolucion = new Date().toISOString().slice(0, 10);
        await base44.entities.Incidencia.update(incidencia.id, payload);
        await logAudit({
          tenant_id: incidencia.tenant_id,
          accion: 'incidencia_actualizada',
          entidad_tipo: 'Incidencia',
          entidad_id: incidencia.id,
          valores_anteriores: { estado: incidencia.estado, asignado_a: incidencia.asignado_a, resolucion: incidencia.resolucion },
          valores_nuevos: payload
        });
        if (form.estado !== incidencia.estado && incidencia.socio_id) {
          try {
            const socio = await base44.entities.Socio.get(incidencia.socio_id);
            if (socio?.email) {
              await emailMember({ to_email: socio.email, asunto: t('inc.resolvedEmailSubject'), cuerpo: `${incidencia.titulo}: ${st(form.estado)}` });
            }
          } catch (e) { /* degradación: el registro ya está actualizado */ }
        }
        toast({ title: t('inc.updated') });
      }
      qc.invalidateQueries({ queryKey: ['incidencias'] });
      onClose();
    } catch (e) {
      toast({ title: isEdit ? t('inc.updateFailed') : t('inc.createFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  const sel = (key, label, options, valueKey = false) => (
    <div>
      <Label className="mb-1">{label}</Label>
      <select value={form[key]} onChange={e => set(key, e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
        {options.map(o => <option key={o} value={o}>{valueKey ? t(o) : st(o)}</option>)}
      </select>
    </div>
  );

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? t('inc.manageTitle') : t('inc.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          {isEdit ? (
            <>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{incidencia.titulo}</p>
                {incidencia.descripcion && <p className="mt-1 text-xs text-slate-500">{incidencia.descripcion}</p>}
                {incidencia.foto_url && <a href={incidencia.foto_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#2C90A6] hover:underline">{t('inc.viewPhoto')}</a>}
              </div>
              {sel('estado', t('common.status'), ESTADOS)}
              <div><Label className="mb-1">{t('inc.f.assigned')}</Label><Input value={form.asignado_a} onChange={e => set('asignado_a', e.target.value)} className="bg-slate-50" /></div>
              <div><Label className="mb-1">{t('inc.f.resolution')}</Label><Textarea value={form.resolucion} onChange={e => set('resolucion', e.target.value)} rows={3} className="bg-slate-50" /></div>
            </>
          ) : (
            <>
              <div><Label className="mb-1">{t('inc.f.title')}</Label><Input value={form.titulo} onChange={e => set('titulo', e.target.value)} className="bg-slate-50" /></div>
              <div><Label className="mb-1">{t('inc.f.description')}</Label><Textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3} className="bg-slate-50" /></div>
              {sel('categoria', t('inc.f.category'), CATEGORIAS)}
              {sel('prioridad', t('inc.f.priority'), PRIORIDADES)}
              <div><Label className="mb-1">{t('inc.f.photo')}</Label><Input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="bg-slate-50" /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={saving} className="bg-[#102A43] hover:bg-[#173F5F]">{saving ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
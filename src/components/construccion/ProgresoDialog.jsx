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

const RIESGOS = ['bajo', 'medio', 'alto', 'critico'];

// Actualización del avance de obra de una promoción: progreso real, coste
// real, fecha estimada de fin y riesgo. Todo queda reflejado en auditoría.
export default function ProgresoDialog({ proyecto, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    progreso_real: proyecto.progreso_real ?? '',
    coste_real: proyecto.coste_real ?? '',
    fin_estimado: proyecto.fin_estimado || '',
    riesgo: proyecto.riesgo || 'bajo'
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const progreso = form.progreso_real === '' ? null : Math.max(0, Math.min(100, Number(form.progreso_real)));
      const payload = {
        progreso_real: progreso,
        coste_real: form.coste_real === '' ? null : Number(form.coste_real),
        fin_estimado: form.fin_estimado || null,
        riesgo: form.riesgo
      };
      await base44.entities.Proyecto.update(proyecto.id, payload);
      await logAudit({ tenant_id: proyecto.tenant_id, accion: 'proyecto_avance_actualizado', entidad_tipo: 'Proyecto', entidad_id: proyecto.id, valores_anteriores: { progreso_real: proyecto.progreso_real, coste_real: proyecto.coste_real, riesgo: proyecto.riesgo }, valores_nuevos: payload });
      qc.invalidateQueries({ queryKey: ['proyectos'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: t('constr.updated') });
      onClose();
    } catch (e) {
      toast({ title: t('constr.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('constr.updateTitle')} · {proyecto.nombre}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="mb-1">{t('constr.f.progress')}</Label>
            <Input type="number" value={form.progreso_real} onChange={e => set('progreso_real', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('constr.f.cost')}</Label>
            <Input type="number" value={form.coste_real} onChange={e => set('coste_real', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('constr.f.end')}</Label>
            <Input type="date" value={form.fin_estimado} onChange={e => set('fin_estimado', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('common.risk')}</Label>
            <select value={form.riesgo} onChange={e => set('riesgo', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              {RIESGOS.map(r => <option key={r} value={r}>{st(r)}</option>)}
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
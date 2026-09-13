import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/lib/i18n';

const PRIORIDADES = ['baja', 'media', 'alta', 'critica'];

// Difusión de una comunicación a toda la cooperativa: crea la alerta en la
// app y (desde la página que llama) dispara el email a los usuarios.
export default function ComunicacionDialog({ cooperativas, onSave, onClose }) {
  const { t, st } = useI18n();
  const { toast } = useToast();
  const [coopId, setCoopId] = useState('');
  const [form, setForm] = useState({ titulo: '', descripcion: '', prioridad: 'media', fecha_limite: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!coopId || !form.titulo) {
      toast({ title: t('comm.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    const cooperativa = cooperativas.find(c => c.id === coopId);
    await onSave({
      tenant_id: cooperativa.tenant_id,
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      prioridad: form.prioridad,
      fecha_limite: form.fecha_limite || null
    });
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('comm.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="mb-1">{t('users.cooperative')} *</Label>
            <Select value={coopId || undefined} onValueChange={setCoopId}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {cooperativas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1">{t('inc.f.title')} *</Label>
            <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('sup.f.message')}</Label>
            <Textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3} className="bg-slate-50" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1">{t('comm.f.priority')}</Label>
              <Select value={form.prioridad} onValueChange={v => set('prioridad', v)}>
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map(p => (
                    <SelectItem key={p} value={p}>{st(({ baja: 'bajo', media: 'medio', alta: 'alto', critica: 'critico' })[p] || p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1">{t('common.deadline')}</Label>
              <Input type="date" value={form.fecha_limite} onChange={e => set('fecha_limite', e.target.value)} className="bg-slate-50" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={saving} className="bg-[#102A43] hover:bg-[#173F5F]">{saving ? t('common.saving') : t('comm.action')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
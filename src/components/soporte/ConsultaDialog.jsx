import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { logAudit } from '@/lib/audit';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIAS = ['juridica', 'financiera', 'construccion', 'secretaria'];

export default function ConsultaDialog({ cooperativa, socioId, onClose }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ categoria: 'secretaria', asunto: '', mensaje: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.asunto.trim() || !form.mensaje.trim()) return toast({ title: t('intake.required'), variant: 'destructive' });
    if (!cooperativa) return toast({ title: t('sup.createFailed'), description: t('sup.noCoop'), variant: 'destructive' });
    setSaving(true);
    try {
      const res = await base44.entities.Consulta.create({
        tenant_id: cooperativa.tenant_id,
        cooperativa_id: cooperativa.id,
        socio_id: socioId || null,
        solicitante_email: user?.email || null,
        categoria: form.categoria,
        asunto: form.asunto,
        mensaje: form.mensaje,
        origen: 'portal',
        estado: 'abierta'
      });
      await logAudit({
        tenant_id: cooperativa.tenant_id,
        accion: 'consulta_creada',
        entidad_tipo: 'Consulta',
        entidad_id: res.id,
        valores_nuevos: { asunto: form.asunto, categoria: form.categoria, solicitante_email: user?.email }
      });
      qc.invalidateQueries({ queryKey: ['mis-consultas'] });
      toast({ title: t('sup.created') });
      onClose();
    } catch (e) {
      toast({ title: t('sup.createFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('sup.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="mb-1">{t('sup.f.category')}</Label>
            <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              {CATEGORIAS.map(c => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
            </select>
          </div>
          <div><Label className="mb-1">{t('sup.f.subject')}</Label><Input value={form.asunto} onChange={e => set('asunto', e.target.value)} className="bg-slate-50" /></div>
          <div><Label className="mb-1">{t('sup.f.message')}</Label><Textarea value={form.mensaje} onChange={e => set('mensaje', e.target.value)} rows={4} className="bg-slate-50" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={saving} className="bg-[#102A43] hover:bg-[#173F5F]">{saving ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
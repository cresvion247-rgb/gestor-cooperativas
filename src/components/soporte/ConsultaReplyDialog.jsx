import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { logAudit } from '@/lib/audit';
import { emailMember } from '@/lib/notify';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

const ESTADOS = ['abierta', 'en_gestion', 'resuelta', 'cerrada'];

export default function ConsultaReplyDialog({ consulta, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [estado, setEstado] = useState(consulta.estado === 'abierta' ? 'en_gestion' : consulta.estado);
  const [respuesta, setRespuesta] = useState(consulta.respuesta || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!respuesta.trim()) return toast({ title: t('intake.required'), variant: 'destructive' });
    setSaving(true);
    try {
      const payload = { estado, respuesta };
      await base44.entities.Consulta.update(consulta.id, payload);
      await logAudit({
        tenant_id: consulta.tenant_id,
        accion: 'consulta_respondida',
        entidad_tipo: 'Consulta',
        entidad_id: consulta.id,
        valores_anteriores: { estado: consulta.estado },
        valores_nuevos: payload
      });
      if (consulta.solicitante_email) {
        await emailMember({ to_email: consulta.solicitante_email, asunto: `${t('inbox.replyEmailSubject')}: ${consulta.asunto}`, cuerpo: respuesta });
      }
      qc.invalidateQueries({ queryKey: ['consultas'] });
      toast({ title: t('inbox.replied') });
      onClose();
    } catch (e) {
      toast({ title: t('inbox.replyFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('inbox.replyTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">{consulta.asunto}</p>
            <p className="mt-1 text-xs text-slate-500">{consulta.solicitante_email || '—'} · {t(`cat.${consulta.categoria}`)}</p>
            {consulta.mensaje && <p className="mt-2 whitespace-pre-line text-xs text-slate-600">{consulta.mensaje}</p>}
          </div>
          <div>
            <Label className="mb-1">{t('common.status')}</Label>
            <select value={estado} onChange={e => setEstado(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              {ESTADOS.map(e => <option key={e} value={e}>{st(e)}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('inbox.f.reply')}</Label>
            <Textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} rows={4} className="bg-slate-50" />
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
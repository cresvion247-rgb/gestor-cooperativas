import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/lib/i18n';
import { logAudit } from '@/lib/audit';
import { notifyCooperative } from '@/lib/notify';

const DOC_TYPES = ['dni_nie', 'justificante_ingresos', 'declaracion_jurada', 'contrato_firmado', 'otro'];

export default function SolicitarDocumentosDialog({ socios, cooperativas, onClose }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [socioId, setSocioId] = useState('');
  const [selected, setSelected] = useState(() => new Set(['dni_nie', 'justificante_ingresos']));
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);

  const socio = useMemo(() => socios.find(s => s.id === socioId), [socios, socioId]);
  const coop = useMemo(
    () => cooperativas.find(c => c.id === socio?.cooperativa_id),
    [cooperativas, socio],
  );

  const toggle = (tipo) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  };

  const save = async () => {
    if (!socio || !coop) {
      toast({ title: t('doc.requestNeedMember'), variant: 'destructive' });
      return;
    }
    if (!selected.size) {
      toast({ title: t('doc.requestNeedTypes'), variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const tipos = [...selected];
      for (const tipo of tipos) {
        const payload = {
          tenant_id: coop.tenant_id,
          cooperativa_id: coop.id,
          socio_id: socio.id,
          tipo,
          nombre: nota ? `${t('doc.' + tipo)} — ${nota.slice(0, 80)}` : t('doc.' + tipo),
          file_uri: null,
          estado: 'solicitado',
          subido_por_email: null,
        };
        const res = await base44.entities.DocumentoSocio.create(payload);
        await logAudit({
          tenant_id: coop.tenant_id,
          accion: 'documento_socio_solicitado',
          entidad_tipo: 'DocumentoSocio',
          entidad_id: res?.id || null,
          valores_nuevos: payload,
        });
      }
      await notifyCooperative({
        tenant_id: coop.tenant_id,
        tipo: 'documento',
        titulo: t('doc.requestAlertTitle'),
        descripcion: t('doc.requestAlertBody').replace('{name}', socio.nombre_completo || socio.email || ''),
        prioridad: 'media',
      });
      qc.invalidateQueries({ queryKey: ['documentosSocio'] });
      toast({ title: t('doc.requestSent') });
      onClose();
    } catch (e) {
      toast({ title: t('doc.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('doc.requestTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">{t('doc.requestHint')}</p>
        <div className="mt-4 space-y-4">
          <div>
            <Label className="mb-1">{t('fin.col.member')}</Label>
            <Select value={socioId || undefined} onValueChange={setSocioId}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {socios.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre_completo || s.email || s.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">{t('doc.requestChecklist')}</Label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {DOC_TYPES.map(tipo => (
                <label key={tipo} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-700"
                    checked={selected.has(tipo)}
                    onChange={() => toggle(tipo)}
                  />
                  {t('doc.' + tipo)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1">{t('doc.requestNote')}</Label>
            <Textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} className="rounded-xl bg-slate-50" placeholder={t('doc.requestNotePh')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('users.cancel')}</Button>
          <Button onClick={save} disabled={busy} className="bg-[#102A43] hover:bg-[#173F5F]">
            {busy ? t('users.saving') : t('doc.requestSend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

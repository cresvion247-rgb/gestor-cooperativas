import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { uploadPrivateFile } from '@/api/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { logAudit } from '@/lib/audit';

const DOC_TYPES = ['dni_nie', 'justificante_ingresos', 'declaracion_jurada', 'contrato_firmado', 'otro'];

/**
 * Upload or fulfill a requested DocumentoSocio.
 * - request: existing row with estado=solicitado (updates file + estado=subido)
 * - else: creates a new DocumentoSocio for socio
 */
export default function UploadDocumentoDialog({ socio, cooperativa, request = null, onClose }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tipo, setTipo] = useState(request?.tipo || 'dni_nie');
  const [nombre, setNombre] = useState(request?.nombre || '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const coop = cooperativa;
  const lockedTipo = Boolean(request);

  const title = useMemo(
    () => (request ? t('doc.uploadFulfillTitle') : t('doc.uploadTitle')),
    [request, t],
  );

  const save = async () => {
    if (!socio || !coop?.tenant_id) {
      toast({ title: t('doc.uploadNeedSocio'), variant: 'destructive' });
      return;
    }
    if (!file) {
      toast({ title: t('doc.uploadNeedFile'), variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { file_uri } = await uploadPrivateFile({
        file,
        tenant_id: coop.tenant_id,
        socio_id: socio.id,
      });
      const payload = {
        file_uri,
        estado: 'subido',
        subido_por_email: user?.email || null,
        nombre: (nombre || '').trim() || t('doc.' + tipo),
        motivo_rechazo: null,
      };

      if (request?.id) {
        await base44.entities.DocumentoSocio.update(request.id, payload);
        await logAudit({
          tenant_id: coop.tenant_id,
          accion: 'documento_socio_cumplimentado',
          entidad_tipo: 'DocumentoSocio',
          entidad_id: request.id,
          valores_anteriores: { estado: request.estado },
          valores_nuevos: payload,
        });
      } else {
        const created = await base44.entities.DocumentoSocio.create({
          tenant_id: coop.tenant_id,
          cooperativa_id: coop.id,
          socio_id: socio.id,
          tipo,
          ...payload,
        });
        await logAudit({
          tenant_id: coop.tenant_id,
          accion: 'documento_socio_subido',
          entidad_tipo: 'DocumentoSocio',
          entidad_id: created?.id || null,
          valores_nuevos: { tipo, ...payload },
        });
      }

      qc.invalidateQueries({ queryKey: ['documentosSocio'] });
      qc.invalidateQueries({ queryKey: ['portal-docs'] });
      toast({ title: t('doc.uploaded') });
      onClose();
    } catch (e) {
      toast({ title: t('doc.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1">{t('fin.f.type')}</Label>
            {lockedTipo ? (
              <p className="text-sm font-medium text-slate-800">{t('doc.' + tipo)}</p>
            ) : (
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(x => (
                    <SelectItem key={x} value={x}>{t('doc.' + x)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="mb-1">{t('inc.f.title')}</Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} className="bg-slate-50" placeholder={t('doc.' + tipo)} />
          </div>
          <div>
            <Label className="mb-1">{t('doc.uploadFile')}</Label>
            <Input type="file" accept=".pdf,image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="bg-slate-50" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('users.cancel')}</Button>
          <Button onClick={save} disabled={busy} className="bg-[#102A43] hover:bg-[#173F5F]">
            {busy ? t('users.saving') : t('doc.uploadAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

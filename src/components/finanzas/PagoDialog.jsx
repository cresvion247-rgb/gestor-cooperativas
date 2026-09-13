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
import { formatEur, formatDate } from '@/lib/format';
import { importePendiente, estadoAfterPayment } from '@/lib/finance';

export default function PagoDialog({ aportacion, socio, onClose }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const pendiente = importePendiente(aportacion);
  const [importe, setImporte] = useState(String(pendiente));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amount = Number(importe);
    if (!amount || amount <= 0 || amount > pendiente + 0.001) {
      toast({ title: t('fin.payExceeds'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const nuevoPagado = (aportacion.importe_pagado || 0) + amount;
      const nuevoPendiente = Math.max(0, (aportacion.importe_debido || 0) - nuevoPagado);
      const payload = {
        importe_pagado: nuevoPagado,
        importe_pendiente: nuevoPendiente,
        estado: estadoAfterPayment(aportacion, nuevoPagado)
      };
      await base44.entities.Aportacion.update(aportacion.id, payload);
      await logAudit({
        tenant_id: aportacion.tenant_id,
        accion: 'pago_registrado',
        entidad_tipo: 'Aportacion',
        entidad_id: aportacion.id,
        valores_anteriores: { importe_pagado: aportacion.importe_pagado || 0, estado: aportacion.estado },
        valores_nuevos: { ...payload, pago: amount }
      });
      qc.invalidateQueries({ queryKey: ['aportaciones'] });
      toast({ title: t('fin.paid') });
      onClose();
    } catch (e) {
      toast({ title: t('fin.payFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('fin.payTitle')}</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-500">
          {socio?.nombre_completo || aportacion.referencia || '—'} · {formatEur(aportacion.importe_debido, true)} · {formatDate(aportacion.fecha_vencimiento)}
        </p>
        <p className="text-sm text-slate-500">{t('fin.payBody')}</p>
        <div>
          <Label className="mb-1">{t('fin.f.payment')} ({t('fin.col.pending')}: {formatEur(pendiente, true)})</Label>
          <Input type="number" value={importe} onChange={e => setImporte(e.target.value)} className="bg-slate-50" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={saving} className="bg-teal-700 hover:bg-teal-800">{saving ? t('common.saving') : t('fin.pay')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
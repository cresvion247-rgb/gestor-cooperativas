import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/lib/i18n';
import { formatEur } from '@/lib/format';

// Adjudicación de licitación: solo ofertas de proveedores homologados;
// al confirmar se genera la solicitud de contrato vinculada.
export default function AdjudicarDialog({ licitacion, ofertas, proveedores, busy, onConfirm, onClose }) {
  const { t } = useI18n();
  const [ofertaId, setOfertaId] = useState('');
  const proveedorOf = o => proveedores.find(p => p.id === o.proveedor_id);

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('lic.awardTitle')} · {licitacion.titulo}</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-500">{t('lic.awardBody')}</p>
        {ofertas.length ? (
          <div>
            <Label className="mb-1">{t('lic.awardSelect')}</Label>
            <select value={ofertaId} onChange={e => setOfertaId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              <option value="">—</option>
              {ofertas.map(o => (
                <option key={o.id} value={o.id}>
                  {proveedorOf(o)?.nombre} · {formatEur(o.importe, true)}{o.puntuacion != null ? ` · ${o.puntuacion}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : <p className="text-sm text-slate-500">{t('lic.noHomologated')}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => { const o = ofertas.find(x => x.id === ofertaId); if (o) onConfirm(o); }} disabled={busy || !ofertaId} className="bg-teal-700 hover:bg-teal-800">{busy ? t('common.saving') : t('lic.award')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
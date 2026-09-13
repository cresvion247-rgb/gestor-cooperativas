import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n';

// Rechazo de un documento de socio pidiendo el motivo, que se comunica al
// miembro para que pueda subsanarlo.
export default function RechazoDialog({ onConfirm, onClose, busy }) {
  const { t } = useI18n();
  const [motivo, setMotivo] = useState('');
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('doc.rejectTitle')}</DialogTitle></DialogHeader>
        <div>
          <Label className="mb-1">{t('con.am.f.motivo')}</Label>
          <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} className="bg-slate-50" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => onConfirm(motivo)} disabled={busy} className="bg-red-600 text-white hover:bg-red-700">{busy ? t('common.saving') : t('doc.reject')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
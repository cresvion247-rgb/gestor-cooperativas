import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export default function ConfirmDialog({ title, description, actions, onClose, busy }) {
  const { t } = useI18n();
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-500">{description}</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          {actions.map(a => (
            <Button key={a.label} onClick={a.onConfirm} disabled={busy} className={a.destructive ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#102A43] hover:bg-[#173F5F]'}>
              {busy ? t('common.saving') : a.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
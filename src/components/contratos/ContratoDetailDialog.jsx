import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileDown } from 'lucide-react';
import StatusBadge from '@/components/erp/StatusBadge';
import ModificacionesList from '@/components/contratos/ModificacionesList';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff } from '@/lib/permissions';
import { PIPELINE } from '@/lib/contracts';
import { formatEur, formatDate } from '@/lib/format';

// Expediente del contrato: ficha completa, acciones del ciclo de vida y el
// histórico de modificaciones firmadas con sus transiciones.
export default function ContratoDetailDialog({ contrato, cooperativas, proyectos, onAdvance, onLifecycle, onNewAmendment, onExport, onClose }) {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const coop = cooperativas.find(c => c.id === contrato.cooperativa_id);
  const proyecto = proyectos.find(p => p.id === contrato.proyecto_id);
  const idx = PIPELINE.indexOf(contrato.estado);
  const next = idx >= 0 && idx < PIPELINE.length - 1 ? PIPELINE[idx + 1] : null;
  const canClose = ['activo', 'suspendido', 'vencido'].includes(contrato.estado);

  const info = (label, value) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-700">{value ?? '—'}</p>
    </div>
  );

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('con.manageTitle')} · {contrato.codigo}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-3">
          {info(t('common.status'), <StatusBadge value={contrato.estado} />)}
          {info(t('con.f.code'), contrato.codigo)}
          {info(t('inc.f.title'), contrato.titulo)}
          {info(t('con.f.category'), contrato.categoria)}
          {info(t('con.f.counterpart'), contrato.contraparte)}
          {info(t('users.cooperative'), coop?.nombre)}
          {info(t('common.project'), proyecto?.nombre)}
          {info(t('urba.col.responsible'), contrato.responsable)}
          {info(t('con.f.total'), formatEur(contrato.importe_total, true))}
          {info(t('con.f.expiry'), formatDate(contrato.fecha_vencimiento))}
          {info(t('con.f.paymentTerms'), contrato.terminos_pago)}
          {info(t('common.risk'), <StatusBadge value={contrato.riesgo} />)}
          {info(t('con.f.guarantee'), contrato.garantia_requerida ? '✓' : '—')}
          {info(t('con.f.amendmentRequired'), contrato.exige_modificacion ? '✓' : '—')}
        </div>
        <div className="flex flex-wrap gap-2">
          {onExport && (
            <Button size="sm" variant="outline" onClick={() => onExport(contrato)}><FileDown className="h-4 w-4" />{t('pdf.export')}</Button>
          )}
          {next && (
            <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" onClick={() => onAdvance(contrato)}>
              {t('con.advance')} → {st(next)}
            </Button>
          )}
          {contrato.estado === 'activo' && isCoopStaff(user) && (
            <Button size="sm" variant="outline" onClick={() => onNewAmendment(contrato)}>{t('con.newAmendment')}</Button>
          )}
          {contrato.estado === 'activo' && (
            <Button size="sm" variant="outline" className="text-amber-700 hover:bg-amber-50" onClick={() => onLifecycle(contrato, 'suspendido')}>{t('con.suspend')}</Button>
          )}
          {canClose && (
            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => onLifecycle(contrato, 'cerrado')}>{t('con.close')}</Button>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-[#102A43]">{t('con.amendments')}</p>
          <ModificacionesList contrato={contrato} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
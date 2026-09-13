import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileDown } from 'lucide-react';
import DataTable from '@/components/erp/DataTable';
import StatusBadge from '@/components/erp/StatusBadge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/lib/i18n';
import { formatEur, formatDate } from '@/lib/format';
import { logAudit } from '@/lib/audit';
import { exportEstadoSocioPdf } from '@/lib/pdf';

// Expediente personal del socio: datos de membresía, vivienda adjudicada
// y balance de aportaciones con detalle línea a línea.
export default function SocioDetailDialog({ socio, cooperativas, viviendas, aportaciones, onClose }) {
  const { t, st } = useI18n();
  const { toast } = useToast();
  const coop = cooperativas.find(c => c.id === socio.cooperativa_id);
  const vivienda = viviendas.find(v => v.id === socio.vivienda_id);

  const debido = aportaciones.reduce((s, a) => s + (a.importe_debido || 0), 0);
  const pagado = aportaciones.reduce((s, a) => s + (a.importe_pagado || 0), 0);
  const pendiente = aportaciones
    .filter(a => ['pendiente', 'parcial', 'vencida'].includes(a.estado))
    .reduce((s, a) => s + (a.importe_pendiente ?? Math.max((a.importe_debido || 0) - (a.importe_pagado || 0), 0)), 0);

  // Estado de cuenta del socio en PDF, listo para compartir con el miembro.
  const exportStatement = async () => {
    try {
      exportEstadoSocioPdf({ socio, cooperativa: coop, aportaciones, t, st });
      await logAudit({ tenant_id: socio.tenant_id, accion: 'pdf_exportado', entidad_tipo: 'Socio', entidad_id: socio.id, detalle: `Estado de cuenta de ${socio.nombre_completo}` });
      toast({ title: t('pdf.exported') });
    } catch (e) {
      toast({ title: t('pdf.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const info = (label, value) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-700">{value || '—'}</p>
    </div>
  );

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('soc.manageTitle')} · {socio.nombre_completo}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-3">
          {info(t('common.status'), <StatusBadge value={socio.estado} />)}
          {info(t('portal.cooperative'), coop?.nombre)}
          {info(t('intake.dni'), socio.dni_nie)}
          {info(t('users.email'), socio.email)}
          {info(t('coop.f.phone'), socio.telefono)}
          {info(t('portal.memberSince'), formatDate(socio.fecha_admision))}
          {info(t('coop.f.address'), socio.direccion)}
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-semibold text-[#102A43]">{t('soc.col.housing')}</p>
          {vivienda ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {info(t('portal.ref'), vivienda.referencia)}
              {info(t('portal.typology'), vivienda.tipologia)}
              {info(t('portal.area'), vivienda.metros_cuadrados ? `${vivienda.metros_cuadrados} m²` : null)}
            </div>
          ) : <p className="text-sm text-slate-500">{t('portal.notAllocated')}</p>}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-[#102A43]">{t('soc.contributions')}</p>
          <div className="mb-3 grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-3">
            {info(t('portal.due'), formatEur(debido, true))}
            {info(t('portal.paid'), formatEur(pagado, true))}
            {info(t('portal.pending'), formatEur(pendiente, true))}
          </div>
          <DataTable columns={[
            { key: 'fecha_vencimiento', label: t('fin.col.expiry'), render: v => formatDate(v) },
            { key: 'tipo', label: t('fin.col.type') },
            { key: 'importe_debido', label: t('fin.col.amount'), render: v => formatEur(v, true) },
            { key: 'importe_pagado', label: t('fin.col.paid'), render: v => formatEur(v, true) },
            { key: 'estado', label: t('common.status'), badge: true }
          ]} rows={aportaciones} empty={t('common.empty')} />
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={exportStatement}><FileDown className="h-4 w-4" />{t('pdf.export')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
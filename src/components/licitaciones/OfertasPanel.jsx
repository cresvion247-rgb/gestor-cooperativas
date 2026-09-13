import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DataTable from '@/components/erp/DataTable';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';
import { isCoopStaff } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import { formatEur, formatDate } from '@/lib/format';

// Panel de ofertas de una licitación: comparativa de importes y puntuación,
// registro de nuevas ofertas y acceso a la adjudicación.
export default function OfertasPanel({ licitacion, ofertas, proveedores, onAddBid, onAward }) {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const proveedorOf = o => proveedores.find(p => p.id === o.proveedor_id);
  const staff = isCoopStaff(user);
  const canAward = staff && !['adjudicada', 'cancelada'].includes(licitacion.estado) && ofertas.length > 0;

  const setEstadoOferta = async (oferta, estado) => {
    try {
      await base44.entities.Oferta.update(oferta.id, { estado });
      await logAudit({ tenant_id: licitacion.tenant_id, accion: 'oferta_actualizada', entidad_tipo: 'Oferta', entidad_id: oferta.id, valores_anteriores: { estado: oferta.estado }, valores_nuevos: { estado } });
      qc.invalidateQueries({ queryKey: ['ofertas'] });
    } catch (e) {
      toast({ title: t('lic.bidFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#102A43]">{t('lic.bids')} · {licitacion.titulo}</p>
        <div className="flex gap-2">
          {staff && !['adjudicada', 'cancelada'].includes(licitacion.estado) && (
            <Button size="sm" variant="outline" onClick={onAddBid}>{t('lic.addBid')}</Button>
          )}
          {canAward && (
            <Button size="sm" className="bg-teal-700 hover:bg-teal-800" onClick={onAward}>{t('lic.award')}</Button>
          )}
        </div>
      </div>
      <DataTable columns={[
        { key: 'proveedor_id', label: t('lic.selectSupplier'), render: (_, o) => proveedorOf(o)?.nombre || '—' },
        { key: 'importe', label: t('fin.col.amount'), render: v => formatEur(v, true) },
        { key: 'plazo_ejecucion', label: t('lic.f.delivery') },
        { key: 'puntuacion', label: t('lic.f.score') },
        { key: 'fecha_presentacion', label: t('leg.col.date'), render: v => formatDate(v) },
        { key: 'estado', label: t('common.status'), badge: true },
        { key: 'acciones', label: '', render: (_, o) => o.estado === 'presentada' ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-teal-700 hover:bg-teal-50" onClick={() => setEstadoOferta(o, 'favorable')}>{st('favorable')}</Button>
            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => setEstadoOferta(o, 'descartada')}>{st('descartada')}</Button>
          </div>
        ) : null }
      ]} rows={ofertas} empty={t('common.empty')} />
    </div>
  );
}
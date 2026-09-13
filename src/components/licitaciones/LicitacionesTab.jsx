import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import DataTable from '@/components/erp/DataTable';
import LicitacionDialog from '@/components/licitaciones/LicitacionDialog';
import OfertasPanel from '@/components/licitaciones/OfertasPanel';
import OfertaDialog from '@/components/licitaciones/OfertaDialog';
import AdjudicarDialog from '@/components/licitaciones/AdjudicarDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { notifyCooperative } from '@/lib/notify';
import { useI18n } from '@/lib/i18n';
import { isCoopStaff } from '@/lib/permissions';
import { formatEur, formatDate } from '@/lib/format';

export default function LicitacionesTab() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: proyectos = [] } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-created_date', 500) });
  const { data: proveedores = [] } = useQuery({ queryKey: ['proveedores'], queryFn: () => base44.entities.Proveedor.list('-created_date', 500) });
  const { data: licitaciones = [], isLoading } = useQuery({ queryKey: ['licitaciones'], queryFn: () => base44.entities.Licitacion.list('-created_date', 500) });
  const { data: ofertas = [] } = useQuery({ queryKey: ['ofertas'], queryFn: () => base44.entities.Oferta.list('-created_date', 500) });

  const [selected, setSelected] = useState(null);
  const [dialog, setDialog] = useState(null); // 'new' | licitacion
  const [bidDialog, setBidDialog] = useState(false);
  const [awardDialog, setAwardDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  const staff = isCoopStaff(user);
  const proyectoOf = l => proyectos.find(p => p.id === l.proyecto_id);
  const proveedorOf = l => proveedores.find(p => p.id === l.proveedor_adjudicado_id);
  const ofertasDe = l => ofertas.filter(o => o.licitacion_id === l.id);

  // Adjudicación: marca la licitación, crea la solicitud de contrato vinculada
  // al proveedor ganador y avisa a la cooperativa.
  const award = async (licitacion, oferta) => {
    setBusy(true);
    try {
      const proveedor = proveedores.find(p => p.id === oferta.proveedor_id);
      await base44.entities.Licitacion.update(licitacion.id, { estado: 'adjudicada', proveedor_adjudicado_id: proveedor.id });
      const codigo = `CT-${licitacion.referencia || licitacion.id.slice(0, 6)}`;
      const contrato = {
        tenant_id: licitacion.tenant_id,
        cooperativa_id: licitacion.cooperativa_id,
        proyecto_id: licitacion.proyecto_id,
        codigo,
        titulo: licitacion.titulo,
        categoria: licitacion.categoria || licitacion.titulo,
        contraparte: proveedor.nombre,
        estado: 'solicitud',
        responsable: user?.email || null,
        importe_base: oferta.importe,
        importe_total: oferta.importe,
        procedencia: licitacion.id
      };
      const res = await base44.entities.Contrato.create(contrato);
      await logAudit({
        tenant_id: licitacion.tenant_id,
        accion: 'licitacion_adjudicada',
        entidad_tipo: 'Licitacion',
        entidad_id: licitacion.id,
        valores_nuevos: { proveedor: proveedor.nombre, contrato_codigo: codigo }
      });
      await logAudit({ tenant_id: licitacion.tenant_id, accion: 'contrato_creado', entidad_tipo: 'Contrato', entidad_id: res?.id || null, valores_nuevos: contrato });
      await notifyCooperative({ tenant_id: licitacion.tenant_id, tipo: 'licitacion', titulo: `${t('lic.col.title')}: ${licitacion.titulo}`, descripcion: t('lic.awarded'), prioridad: 'media' });
      qc.invalidateQueries({ queryKey: ['licitaciones'] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      toast({ title: t('lic.awarded') });
      setAwardDialog(false);
      setSelected(null);
    } catch (e) {
      toast({ title: t('lic.awardFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{t('module.proveedores.desc')}</p>
        {staff && <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" onClick={() => setDialog('new')}>{t('lic.action')}</Button>}
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'titulo', label: t('lic.col.title') },
          { key: 'categoria', label: t('prov.col.category') },
          { key: 'proyecto_id', label: t('common.project'), render: (_, l) => proyectoOf(l)?.nombre || '—' },
          { key: 'presupuesto_base', label: t('lic.col.budget'), render: v => formatEur(v, true) },
          { key: 'fecha_limite', label: t('common.deadline'), render: v => formatDate(v) },
          { key: 'ofertas', label: t('lic.col.bids'), render: (_, l) => String(ofertasDe(l).length) },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'adjudicada', label: t('lic.col.awarded'), render: (_, l) => proveedorOf(l)?.nombre || '—' },
          { key: 'acciones', label: '', render: (_, l) => staff ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelected(l)}>{t('common.manage')}</Button>
              <Button variant="outline" size="sm" onClick={() => setDialog(l)}>{t('common.edit')}</Button>
            </div>
          ) : null }
        ]} rows={licitaciones} />
      )}
      {selected && (
        <div className="mt-4">
          <OfertasPanel
            licitacion={selected}
            ofertas={ofertasDe(selected)}
            proveedores={proveedores}
            onAddBid={() => setBidDialog(true)}
            onAward={() => setAwardDialog(true)}
          />
        </div>
      )}
      {dialog && <LicitacionDialog licitacion={dialog === 'new' ? null : dialog} proyectos={proyectos} onClose={() => setDialog(null)} />}
      {bidDialog && selected && <OfertaDialog licitacion={selected} proveedores={proveedores} onClose={() => setBidDialog(false)} />}
      {awardDialog && selected && (
        <AdjudicarDialog
          licitacion={selected}
          ofertas={ofertasDe(selected).filter(o => proveedores.find(p => p.id === o.proveedor_id)?.estado === 'homologado')}
          proveedores={proveedores}
          busy={busy}
          onConfirm={oferta => award(selected, oferta)}
          onClose={() => setAwardDialog(false)}
        />
      )}
    </>
  );
}
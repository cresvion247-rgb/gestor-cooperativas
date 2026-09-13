import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ConfirmDialog from '@/components/erp/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { notifyCooperative } from '@/lib/notify';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff } from '@/lib/permissions';
import { formatEur, formatDate } from '@/lib/format';

// Entregas y garantías: adjudicaciones activas pendientes de entregar y
// entregas realizadas, con notificación a la cooperativa y auditoría.
export default function Entregas() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const staff = isCoopStaff(user);

  const { data: adjudicaciones = [], isLoading } = useQuery({ queryKey: ['adjudicaciones'], queryFn: () => base44.entities.Adjudicacion.list('-fecha_adjudicacion', 500) });
  const { data: socios = [] } = useQuery({ queryKey: ['socios'], queryFn: () => base44.entities.Socio.list('-created_date', 500) });
  const { data: viviendas = [] } = useQuery({ queryKey: ['viviendas'], queryFn: () => base44.entities.Vivienda.list('-created_date', 500) });
  const { data: cooperativas = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date', 500) });

  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const socioOf = a => socios.find(s => s.id === a.socio_id);
  const viviendaOf = a => viviendas.find(v => v.id === a.vivienda_id);
  const coopOf = a => cooperativas.find(c => c.id === a.cooperativa_id);

  const deliver = async (a) => {
    setBusy(true);
    try {
      const viv = viviendaOf(a);
      await base44.entities.Adjudicacion.update(a.id, { estado: 'entregada' });
      if (viv) await base44.entities.Vivienda.update(viv.id, { estado: 'entregada' });
      await logAudit({
        tenant_id: a.tenant_id,
        accion: 'entrega_registrada',
        entidad_tipo: 'Adjudicacion',
        entidad_id: a.id,
        valores_anteriores: { estado: a.estado },
        valores_nuevos: { estado: 'entregada', vivienda: viv?.referencia || null, socio: socioOf(a)?.nombre_completo || null }
      });
      await notifyCooperative({
        tenant_id: a.tenant_id,
        tipo: 'entrega',
        titulo: `${t('entr.col.home')}: ${viv?.referencia || '—'}`,
        descripcion: `${socioOf(a)?.nombre_completo || ''} — ${t('entr.confirmTitle')}`,
        prioridad: 'baja'
      });
      qc.invalidateQueries({ queryKey: ['adjudicaciones'] });
      qc.invalidateQueries({ queryKey: ['viviendas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: t('entr.done') });
      setConfirm(null);
    } catch (e) {
      toast({ title: t('entr.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title={t('nav.entregas')} description={t('module.entregas.desc')} />
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'vivienda', label: t('entr.col.home'), render: (_, a) => viviendaOf(a)?.referencia || '—' },
          { key: 'socio_id', label: t('fin.col.member'), render: (_, a) => socioOf(a)?.nombre_completo || '—' },
          { key: 'cooperativa_id', label: t('nav.cooperativas'), render: (_, a) => coopOf(a)?.nombre || '—' },
          { key: 'fecha_adjudicacion', label: t('leg.col.date'), render: formatDate },
          { key: 'importe', label: t('fin.col.amount'), render: v => formatEur(v, true) },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'acciones', label: '', render: (_, a) => staff && a.estado === 'activa' ? (
            <Button size="sm" className="bg-teal-700 hover:bg-teal-800" onClick={() => setConfirm(a)}>{t('entr.deliver')}</Button>
          ) : null }
        ]} rows={adjudicaciones} />
      )}
      {confirm && (
        <ConfirmDialog
          title={t('entr.confirmTitle')}
          description={t('entr.confirmBody')}
          busy={busy}
          actions={[{ label: t('entr.deliver'), onConfirm: () => deliver(confirm) }]}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
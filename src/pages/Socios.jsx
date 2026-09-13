import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ConfirmDialog from '@/components/erp/ConfirmDialog';
import SocioDialog from '@/components/socios/SocioDialog';
import SocioDetailDialog from '@/components/socios/SocioDetailDialog';
import AdjudicacionDialog from '@/components/socios/AdjudicacionDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';
import { isCoopStaff } from '@/lib/permissions';
import { formatEur } from '@/lib/format';

const ESTADOS = ['todos', 'candidato', 'activo', 'lista_espera', 'baja', 'completado'];
const OPEN_CONTRIBUTION_STATES = ['pendiente', 'parcial', 'vencida'];

export default function Socios() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: coops = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date', 500) });
  const { data: socios = [], isLoading } = useQuery({ queryKey: ['socios'], queryFn: () => base44.entities.Socio.list('-created_date', 500) });
  const { data: aportaciones = [] } = useQuery({ queryKey: ['aportaciones'], queryFn: () => base44.entities.Aportacion.list('-created_date', 500) });
  const { data: viviendas = [] } = useQuery({ queryKey: ['viviendas'], queryFn: () => base44.entities.Vivienda.list('-created_date', 500) });
  const { data: proyectos = [] } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-created_date', 500) });

  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [coopFilter, setCoopFilter] = useState('todas');
  const [dialog, setDialog] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const staff = isCoopStaff(user);
  const coopOf = s => coops.find(c => c.id === s.cooperativa_id);
  const viviendaRef = s => viviendas.find(v => v.id === s.vivienda_id)?.referencia;
  const pendingOf = socio => aportaciones
    .filter(a => a.socio_id === socio.id && OPEN_CONTRIBUTION_STATES.includes(a.estado))
    .reduce((sum, a) => sum + (a.importe_pendiente ?? Math.max((a.importe_debido || 0) - (a.importe_pagado || 0), 0)), 0);

  const rows = socios.filter(s =>
    (estadoFilter === 'todos' || s.estado === estadoFilter) &&
    (coopFilter === 'todas' || s.cooperativa_id === coopFilter)
  );

  const changeEstado = async (socio, estado) => {
    setBusy(true);
    try {
      const payload = { estado };
      if (estado === 'activo' && !socio.fecha_admision) payload.fecha_admision = new Date().toISOString().slice(0, 10);
      await base44.entities.Socio.update(socio.id, payload);
      await logAudit({
        tenant_id: coopOf(socio)?.tenant_id,
        accion: estado === 'activo' ? 'socio_admitido' : 'socio_baja',
        entidad_tipo: 'Socio',
        entidad_id: socio.id,
        valores_anteriores: { estado: socio.estado },
        valores_nuevos: payload
      });
      qc.invalidateQueries({ queryKey: ['socios'] });
      toast({ title: t(estado === 'activo' ? 'soc.admitted' : 'soc.updated') });
      setConfirming(null);
    } catch (e) {
      toast({ title: t('soc.updateFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        title={t('soc.title')}
        description={t('soc.desc')}
        action={staff ? t('soc.action') : undefined}
        onAction={staff ? () => setDialog({ type: 'edit', socio: null }) : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">{t('users.cooperative')}</label>
          <Select value={coopFilter} onValueChange={setCoopFilter}>
            <SelectTrigger className="h-9 w-[14rem] rounded-xl border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">{t('common.all')}</SelectItem>
              {coops.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">{t('common.status')}</label>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="h-9 w-[11.5rem] rounded-xl border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map(e => (
                <SelectItem key={e} value={e}>{e === 'todos' ? t('common.all') : st(e)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'nombre_completo', label: t('soc.col.member') },
          { key: 'dni_nie', label: t('soc.col.dni') },
          { key: 'cooperativa_id', label: t('soc.col.coop'), render: (_, s) => coopOf(s)?.nombre || '—' },
          { key: 'vivienda_id', label: t('soc.col.housing'), render: (_, s) => viviendaRef(s) || '—' },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'pendiente', label: t('fin.col.pending'), render: (_, s) => formatEur(pendingOf(s), true) },
          { key: 'acciones', label: '', render: (_, s) => (
            <div className="flex flex-col items-start gap-1.5">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setDialog({ type: 'detail', socio: s })}>{t('common.manage')}</Button>
                {staff && <Button variant="outline" size="sm" onClick={() => setDialog({ type: 'edit', socio: s })}>{t('common.edit')}</Button>}
              </div>
              {staff && s.estado === 'activo' && !s.vivienda_id && (
                <Button variant="outline" size="sm" onClick={() => setDialog({ type: 'allocate', socio: s })}>{t('soc.allocate')}</Button>
              )}
              {staff && s.estado === 'candidato' && (
                <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" onClick={() => changeEstado(s, 'activo')}>{t('soc.admit')}</Button>
              )}
              {staff && s.estado === 'activo' && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirming(s)}>{t('soc.baja')}</Button>
              )}
            </div>
          )}
        ]} rows={rows} />
      )}
      {dialog?.type === 'edit' && <SocioDialog socio={dialog.socio} cooperativas={coops} onClose={() => setDialog(null)} />}
      {dialog?.type === 'detail' && (
        <SocioDetailDialog
          socio={dialog.socio}
          cooperativas={coops}
          viviendas={viviendas}
          aportaciones={aportaciones.filter(a => a.socio_id === dialog.socio.id)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'allocate' && (
        <AdjudicacionDialog socio={dialog.socio} cooperativas={coops} viviendas={viviendas} proyectos={proyectos} onClose={() => setDialog(null)} />
      )}
      {confirming && (
        <ConfirmDialog
          title={t('soc.bajaTitle')}
          description={t('soc.bajaBody')}
          busy={busy}
          onClose={() => setConfirming(null)}
          actions={[{ label: t('soc.confirmBaja'), destructive: true, onConfirm: () => changeEstado(confirming, 'baja') }]}
        />
      )}
    </>
  );
}
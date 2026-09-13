import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import StatusBadge from '@/components/erp/StatusBadge';
import FinanzasStats from '@/components/finanzas/FinanzasStats';
import AportacionDialog from '@/components/finanzas/AportacionDialog';
import PagoDialog from '@/components/finanzas/PagoDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff } from '@/lib/permissions';
import { formatEur, formatDate } from '@/lib/format';
import { effectiveEstado, importePendiente } from '@/lib/finance';

const FILTROS = ['todos', 'pendiente', 'parcial', 'vencida', 'pagada', 'cancelada'];

export default function Finanzas() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const staff = isCoopStaff(user);

  const { data: aportaciones = [], isLoading } = useQuery({ queryKey: ['aportaciones'], queryFn: () => base44.entities.Aportacion.list('-fecha_vencimiento', 500) });
  const { data: socios = [] } = useQuery({ queryKey: ['socios'], queryFn: () => base44.entities.Socio.list('-created_date', 500) });
  const { data: cooperativas = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date', 500) });

  const [filtro, setFiltro] = useState('todos');
  const [dialog, setDialog] = useState(null); // 'new' | aportacion
  const [pagoDialog, setPagoDialog] = useState(null);

  const socioOf = a => socios.find(s => s.id === a.socio_id);
  const rows = aportaciones.filter(a => filtro === 'todos' || effectiveEstado(a) === filtro);

  return (
    <>
      <PageHeader
        title={t('fin.title')}
        description={t('fin.desc')}
        action={staff ? t('fin.action') : undefined}
        onAction={() => setDialog('new')}
      />
      <FinanzasStats aportaciones={aportaciones} />
      <div className="mb-4 flex items-center gap-3">
        <select value={filtro} onChange={e => setFiltro(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          {FILTROS.map(f => <option key={f} value={f}>{f === 'todos' ? t('common.all') : st(f)}</option>)}
        </select>
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'referencia', label: t('fin.col.reference') },
          { key: 'socio_id', label: t('fin.col.member'), render: (_, a) => socioOf(a)?.nombre_completo || '—' },
          { key: 'tipo', label: t('fin.col.type'), render: v => <StatusBadge value={v} /> },
          { key: 'fecha_vencimiento', label: t('fin.col.expiry'), render: formatDate },
          { key: 'importe_debido', label: t('fin.col.amount'), render: v => formatEur(v, true) },
          { key: 'importe_pagado', label: t('fin.col.paid'), render: v => formatEur(v, true) },
          { key: 'importe_pendiente', label: t('fin.col.pending'), render: (_, a) => formatEur(importePendiente(a), true) },
          { key: 'estado', label: t('common.status'), render: (_, a) => <StatusBadge value={effectiveEstado(a)} /> },
          { key: 'acciones', label: '', render: (_, a) => staff ? (
            <div className="flex flex-wrap gap-2">
              {importePendiente(a) > 0 && a.estado !== 'cancelada' && (
                <Button size="sm" className="bg-teal-700 hover:bg-teal-800" onClick={() => setPagoDialog(a)}>{t('fin.pay')}</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setDialog(a)}>{t('common.edit')}</Button>
            </div>
          ) : null }
        ]} rows={rows} />
      )}
      {dialog && (
        <AportacionDialog
          aportacion={dialog === 'new' ? null : dialog}
          cooperativas={cooperativas}
          socios={socios}
          onClose={() => setDialog(null)}
        />
      )}
      {pagoDialog && (
        <PagoDialog
          aportacion={pagoDialog}
          socio={socioOf(pagoDialog)}
          onClose={() => setPagoDialog(null)}
        />
      )}
    </>
  );
}
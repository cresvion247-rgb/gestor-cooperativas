import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ExpedienteDialog from '@/components/urbanismo/ExpedienteDialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { isCoopStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';

export default function Urbanismo() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: proyectos = [] } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-created_date', 500) });
  const { data: expedientes = [], isLoading } = useQuery({ queryKey: ['expedientes'], queryFn: () => base44.entities.ExpedienteUrbanistico.list('-created_date', 500) });

  const [proyectoFilter, setProyectoFilter] = useState('todos');
  const [dialog, setDialog] = useState(null);

  const staff = isCoopStaff(user);
  const proyectoOf = e => proyectos.find(p => p.id === e.proyecto_id);
  const isOverdue = e => e.fecha_limite && new Date(e.fecha_limite) < new Date();
  const rows = expedientes.filter(e => proyectoFilter === 'todos' || e.proyecto_id === proyectoFilter);

  return (
    <>
      <PageHeader
        title={t('urba.title')}
        description={t('urba.desc')}
        action={staff ? t('urba.action') : undefined}
        onAction={staff ? () => setDialog('new') : undefined}
      />
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">{t('common.project')}</label>
        <select value={proyectoFilter} onChange={e => setProyectoFilter(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="todos">{t('common.all')}</option>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'tipo', label: t('urba.col.type') },
          { key: 'administracion', label: t('urba.col.agency') },
          { key: 'referencia_oficial', label: t('urba.col.ref') },
          { key: 'proyecto_id', label: t('common.project'), render: (_, e) => proyectoOf(e)?.nombre || '—' },
          { key: 'estado', label: t('common.status') },
          { key: 'fecha_limite', label: t('common.deadline'), render: (v, e) => (
            <span className={isOverdue(e) ? 'font-semibold text-red-600' : ''}>{formatDate(v)}</span>
          )},
          { key: 'riesgo', label: t('common.risk'), badge: true },
          { key: 'responsable', label: t('urba.col.responsible') },
          { key: 'acciones', label: '', render: (_, e) => staff ? (
            <Button variant="outline" size="sm" onClick={() => setDialog(e)}>{t('common.edit')}</Button>
          ) : null }
        ]} rows={rows} />
      )}
      {dialog && <ExpedienteDialog expediente={dialog === 'new' ? null : dialog} proyectos={proyectos} onClose={() => setDialog(null)} />}
    </>
  );
}
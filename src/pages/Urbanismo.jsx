import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ArchiveTabs from '@/components/erp/ArchiveTabs';
import ExpedienteDialog from '@/components/urbanismo/ExpedienteDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/lib/i18n';
import { isCoopStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { logAudit } from '@/lib/audit';
import { archiveCounts, filterByArchiveTab, isExpedienteArchived } from '@/lib/archive';

export default function Urbanismo() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: proyectos = [] } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-created_date', 500) });
  const { data: expedientes = [], isLoading } = useQuery({ queryKey: ['expedientes'], queryFn: () => base44.entities.ExpedienteUrbanistico.list('-created_date', 500) });

  const [proyectoFilter, setProyectoFilter] = useState('todos');
  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState('active');
  const [busy, setBusy] = useState(false);

  const staff = isCoopStaff(user);
  const proyectoOf = e => proyectos.find(p => p.id === e.proyecto_id);
  const isOverdue = e => e.fecha_limite && new Date(e.fecha_limite) < new Date();

  const scoped = useMemo(
    () => expedientes.filter(e => proyectoFilter === 'todos' || e.proyecto_id === proyectoFilter),
    [expedientes, proyectoFilter],
  );
  const counts = useMemo(() => archiveCounts(scoped, isExpedienteArchived), [scoped]);
  const rows = useMemo(() => filterByArchiveTab(scoped, tab, isExpedienteArchived), [scoped, tab]);

  const setEstado = async (e, estado) => {
    setBusy(true);
    try {
      await base44.entities.ExpedienteUrbanistico.update(e.id, { estado });
      await logAudit({
        tenant_id: e.tenant_id,
        accion: estado === 'cerrado' ? 'expediente_archivado' : 'expediente_reactivado',
        entidad_tipo: 'ExpedienteUrbanistico',
        entidad_id: e.id,
        valores_anteriores: { estado: e.estado },
        valores_nuevos: { estado },
      });
      qc.invalidateQueries({ queryKey: ['expedientes'] });
      toast({ title: t(estado === 'cerrado' ? 'archive.done' : 'archive.restored') });
      setTab(estado === 'cerrado' ? 'archived' : 'active');
    } catch (err) {
      toast({ title: t('archive.failed'), description: String(err?.message || err), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        title={t('urba.title')}
        description={t('urba.desc')}
        action={staff ? t('urba.action') : undefined}
        onAction={staff ? () => setDialog('new') : undefined}
      />
      <ArchiveTabs value={tab} onChange={setTab} activeCount={counts.active} archivedCount={counts.archived} />
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">{t('common.project')}</label>
        <Select value={proyectoFilter} onValueChange={setProyectoFilter}>
          <SelectTrigger className="h-9 w-[16rem] rounded-xl border-slate-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">{t('common.all')}</SelectItem>
            {proyectos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'tipo', label: t('urba.col.type') },
          { key: 'administracion', label: t('urba.col.agency') },
          { key: 'referencia_oficial', label: t('urba.col.ref') },
          { key: 'proyecto_id', label: t('common.project'), render: (_, e) => proyectoOf(e)?.nombre || '—' },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'fecha_limite', label: t('common.deadline'), render: (v, e) => (
            <span className={isOverdue(e) ? 'font-semibold text-red-600' : ''}>{formatDate(v)}</span>
          )},
          { key: 'riesgo', label: t('common.risk'), badge: true },
          { key: 'responsable', label: t('urba.col.responsible') },
          { key: 'acciones', label: '', render: (_, e) => staff ? (
            <div className="flex flex-wrap gap-2">
              {tab === 'active' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setDialog(e)}>{t('common.edit')}</Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setEstado(e, 'cerrado')}>{t('archive.action')}</Button>
                </>
              )}
              {tab === 'archived' && (
                <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" disabled={busy} onClick={() => setEstado(e, 'en_tramite')}>{t('archive.unarchive')}</Button>
              )}
            </div>
          ) : null }
        ]} rows={rows} />
      )}
      {dialog && <ExpedienteDialog expediente={dialog === 'new' ? null : dialog} proyectos={proyectos} onClose={() => setDialog(null)} />}
    </>
  );
}

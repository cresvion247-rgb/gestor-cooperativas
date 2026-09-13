import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ArchiveTabs from '@/components/erp/ArchiveTabs';
import DocumentoLegalDialog from '@/components/juridico/DocumentoLegalDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';
import { isCoopStaff, isSuperAdmin } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { archiveCounts, filterByArchiveTab, isDocumentoLegalArchived } from '@/lib/archive';

export default function Juridico() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: coops = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list('-created_date', 500) });
  const { data: proyectos = [] } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-created_date', 500) });
  const { data: docs = [], isLoading } = useQuery({ queryKey: ['documentos_legales'], queryFn: () => base44.entities.DocumentoLegal.list('-created_date', 500) });

  const [coopFilter, setCoopFilter] = useState('todas');
  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState('active');
  const [busy, setBusy] = useState(false);

  const staff = isCoopStaff(user);
  const coopOf = d => coops.find(c => c.id === d.cooperativa_id);

  const visibleForRole = d => {
    if (isSuperAdmin(user) || (staff && user?.app_role !== 'consejo_rector')) return true;
    if (user?.app_role === 'consejo_rector') return d.visibilidad !== 'interno';
    return d.visibilidad === 'todos';
  };

  const scoped = useMemo(
    () => docs.filter(d => visibleForRole(d) && (coopFilter === 'todas' || d.cooperativa_id === coopFilter)),
    [docs, coopFilter, user, staff],
  );
  const counts = useMemo(() => archiveCounts(scoped, isDocumentoLegalArchived), [scoped]);
  const rows = useMemo(() => filterByArchiveTab(scoped, tab, isDocumentoLegalArchived), [scoped, tab]);

  const setLegalEstado = async (d, estado) => {
    setBusy(true);
    try {
      await base44.entities.DocumentoLegal.update(d.id, { estado });
      await logAudit({
        tenant_id: d.tenant_id,
        accion: estado === 'archivado' ? 'documento_legal_archivado' : 'documento_legal_reactivado',
        entidad_tipo: 'DocumentoLegal',
        entidad_id: d.id,
        valores_anteriores: { estado: d.estado },
        valores_nuevos: { estado },
      });
      qc.invalidateQueries({ queryKey: ['documentos_legales'] });
      qc.invalidateQueries({ queryKey: ['documentosLegales'] });
      toast({ title: t(estado === 'archivado' ? 'archive.done' : 'archive.restored') });
    } catch (e) {
      toast({ title: t('archive.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        title={t('leg.title')}
        description={t('leg.desc')}
        action={staff ? t('leg.action') : undefined}
        onAction={staff ? () => setDialog('new') : undefined}
      />
      <ArchiveTabs value={tab} onChange={setTab} activeCount={counts.active} archivedCount={counts.archived} />
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">{t('users.cooperative')}</label>
        <Select value={coopFilter} onValueChange={setCoopFilter}>
          <SelectTrigger className="h-9 w-[16rem] rounded-xl border-slate-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">{t('common.all')}</SelectItem>
            {coops.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'titulo', label: t('leg.col.title') },
          { key: 'cooperativa_id', label: t('users.cooperative'), render: (_, d) => coopOf(d)?.nombre || '—' },
          { key: 'fecha_documento', label: t('leg.col.date'), render: v => formatDate(v) },
          { key: 'visibilidad', label: t('leg.col.visibility'), render: v => t(`vis.${v}`) },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'acciones', label: '', render: (_, d) => staff ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setDialog(d)}>{t('common.edit')}</Button>
              {tab === 'active' && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setLegalEstado(d, 'archivado')}>{t('archive.action')}</Button>
              )}
              {tab === 'archived' && (
                <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" disabled={busy} onClick={() => setLegalEstado(d, 'activo')}>{t('archive.unarchive')}</Button>
              )}
            </div>
          ) : null }
        ]} rows={rows} />
      )}
      {dialog && <DocumentoLegalDialog documento={dialog === 'new' ? null : dialog} cooperativas={coops} proyectos={proyectos} onClose={() => setDialog(null)} />}
    </>
  );
}

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ArchiveTabs from '@/components/erp/ArchiveTabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff } from '@/lib/permissions';
import { formatEur } from '@/lib/format';
import { logAudit } from '@/lib/audit';
import { archiveCounts, filterByArchiveTab, isProyectoArchived } from '@/lib/archive';

export default function Promociones() {
  const { t } = useI18n();
  const { user } = useAuth();
  const staff = isCoopStaff(user);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-created_date') });
  const [tab, setTab] = useState('active');
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => archiveCounts(data, isProyectoArchived), [data]);
  const rows = useMemo(() => filterByArchiveTab(data, tab, isProyectoArchived), [data, tab]);

  const setEstado = async (p, estado) => {
    setBusy(true);
    try {
      await base44.entities.Proyecto.update(p.id, { estado });
      await logAudit({
        tenant_id: p.tenant_id,
        accion: estado === 'cerrado' ? 'proyecto_archivado' : 'proyecto_reactivado',
        entidad_tipo: 'Proyecto',
        entidad_id: p.id,
        valores_anteriores: { estado: p.estado },
        valores_nuevos: { estado },
      });
      qc.invalidateQueries({ queryKey: ['proyectos'] });
      toast({ title: t(estado === 'cerrado' ? 'archive.done' : 'archive.restored') });
      setTab(estado === 'cerrado' ? 'archived' : 'active');
    } catch (e) {
      toast({ title: t('archive.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title={t('prom.title')} description={t('prom.desc')} />
      <ArchiveTabs value={tab} onChange={setTab} activeCount={counts.active} archivedCount={counts.archived} />
      {isLoading ? <p>{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'codigo', label: t('prom.col.code') },
          { key: 'nombre', label: t('prom.col.project') },
          { key: 'municipio', label: t('prom.col.municipality') },
          { key: 'estado', label: t('prom.col.phase'), badge: true },
          { key: 'presupuesto_total', label: t('prom.col.budget'), render: v => formatEur(v) },
          { key: 'progreso_real', label: t('prom.col.progress'), render: v => `${v || 0}%` },
          { key: 'riesgo', label: t('common.risk'), badge: true },
          { key: 'acciones', label: '', render: (_, p) => staff ? (
            <div className="flex flex-wrap gap-2">
              {tab === 'active' && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setEstado(p, 'cerrado')}>{t('archive.action')}</Button>
              )}
              {tab === 'archived' && (
                <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" disabled={busy} onClick={() => setEstado(p, 'garantia')}>{t('archive.unarchive')}</Button>
              )}
            </div>
          ) : null }
        ]} rows={rows} />
      )}
    </>
  );
}

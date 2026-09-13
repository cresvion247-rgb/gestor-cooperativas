import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { isCoopStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ArchiveTabs from '@/components/erp/ArchiveTabs';
import ConsultaReplyDialog from '@/components/soporte/ConsultaReplyDialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { archiveCounts, filterByArchiveTab, isCerradaArchived } from '@/lib/archive';

const ESTADOS_ACTIVE = ['todas', 'abierta', 'en_gestion', 'resuelta'];
const ESTADOS_ARCHIVED = ['todas', 'cerrada'];
const CATEGORIAS = ['todas', 'juridica', 'financiera', 'construccion', 'secretaria'];

export default function Bandeja() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState('active');
  const [estado, setEstado] = useState('todas');
  const [categoria, setCategoria] = useState('todas');
  const [replying, setReplying] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data = [], isLoading } = useQuery({ queryKey: ['consultas'], queryFn: () => base44.entities.Consulta.list('-created_date') });
  const staff = isCoopStaff(user);

  const counts = useMemo(() => archiveCounts(data, isCerradaArchived), [data]);
  const tabRows = useMemo(() => filterByArchiveTab(data, tab, isCerradaArchived), [data, tab]);
  const estadoOptions = tab === 'archived' ? ESTADOS_ARCHIVED : ESTADOS_ACTIVE;
  const rows = tabRows.filter(c => (estado === 'todas' || c.estado === estado) && (categoria === 'todas' || c.categoria === categoria));

  const setArchiveState = async (c, next) => {
    setBusy(true);
    try {
      await base44.entities.Consulta.update(c.id, { estado: next });
      await logAudit({
        tenant_id: c.tenant_id,
        accion: next === 'cerrada' ? 'consulta_archivada' : 'consulta_reactivada',
        entidad_tipo: 'Consulta',
        entidad_id: c.id,
        valores_anteriores: { estado: c.estado },
        valores_nuevos: { estado: next },
      });
      qc.invalidateQueries({ queryKey: ['consultas'] });
      toast({ title: t(next === 'cerrada' ? 'archive.done' : 'archive.restored') });
    } catch (e) {
      toast({ title: t('archive.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  if (!staff) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldAlert className="h-6 w-6" /></div>
        <h2 className="mt-4 font-semibold text-[#102A43]">{t('admin.restricted')}</h2>
        <p className="mt-2 text-sm text-slate-500">{t('inbox.restricted')}</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={t('inbox.title')} description={t('inbox.desc')} />
      <ArchiveTabs value={tab} onChange={(v) => { setTab(v); setEstado('todas'); }} activeCount={counts.active} archivedCount={counts.archived} />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={estado} onChange={e => setEstado(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {estadoOptions.map(e => <option key={e} value={e}>{e === 'todas' ? t('audit.all') : st(e)}</option>)}
        </select>
        <select value={categoria} onChange={e => setCategoria(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {CATEGORIAS.map(c => <option key={c} value={c}>{c === 'todas' ? t('audit.all') : t(`cat.${c}`)}</option>)}
        </select>
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'asunto', label: t('inbox.col.subject') },
          { key: 'solicitante_email', label: t('inbox.col.from') },
          { key: 'categoria', label: t('inbox.col.category'), render: v => t(`cat.${v}`) },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'created_date', label: t('inbox.col.date'), render: formatDate },
          { key: 'acciones', label: '', render: (_, c) => (
            <div className="flex flex-wrap gap-2">
              {tab === 'active' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setReplying(c)}>{t('inbox.reply')}</Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setArchiveState(c, 'cerrada')}>{t('archive.action')}</Button>
                </>
              )}
              {tab === 'archived' && (
                <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" disabled={busy} onClick={() => setArchiveState(c, 'en_gestion')}>{t('archive.unarchive')}</Button>
              )}
            </div>
          ) }
        ]} rows={rows} />
      )}
      {replying && <ConsultaReplyDialog consulta={replying} onClose={() => setReplying(null)} />}
    </>
  );
}

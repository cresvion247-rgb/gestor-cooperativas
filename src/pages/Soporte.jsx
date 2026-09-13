import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { findMySocio, findMyCooperativa } from '@/lib/member';
import { formatDate } from '@/lib/format';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ArchiveTabs from '@/components/erp/ArchiveTabs';
import ConsultaDialog from '@/components/soporte/ConsultaDialog';
import { archiveCounts, filterByArchiveTab, isCerradaArchived } from '@/lib/archive';

export default function Soporte() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState('active');

  const socioQ = useQuery({ queryKey: ['portal-socio', user?.email], queryFn: () => findMySocio(user?.email), enabled: Boolean(user?.email) });
  const socio = socioQ.data;
  const coopsQ = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list() });
  const cooperativa = findMyCooperativa(coopsQ.data, user);
  const myQ = useQuery({ queryKey: ['mis-consultas', user?.email], queryFn: () => base44.entities.Consulta.filter({ solicitante_email: user.email }), enabled: Boolean(user?.email) });

  const [dialog, setDialog] = useState(false);
  const mine = myQ.data || [];
  const counts = useMemo(() => archiveCounts(mine, isCerradaArchived), [mine]);
  const rows = useMemo(() => filterByArchiveTab(mine, tab, isCerradaArchived), [mine, tab]);

  return (
    <>
      <PageHeader title={t('sup.title')} description={t('sup.desc')} action={t('sup.action')} onAction={() => setDialog(true)} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <div>
          <h2 className="mb-3 font-bold text-[#102A43]">{t('sup.myInquiries')}</h2>
          <ArchiveTabs value={tab} onChange={setTab} activeCount={counts.active} archivedCount={counts.archived} />
          {myQ.isLoading || socioQ.isLoading || coopsQ.isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
            <DataTable columns={[
              { key: 'asunto', label: t('sup.col.subject') },
              { key: 'categoria', label: t('sup.col.category'), render: v => t(`cat.${v}`) },
              { key: 'estado', label: t('common.status'), badge: true },
              { key: 'created_date', label: t('sup.col.date'), render: formatDate }
            ]} rows={rows} />
          )}
        </div>
        {cooperativa && (
          <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-[#102A43]">{t('sup.contact')}</h2>
            <p className="mt-3 text-sm font-semibold text-slate-900">{cooperativa.nombre}</p>
            <p className="mt-1 text-sm text-slate-500">{cooperativa.email || '—'}</p>
            <p className="text-sm text-slate-500">{cooperativa.telefono || '—'}</p>
          </div>
        )}
      </div>
      {dialog && <ConsultaDialog cooperativa={cooperativa} socioId={socio?.id || null} onClose={() => setDialog(false)} />}
    </>
  );
}

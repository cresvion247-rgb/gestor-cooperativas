import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { findMySocio, findMyCooperativa } from '@/lib/member';
import { isCoopStaff } from '@/lib/permissions';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import StatusBadge from '@/components/erp/StatusBadge';
import IncidenciaDialog from '@/components/incidencias/IncidenciaDialog';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';

export default function Incidencias() {
  const { t } = useI18n();
  const { user } = useAuth();
  const staff = isCoopStaff(user);

  const socioQ = useQuery({ queryKey: ['portal-socio', user?.email], queryFn: () => findMySocio(user?.email), enabled: Boolean(user?.email) });
  const socio = socioQ.data;
  const coopsQ = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list() });
  const cooperativa = findMyCooperativa(coopsQ.data, user);
  const { data: incs = [], isLoading } = useQuery({ queryKey: ['incidencias'], queryFn: () => base44.entities.Incidencia.list('-created_date') });

  const [dialog, setDialog] = useState(null);
  const rows = staff ? incs : incs.filter(i => socio && i.socio_id === socio.id);

  return (
    <>
      <PageHeader title={t('inc.title')} description={t('inc.desc')} action={t('inc.action')} onAction={() => setDialog('new')} />
      {isLoading || socioQ.isLoading || coopsQ.isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'titulo', label: t('inc.col.title') },
          { key: 'categoria', label: t('inc.col.category'), render: v => t(`inc.cat.${v}`) },
          { key: 'prioridad', label: t('inc.col.priority'), render: v => <StatusBadge value={v} /> },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'created_date', label: t('inc.col.date'), render: formatDate },
          { key: 'acciones', label: '', render: (_, i) => staff ? (
            <Button variant="outline" size="sm" onClick={() => setDialog(i)}>{t('inc.manage')}</Button>
          ) : null }
        ]} rows={rows} />
      )}
      {dialog && (
        <IncidenciaDialog
          incidencia={dialog === 'new' ? null : dialog}
          staff={staff}
          cooperativa={cooperativa}
          socioId={socio?.id || null}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import { useI18n } from '@/lib/i18n';
import { formatEur } from '@/lib/format';

export default function Promociones() {
  const { t } = useI18n();
  const { data = [], isLoading } = useQuery({ queryKey: ['proyectos'], queryFn: () => base44.entities.Proyecto.list('-created_date') });
  return (
    <>
      <PageHeader title={t('prom.title')} description={t('prom.desc')} action={t('prom.action')} />
      {isLoading ? <p>{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'codigo', label: t('prom.col.code') },
          { key: 'nombre', label: t('prom.col.project') },
          { key: 'municipio', label: t('prom.col.municipality') },
          { key: 'estado', label: t('prom.col.phase'), badge: true },
          { key: 'presupuesto_total', label: t('prom.col.budget'), render: v => formatEur(v) },
          { key: 'progreso_real', label: t('prom.col.progress'), render: v => `${v || 0}%` },
          { key: 'riesgo', label: t('common.risk'), badge: true }
        ]} rows={data} />
      )}
    </>
  );
}
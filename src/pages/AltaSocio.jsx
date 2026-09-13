import React from 'react';
import PageHeader from '@/components/erp/PageHeader';
import IntakeForm from '@/components/intake/IntakeForm';
import { useI18n } from '@/lib/i18n';

export default function AltaSocio() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('intake.title')} description={t('intake.desc')} />
      <IntakeForm />
    </>
  );
}
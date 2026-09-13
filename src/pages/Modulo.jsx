import React from 'react';
import PageHeader from '@/components/erp/PageHeader';
import { ClipboardList } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function Modulo({ titleKey, descriptionKey }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t(titleKey)} description={t(descriptionKey)} />
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"><ClipboardList className="h-6 w-6" /></div>
        <h2 className="mt-4 font-semibold text-[#102A43]">{t('module.readyTitle')}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{t('module.readyDesc')}</p>
      </div>
    </>
  );
}
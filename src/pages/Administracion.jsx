import React, { useState } from 'react';
import PageHeader from '@/components/erp/PageHeader';
import UsersPanel from '@/components/erp/admin/UsersPanel';
import AuditPanel from '@/components/erp/admin/AuditPanel';
import { ShieldAlert } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isSuperAdmin } from '@/lib/permissions';

export default function Administracion() {
  const { t } = useI18n();
  const { user, isLoadingAuth } = useAuth();
  const [tab, setTab] = useState('usuarios');

  if (isLoadingAuth) return <p className="text-slate-500">{t('common.loading')}</p>;

  if (!isSuperAdmin(user)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldAlert className="h-6 w-6" /></div>
        <h2 className="mt-4 font-semibold text-[#102A43]">{t('admin.restricted')}</h2>
        <p className="mt-2 text-sm text-slate-500">{t('admin.restrictedDesc')}</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Gestor Cooperativa" title={t('admin.title')} description={t('admin.desc')} />
      <div className="mb-6 flex gap-2">
        {[['usuarios', 'admin.tabUsers'], ['auditoria', 'admin.tabAudit']].map(([k, labelKey]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-[#102A43] text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{t(labelKey)}</button>
        ))}
      </div>
      {tab === 'usuarios' ? <UsersPanel /> : <AuditPanel />}
    </>
  );
}
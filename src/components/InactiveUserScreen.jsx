import React from 'react';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';

export default function InactiveUserScreen() {
  const { t } = useI18n();
  const { logout } = useAuth();
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <ShieldOff className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-4 text-xl font-bold text-[#102A43]">{t('users.blockedTitle')}</h1>
        <p className="mt-2 text-sm text-slate-500">{t('users.blockedBody')}</p>
        <Button onClick={() => logout(true)} className="mt-6 bg-[#102A43] hover:bg-[#173F5F]">{t('users.blockedLogout')}</Button>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import Sidebar from '@/components/erp/Sidebar';
import LanguageSelector from '@/components/erp/LanguageSelector';
import ConciergeProvider from '@/components/concierge/ConciergeProvider';
import ConciergeButton from '@/components/concierge/ConciergeButton';
import NotificationsBell from '@/components/erp/NotificationsBell';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isInternalUser } from '@/lib/permissions';

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <ConciergeProvider>
      <div className="min-h-screen bg-[#F4F7F9] lg:flex">
      <Sidebar />
      <div className={`fixed inset-0 z-40 bg-slate-950/40 transition lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setOpen(false)} />
      <div role="dialog" aria-modal="true" aria-label={t('header.openMenu')} className={`fixed inset-y-0 left-0 z-50 transition-transform motion-reduce:transition-none lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white"><X className="h-5 w-5" /></button>
        <Sidebar mobile onNavigate={() => setOpen(false)} />
      </div>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:gap-3 md:px-8">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 lg:hidden" aria-label={t('header.openMenu')}><Menu className="h-5 w-5" /></button>
          <button onClick={() => setSearchOpen(true)} className="rounded-xl border border-slate-200 p-2 text-slate-600 md:hidden" aria-label={t('header.search')}><Search className="h-4 w-4" /></button>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-teal-600" placeholder={t('header.search')} />
          </div>
          <div className="min-w-0 flex-1 md:hidden" />
          <NotificationsBell />
          {isInternalUser(user) && <ConciergeButton compact />}
          <LanguageSelector />
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-700 text-xs font-bold text-white">UA</div>
          {searchOpen && (
            <div className="absolute inset-x-0 top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-white px-3 md:hidden">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input autoFocus className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-teal-600" placeholder={t('header.search')} />
              </div>
              <button onClick={() => setSearchOpen(false)} className="shrink-0 rounded-xl p-2.5 text-slate-600" aria-label={t('common.cancel')}><X className="h-5 w-5" /></button>
            </div>
          )}
        </header>
        <main className="p-4 md:p-8"><Outlet /></main>
      </div>
      </div>
    </ConciergeProvider>
  );
}
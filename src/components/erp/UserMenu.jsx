import React, { useEffect, useRef, useState } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { isSuperAdmin, isMember, isCoopStaff, isUnassignedUser } from '@/lib/permissions';
import { useToast } from '@/components/ui/use-toast';

function initialsFor(user) {
  const name = (user?.full_name || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  const email = (user?.email || '').trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

function roleLabel(user, t, st) {
  if (isSuperAdmin(user)) return t('header.roleAdmin');
  if (isMember(user)) return t('header.roleMember');
  if (isUnassignedUser(user)) return t('header.rolePending');
  if (isCoopStaff(user)) return user?.app_role ? st(user.app_role) : t('header.roleStaff');
  if (user?.app_role) return st(user.app_role);
  return t('header.roleUser');
}

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { t, st } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // One-shot welcome after login redirect
  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('just_signed_in');
      if (flag && user?.email) {
        sessionStorage.removeItem('just_signed_in');
        toast({
          title: t('header.signedInTitle'),
          description: `${t('header.signedInAs')} ${user.email}`,
        });
      }
    } catch { /* ignore */ }
  }, [user?.email, t, toast]);

  if (!user) return null;

  const initials = initialsFor(user);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[14rem] items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-1 pr-2 text-left transition hover:bg-slate-50 sm:max-w-xs"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-700 text-[11px] font-bold text-white">
          {initials}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-xs font-semibold text-[#102A43]">{user.email || user.full_name || '—'}</span>
          <span className="block truncate text-[10px] text-slate-500">{roleLabel(user, t, st)}</span>
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 sm:block" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-3 py-3">
            <p className="text-xs font-semibold text-[#102A43]">{t('header.signedInAs')}</p>
            <p className="mt-0.5 break-all text-sm text-slate-700">{user.email || '—'}</p>
            <p className="mt-1 text-xs text-slate-500">{roleLabel(user, t, st)}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => logout(true)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            {t('admin.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

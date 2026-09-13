import React from 'react';
import { NavLink } from 'react-router-dom';
import { Building2, LayoutDashboard, FolderKanban, Users, Scale, FileSignature, Euro, HardHat, Landmark, FileText, Megaphone, BarChart3, Settings, Truck, KeyRound, Map, UserRound, Wrench, LifeBuoy, Inbox } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isInternalUser, isCoopStaff } from '@/lib/permissions';

// [ruta, clave de traducción, icono, visibilidad: undefined = todos, 'internal' = roles internos, 'staff' = personal de cooperativa]
const items = [
  ['/', 'nav.home', LayoutDashboard],
  ['/portal', 'nav.portal', UserRound, 'internal'],
  ['/cooperativas', 'nav.cooperativas', Building2],
  ['/promociones', 'nav.promociones', FolderKanban],
  ['/socios', 'nav.socios', Users],
  ['/urbanismo', 'nav.urbanismo', Map],
  ['/juridico', 'nav.juridico', Scale],
  ['/contratos', 'nav.contratos', FileSignature],
  ['/finanzas', 'nav.finanzas', Euro],
  ['/proveedores', 'nav.proveedores', Truck],
  ['/construccion', 'nav.construccion', HardHat],
  ['/gobierno', 'nav.gobierno', Landmark],
  ['/entregas', 'nav.entregas', KeyRound],
  ['/documentos', 'nav.documentos', FileText],
  ['/comunicaciones', 'nav.comunicaciones', Megaphone],
  ['/incidencias', 'nav.incidencias', Wrench, 'internal'],
  ['/soporte', 'nav.soporte', LifeBuoy, 'internal'],
  ['/informes', 'nav.informes', BarChart3],
  ['/bandeja', 'nav.bandeja', Inbox, 'staff'],
  ['/administracion', 'nav.administracion', Settings]
];

export default function Sidebar({ mobile = false, onNavigate }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const visible = items.filter(([, , , vis]) => {
    if (!vis) return true;
    return vis === 'internal' ? isInternalUser(user) : isCoopStaff(user);
  });
  return (
    <aside className={`${mobile ? 'block' : 'hidden lg:block'} h-screen w-72 shrink-0 overflow-y-auto bg-[#102A43] px-4 py-6 text-white`}>
      <div className="mb-8 px-3">
        <p className="text-xl font-bold tracking-tight">Urbalex ERP</p>
        <p className="mt-1 text-xs text-slate-300">{t('app.tagline')}</p>
      </div>
      <nav className="space-y-1">
        {visible.map(([to, labelKey, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? 'bg-white text-[#102A43] shadow' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
            <Icon className="h-4 w-4" />{t(labelKey)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
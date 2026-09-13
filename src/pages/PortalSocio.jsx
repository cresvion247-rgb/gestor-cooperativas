import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { formatEur, formatDate } from '@/lib/format';
import { findMySocio } from '@/lib/member';
import { getPrivateDocUrl } from '@/lib/notify';
import PageHeader from '@/components/erp/PageHeader';
import StatusBadge from '@/components/erp/StatusBadge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { UserRound, Home as HomeIcon, Wallet, FileText, Bell } from 'lucide-react';
import ConciergeButton from '@/components/concierge/ConciergeButton';

const Section = ({ icon: Icon, title, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="flex items-center gap-2 font-bold text-[#102A43]"><Icon className="h-4 w-4 text-[#2C90A6]" />{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

export default function PortalSocio() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const socioQ = useQuery({ queryKey: ['portal-socio', user?.email], queryFn: () => findMySocio(user?.email), enabled: Boolean(user?.email) });
  const socio = socioQ.data;
  const coopsQ = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list() });
  const coop = (coopsQ.data || []).find(c => c.id === socio?.cooperativa_id);

  const aportesQ = useQuery({ queryKey: ['portal-aportaciones', socio?.id], queryFn: () => base44.entities.Aportacion.filter({ socio_id: socio.id }), enabled: Boolean(socio?.id) });
  const adjudicacionesQ = useQuery({ queryKey: ['portal-adjudicaciones', socio?.id], queryFn: () => base44.entities.Adjudicacion.filter({ socio_id: socio.id }), enabled: Boolean(socio?.id) });
  const adjudicacion = (adjudicacionesQ.data || []).find(a => a.estado !== 'cancelada');
  const viviendaQ = useQuery({ queryKey: ['portal-vivienda', adjudicacion?.vivienda_id], queryFn: () => base44.entities.Vivienda.get(adjudicacion.vivienda_id), enabled: Boolean(adjudicacion?.vivienda_id) });
  const docsQ = useQuery({ queryKey: ['portal-docs', socio?.id], queryFn: () => base44.entities.DocumentoSocio.filter({ socio_id: socio.id }), enabled: Boolean(socio?.id) });
  const alertsQ = useQuery({ queryKey: ['portal-alertas'], queryFn: () => base44.entities.Alerta.list('-created_date', 20) });

  if (socioQ.isLoading || coopsQ.isLoading) return <p className="text-slate-500">{t('common.loading')}</p>;

  if (!socio) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-[#102A43]"><UserRound className="h-6 w-6" /></div>
        <h2 className="mt-4 font-semibold text-[#102A43]">{t('portal.noRecord')}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{t('portal.noRecordDesc')}</p>
        <Button asChild className="mt-6 bg-[#102A43] hover:bg-[#173F5F]">
          <Link to="/alta-socio">{t('portal.noRecordAction')}</Link>
        </Button>
      </div>
    );
  }

  const aportes = aportesQ.data || [];
  const totals = aportes.reduce((acc, a) => ({
    debido: acc.debido + (a.importe_debido || 0),
    pagado: acc.pagado + (a.importe_pagado || 0),
    pendiente: acc.pendiente + (a.importe_pendiente || (a.importe_debido || 0) - (a.importe_pagado || 0))
  }), { debido: 0, pagado: 0, pendiente: 0 });
  const vivienda = viviendaQ.data;
  const alerts = (alertsQ.data || []).filter(a => a.estado !== 'resuelta').slice(0, 6);

  const viewDoc = async (doc) => {
    const url = await getPrivateDocUrl(doc.id);
    if (url) window.open(url, '_blank');
    else toast({ title: t('portal.docFailed'), variant: 'destructive' });
  };

  return (
    <>
      <PageHeader title={t('nav.portal')} description={t('portal.desc')} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold text-[#102A43]">{t('portal.welcome')}, {socio.nombre_completo}</p>
        <ConciergeButton />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <Section icon={UserRound} title={t('portal.membership')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs text-slate-500">{t('portal.cooperative')}</p><p className="font-semibold text-slate-900">{coop?.nombre || '—'}</p></div>
              <div><p className="text-xs text-slate-500">{t('common.status')}</p><div className="mt-1"><StatusBadge value={socio.estado} /></div></div>
              <div><p className="text-xs text-slate-500">{t('portal.memberSince')}</p><p className="font-semibold text-slate-900">{socio.fecha_admision ? formatDate(socio.fecha_admision) : '—'}</p></div>
              <div><p className="text-xs text-slate-500">{t('users.email')}</p><p className="font-semibold text-slate-900">{socio.email || '—'}</p></div>
            </div>
          </Section>
          <Section icon={Wallet} title={t('portal.finances')}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{t('portal.due')}</p><p className="mt-1 font-bold text-[#102A43]">{formatEur(totals.debido)}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{t('portal.paid')}</p><p className="mt-1 font-bold text-teal-700">{formatEur(totals.pagado)}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{t('portal.pending')}</p><p className="mt-1 font-bold text-amber-700">{formatEur(totals.pendiente)}</p></div>
            </div>
          </Section>
          <Section icon={FileText} title={t('portal.docs')}>
            {(docsQ.data || []).length === 0 ? <p className="text-sm text-slate-500">{t('portal.noDocs')}</p> : (
              <ul className="divide-y divide-slate-100">
                {(docsQ.data || []).map(d => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-900">{d.nombre || t(`doc.${d.tipo}`)}</p>
                      <p className="text-xs text-slate-500">{t(`doc.${d.tipo}`)} · {formatDate(d.created_date)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => viewDoc(d)}>{t('portal.viewDoc')}</Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <div className="space-y-6">
          <Section icon={HomeIcon} title={t('portal.housing')}>
            {vivienda ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-xs text-slate-500">{t('portal.ref')}</p><p className="font-semibold text-slate-900">{vivienda.referencia}</p></div>
                <div><p className="text-xs text-slate-500">{t('portal.typology')}</p><p className="font-semibold text-slate-900">{vivienda.tipologia || '—'}</p></div>
                <div><p className="text-xs text-slate-500">{t('portal.area')}</p><p className="font-semibold text-slate-900">{vivienda.metros_cuadrados ? `${vivienda.metros_cuadrados} m²` : '—'}</p></div>
                <div><p className="text-xs text-slate-500">{t('common.status')}</p><div className="mt-1"><StatusBadge value={vivienda.estado} /></div></div>
              </div>
            ) : <p className="text-sm text-slate-500">{t('portal.notAllocated')}</p>}
          </Section>
          <Section icon={Bell} title={t('portal.alerts')}>
            {alerts.length === 0 ? <p className="text-sm text-slate-500">{t('home.noAlerts')}</p> : (
              <ul className="space-y-3">
                {alerts.map(a => (
                  <li key={a.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 break-words text-sm font-semibold text-slate-900">{a.titulo}</p>
                      <StatusBadge value={a.prioridad} />
                    </div>
                    {a.descripcion && <p className="mt-1 text-xs text-slate-500">{a.descripcion}</p>}
                    {a.fecha_limite && <p className="mt-1 text-xs text-slate-400">{t('fin.col.expiry')}: {formatDate(a.fecha_limite)}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
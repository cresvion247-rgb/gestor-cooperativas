import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import StatusBadge from '@/components/erp/StatusBadge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { formatEur, formatDate } from '@/lib/format';

export default function ProyectoDrawer({
  proyecto,
  cooperativa,
  open,
  onClose,
  staff,
  onEdit,
  onArchive,
  onRestore,
  busy,
}) {
  const { t } = useI18n();
  if (!proyecto) return null;

  const archived = proyecto.estado === 'cerrado';

  const info = (label, value) => (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm text-slate-800">{value ?? '—'}</div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="pr-8 text-[#102A43]">
            {proyecto.nombre || t('prom.title')}
          </SheetTitle>
          <SheetDescription>
            {proyecto.codigo ? `${proyecto.codigo}` : ''}
            {cooperativa?.nombre ? ` · ${cooperativa.nombre}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={proyecto.estado} />
            {proyecto.riesgo ? <StatusBadge value={proyecto.riesgo} /> : null}
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-600"
              style={{ width: `${Math.min(100, Number(proyecto.progreso_real) || 0)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {t('prom.col.progress')}: {proyecto.progreso_real || 0}%
            {proyecto.progreso_previsto != null ? ` · ${t('constr.planned')} ${proyecto.progreso_previsto}%` : ''}
          </p>

          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            {info(t('users.cooperative'), cooperativa?.nombre)}
            {info(t('prom.col.municipality'), proyecto.municipio)}
            {info(t('prom.f.province'), proyecto.provincia)}
            {info(t('prom.f.address'), proyecto.direccion)}
            {info(t('prom.col.budget'), formatEur(proyecto.presupuesto_total))}
            {info(t('prom.f.units'), proyecto.viviendas)}
            {info(t('prom.f.responsible'), proyecto.responsable)}
            {info(t('prom.f.cadastral'), proyecto.referencia_catastral)}
            {info(t('prom.f.start'), formatDate(proyecto.inicio_previsto))}
            {info(t('prom.f.end'), formatDate(proyecto.fin_previsto))}
            {info(t('constr.committed'), formatEur(proyecto.coste_comprometido))}
            {info(t('constr.f.cost'), formatEur(proyecto.coste_real))}
          </div>

          {proyecto.resumen ? (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {t('prom.f.summary')}
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{proyecto.resumen}</p>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-semibold text-[#102A43]">{t('prom.drawer.links')}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/urbanismo?proyecto=${proyecto.id}`}>{t('nav.urbanismo')}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/construccion">{t('nav.construccion')}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/socios">{t('nav.socios')}</Link>
              </Button>
            </div>
          </div>

          {staff ? (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button
                size="sm"
                className="bg-[#102A43] hover:bg-[#173F5F]"
                onClick={() => onEdit?.(proyecto)}
              >
                {t('common.edit')}
              </Button>
              {!archived && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onArchive?.(proyecto)}
                >
                  {t('archive.action')}
                </Button>
              )}
              {archived && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onRestore?.(proyecto)}
                >
                  {t('archive.unarchive')}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

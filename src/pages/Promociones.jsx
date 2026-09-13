import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ArchiveTabs from '@/components/erp/ArchiveTabs';
import ProyectoDialog from '@/components/promociones/ProyectoDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff } from '@/lib/permissions';
import { formatEur } from '@/lib/format';
import { logAudit } from '@/lib/audit';
import { archiveCounts, filterByArchiveTab, isProyectoArchived } from '@/lib/archive';

const FASES = [
  'viabilidad',
  'adquisicion_suelo',
  'urbanismo',
  'licencias',
  'licitacion',
  'construccion',
  'entrega',
  'garantia',
  'cerrado',
];
const RIESGOS = ['bajo', 'medio', 'alto', 'critico'];

export default function Promociones() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const staff = isCoopStaff(user);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery({
    queryKey: ['proyectos'],
    queryFn: () => base44.entities.Proyecto.list('-created_date', 500),
  });
  const { data: cooperativas = [] } = useQuery({
    queryKey: ['cooperativas'],
    queryFn: () => base44.entities.Cooperativa.list('-created_date', 500),
  });

  const [tab, setTab] = useState('active');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [coopFilter, setCoopFilter] = useState('todos');
  const [faseFilter, setFaseFilter] = useState('todos');
  const [riesgoFilter, setRiesgoFilter] = useState('todos');
  const [municipioFilter, setMunicipioFilter] = useState('');

  const coopOf = (p) => cooperativas.find((c) => c.id === p.cooperativa_id);

  const counts = useMemo(() => archiveCounts(data, isProyectoArchived), [data]);

  const rows = useMemo(() => {
    let list = filterByArchiveTab(data, tab, isProyectoArchived);
    if (coopFilter !== 'todos') list = list.filter((p) => p.cooperativa_id === coopFilter);
    if (faseFilter !== 'todos') list = list.filter((p) => p.estado === faseFilter);
    if (riesgoFilter !== 'todos') list = list.filter((p) => p.riesgo === riesgoFilter);
    const muni = municipioFilter.trim().toLowerCase();
    if (muni) list = list.filter((p) => String(p.municipio || '').toLowerCase().includes(muni));
    return list;
  }, [data, tab, coopFilter, faseFilter, riesgoFilter, municipioFilter]);

  const filtersActive =
    coopFilter !== 'todos' ||
    faseFilter !== 'todos' ||
    riesgoFilter !== 'todos' ||
    municipioFilter.trim() !== '';

  const setEstado = async (p, estado) => {
    setBusy(true);
    try {
      await base44.entities.Proyecto.update(p.id, { estado });
      await logAudit({
        tenant_id: p.tenant_id,
        accion: estado === 'cerrado' ? 'proyecto_archivado' : 'proyecto_reactivado',
        entidad_tipo: 'Proyecto',
        entidad_id: p.id,
        valores_anteriores: { estado: p.estado },
        valores_nuevos: { estado },
      });
      qc.invalidateQueries({ queryKey: ['proyectos'] });
      toast({ title: t(estado === 'cerrado' ? 'archive.done' : 'archive.restored') });
      setTab(estado === 'cerrado' ? 'archived' : 'active');
    } catch (e) {
      toast({ title: t('archive.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        title={t('prom.title')}
        description={t('prom.desc')}
        action={staff ? t('prom.action') : undefined}
        onAction={staff ? () => setDialog('new') : undefined}
      />
      <ArchiveTabs value={tab} onChange={setTab} activeCount={counts.active} archivedCount={counts.archived} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('users.cooperative')}</label>
          <Select value={coopFilter} onValueChange={setCoopFilter}>
            <SelectTrigger className="h-9 w-[14rem] rounded-xl border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t('common.all')}</SelectItem>
              {cooperativas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('prom.col.phase')}</label>
          <Select value={faseFilter} onValueChange={setFaseFilter}>
            <SelectTrigger className="h-9 w-[12rem] rounded-xl border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t('common.all')}</SelectItem>
              {FASES.map((f) => (
                <SelectItem key={f} value={f}>{st(f)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('common.risk')}</label>
          <Select value={riesgoFilter} onValueChange={setRiesgoFilter}>
            <SelectTrigger className="h-9 w-[10rem] rounded-xl border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t('common.all')}</SelectItem>
              {RIESGOS.map((r) => (
                <SelectItem key={r} value={r}>{st(r)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('prom.col.municipality')}</label>
          <Input
            value={municipioFilter}
            onChange={(e) => setMunicipioFilter(e.target.value)}
            placeholder={t('prom.filter.municipality')}
            className="h-9 w-[12rem] rounded-xl border-slate-200 bg-white"
          />
        </div>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-slate-600"
            onClick={() => {
              setCoopFilter('todos');
              setFaseFilter('todos');
              setRiesgoFilter('todos');
              setMunicipioFilter('');
            }}
          >
            {t('prom.filter.clear')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {filtersActive ? t('prom.emptyFiltered') : t('prom.empty')}
          </p>
          {staff && !filtersActive && tab === 'active' && (
            <Button
              className="mt-4 bg-[#102A43] hover:bg-[#173F5F]"
              onClick={() => setDialog('new')}
            >
              {t('prom.emptyCta')}
            </Button>
          )}
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'codigo', label: t('prom.col.code') },
            { key: 'nombre', label: t('prom.col.project') },
            {
              key: 'cooperativa_id',
              label: t('users.cooperative'),
              render: (_, p) => coopOf(p)?.nombre || '—',
            },
            { key: 'municipio', label: t('prom.col.municipality') },
            { key: 'estado', label: t('prom.col.phase'), badge: true },
            { key: 'presupuesto_total', label: t('prom.col.budget'), render: (v) => formatEur(v) },
            { key: 'progreso_real', label: t('prom.col.progress'), render: (v) => `${v || 0}%` },
            { key: 'riesgo', label: t('common.risk'), badge: true },
            {
              key: 'acciones',
              label: '',
              render: (_, p) =>
                staff ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDialog(p)}>
                      {t('common.edit')}
                    </Button>
                    {tab === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setEstado(p, 'cerrado')}
                      >
                        {t('archive.action')}
                      </Button>
                    )}
                    {tab === 'archived' && (
                      <Button
                        size="sm"
                        className="bg-[#102A43] hover:bg-[#173F5F]"
                        disabled={busy}
                        onClick={() => setEstado(p, 'garantia')}
                      >
                        {t('archive.unarchive')}
                      </Button>
                    )}
                  </div>
                ) : null,
            },
          ]}
          rows={rows}
        />
      )}

      {dialog && (
        <ProyectoDialog
          proyecto={dialog === 'new' ? null : dialog}
          cooperativas={cooperativas}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

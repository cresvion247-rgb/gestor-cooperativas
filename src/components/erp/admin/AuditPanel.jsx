import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DataTable from '@/components/erp/DataTable';
import { useI18n } from '@/lib/i18n';
import { formatDateTime } from '@/lib/format';

const TIPOS = ['Cooperativa', 'Proyecto', 'Socio', 'Vivienda', 'Contrato', 'Aportacion', 'ExpedienteUrbanistico', 'Adjudicacion', 'DocumentoLegal', 'Alerta', 'User'];

export default function AuditPanel() {
  const { t, st } = useI18n();
  const [coop, setCoop] = useState('');
  const [tipo, setTipo] = useState('');
  const { data: coops = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list() });
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit', coop, tipo],
    queryFn: () => {
      const q = {};
      if (coop) q.tenant_id = coop;
      if (tipo) q.entidad_tipo = tipo;
      return Object.keys(q).length ? base44.entities.AuditLog.filter(q, '-fecha', 200) : base44.entities.AuditLog.list('-fecha', 200);
    }
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-600">{t('audit.cooperative')}</p>
          <select value={coop} onChange={e => setCoop(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
            <option value="">{t('audit.all')}</option>
            {coops.map(c => <option key={c.id} value={c.tenant_id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-600">{t('audit.entity')}</p>
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
            <option value="">{t('audit.all')}</option>
            {TIPOS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>
      {isLoading ? <p className="text-slate-500">{t('audit.loadingRegister')}</p> : (
        <DataTable
          empty={t('audit.empty')}
          columns={[
            { key: 'fecha', label: t('audit.col.date'), render: formatDateTime },
            { key: 'usuario_email', label: t('audit.col.user') },
            { key: 'usuario_rol', label: t('audit.col.profile'), render: v => v ? st(v) : '—' },
            { key: 'tenant_id', label: t('audit.cooperative') },
            { key: 'accion', label: t('audit.col.action') },
            { key: 'entidad_tipo', label: t('audit.entity') },
            { key: 'entidad_id', label: t('audit.col.record') },
            { key: 'ip_direccion', label: t('audit.col.ip'), render: v => v || '—' }
          ]}
          rows={logs}
        />
      )}
    </div>
  );
}
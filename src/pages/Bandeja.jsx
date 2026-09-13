import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { isCoopStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ConsultaReplyDialog from '@/components/soporte/ConsultaReplyDialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

const ESTADOS = ['todas', 'abierta', 'en_gestion', 'resuelta', 'cerrada'];
const CATEGORIAS = ['todas', 'juridica', 'financiera', 'construccion', 'secretaria'];

export default function Bandeja() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const [estado, setEstado] = useState('todas');
  const [categoria, setCategoria] = useState('todas');
  const [replying, setReplying] = useState(null);

  const { data = [], isLoading } = useQuery({ queryKey: ['consultas'], queryFn: () => base44.entities.Consulta.list('-created_date') });
  const staff = isCoopStaff(user);

  if (!staff) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldAlert className="h-6 w-6" /></div>
        <h2 className="mt-4 font-semibold text-[#102A43]">{t('admin.restricted')}</h2>
        <p className="mt-2 text-sm text-slate-500">{t('inbox.restricted')}</p>
      </div>
    );
  }

  const rows = data.filter(c => (estado === 'todas' || c.estado === estado) && (categoria === 'todas' || c.categoria === categoria));

  return (
    <>
      <PageHeader title={t('inbox.title')} description={t('inbox.desc')} />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={estado} onChange={e => setEstado(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {ESTADOS.map(e => <option key={e} value={e}>{e === 'todas' ? t('audit.all') : st(e)}</option>)}
        </select>
        <select value={categoria} onChange={e => setCategoria(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {CATEGORIAS.map(c => <option key={c} value={c}>{c === 'todas' ? t('audit.all') : t(`cat.${c}`)}</option>)}
        </select>
      </div>
      {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <DataTable columns={[
          { key: 'asunto', label: t('inbox.col.subject') },
          { key: 'solicitante_email', label: t('inbox.col.from') },
          { key: 'categoria', label: t('inbox.col.category'), render: v => t(`cat.${v}`) },
          { key: 'estado', label: t('common.status'), badge: true },
          { key: 'created_date', label: t('inbox.col.date'), render: formatDate },
          { key: 'acciones', label: '', render: (_, c) => (
            <Button variant="outline" size="sm" onClick={() => setReplying(c)}>{t('inbox.reply')}</Button>
          ) }
        ]} rows={rows} />
      )}
      {replying && <ConsultaReplyDialog consulta={replying} onClose={() => setReplying(null)} />}
    </>
  );
}
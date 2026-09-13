import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import RechazoDialog from '@/components/documentos/RechazoDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { getPrivateDocUrl } from '@/lib/notify';

// Archivo documental: revisión de los documentos de identidad de los socios
// (verificación, rechazo motivado y apertura segura) y consulta del registro
// de documentos legales.
export default function Documentos() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const staff = isCoopStaff(user);

  const { data: documentos = [], isLoading } = useQuery({ queryKey: ['documentosSocio'], queryFn: () => base44.entities.DocumentoSocio.list('-created_date', 500) });
  const { data: socios = [] } = useQuery({ queryKey: ['socios'], queryFn: () => base44.entities.Socio.list('-created_date', 500) });
  const { data: legales = [] } = useQuery({ queryKey: ['documentosLegales'], queryFn: () => base44.entities.DocumentoLegal.list('-fecha_documento', 500) });

  const [rechazo, setRechazo] = useState(null);
  const [busy, setBusy] = useState(false);

  const socioOf = d => socios.find(s => s.id === d.socio_id);

  const view = async (d) => {
    try {
      const url = await getPrivateDocUrl(d.id);
      if (url) window.open(url, '_blank');
      else throw new Error('signed_url missing');
    } catch (e) {
      toast({ title: t('doc.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const verify = async (d) => {
    setBusy(true);
    try {
      const payload = { estado: 'verificado', fecha_revision: new Date().toISOString().slice(0, 10) };
      await base44.entities.DocumentoSocio.update(d.id, payload);
      await logAudit({ tenant_id: d.tenant_id, accion: 'documento_socio_verificado', entidad_tipo: 'DocumentoSocio', entidad_id: d.id, valores_anteriores: { estado: d.estado }, valores_nuevos: payload });
      qc.invalidateQueries({ queryKey: ['documentosSocio'] });
      toast({ title: t('doc.verified') });
    } catch (e) {
      toast({ title: t('doc.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  const reject = async (motivo) => {
    const d = rechazo;
    setBusy(true);
    try {
      const payload = { estado: 'rechazado', motivo_rechazo: motivo, fecha_revision: new Date().toISOString().slice(0, 10) };
      await base44.entities.DocumentoSocio.update(d.id, payload);
      await logAudit({ tenant_id: d.tenant_id, accion: 'documento_socio_rechazado', entidad_tipo: 'DocumentoSocio', entidad_id: d.id, valores_anteriores: { estado: d.estado }, valores_nuevos: payload });
      qc.invalidateQueries({ queryKey: ['documentosSocio'] });
      toast({ title: t('doc.rejected') });
      setRechazo(null);
    } catch (e) {
      toast({ title: t('doc.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title={t('nav.documentos')} description={t('module.documentos.desc')} />
      <Tabs defaultValue="socios">
        <TabsList className="mb-4">
          <TabsTrigger value="socios">{t('doc.tabSocios')}</TabsTrigger>
          <TabsTrigger value="legales">{t('doc.tabLegales')}</TabsTrigger>
        </TabsList>
        <TabsContent value="socios">
          {isLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
            <DataTable columns={[
              { key: 'socio_id', label: t('fin.col.member'), render: (_, d) => socioOf(d)?.nombre_completo || '—' },
              { key: 'tipo', label: t('fin.f.type'), render: v => <span>{t('doc.' + v)}</span> },
              { key: 'nombre', label: t('inc.f.title') },
              { key: 'subido_por_email', label: 'Email' },
              { key: 'fecha_revision', label: t('leg.col.date'), render: formatDate },
              { key: 'estado', label: t('common.status'), badge: true },
              { key: 'acciones', label: '', render: (_, d) => (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => view(d)}>{t('doc.view')}</Button>
                  {staff && d.estado !== 'verificado' && (
                    <>
                      <Button size="sm" className="bg-teal-700 hover:bg-teal-800" disabled={busy} onClick={() => verify(d)}>{t('doc.verify')}</Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" disabled={busy} onClick={() => setRechazo(d)}>{t('doc.reject')}</Button>
                    </>
                  )}
                </div>
              ) }
            ]} rows={documentos} />
          )}
        </TabsContent>
        <TabsContent value="legales">
          <DataTable columns={[
            { key: 'titulo', label: t('inc.f.title') },
            { key: 'tipo', label: t('leg.col.type') },
            { key: 'visibilidad', label: t('leg.col.visibility') , render: v => <span>{st(v)}</span> },
            { key: 'fecha_documento', label: t('leg.col.date'), render: formatDate },
            { key: 'estado', label: t('common.status'), badge: true }
          ]} rows={legales} />
        </TabsContent>
      </Tabs>
      {rechazo && <RechazoDialog onConfirm={reject} onClose={() => setRechazo(null)} busy={busy} />}
    </>
  );
}
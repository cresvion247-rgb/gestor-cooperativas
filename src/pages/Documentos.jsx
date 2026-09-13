import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/erp/PageHeader';
import DataTable from '@/components/erp/DataTable';
import ArchiveTabs from '@/components/erp/ArchiveTabs';
import RechazoDialog from '@/components/documentos/RechazoDialog';
import SolicitarDocumentosDialog from '@/components/documentos/SolicitarDocumentosDialog';
import UploadDocumentoDialog from '@/components/documentos/UploadDocumentoDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { isCoopStaff, hasLimitedShell } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { getPrivateDocUrl } from '@/lib/notify';
import { findMySocio } from '@/lib/member';
import {
  archiveCounts,
  filterByArchiveTab,
  isDocumentoSocioArchived,
  isDocumentoLegalArchived,
} from '@/lib/archive';

export default function Documentos() {
  const { t, st } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const staff = isCoopStaff(user);
  const limited = hasLimitedShell(user);

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['documentosSocio'],
    queryFn: () => base44.entities.DocumentoSocio.list('-created_date', 500),
  });
  const { data: socios = [] } = useQuery({
    queryKey: ['socios'],
    queryFn: () => base44.entities.Socio.list('-created_date', 500),
  });
  const { data: legales = [], isLoading: legalesLoading } = useQuery({
    queryKey: ['documentosLegales'],
    queryFn: () => base44.entities.DocumentoLegal.list('-fecha_documento', 500),
  });
  const { data: cooperativas = [] } = useQuery({
    queryKey: ['cooperativas'],
    queryFn: () => base44.entities.Cooperativa.list(),
  });
  const { data: mySocio } = useQuery({
    queryKey: ['portal-socio', user?.email],
    queryFn: () => findMySocio(user?.email),
    enabled: Boolean(user?.email) && limited,
  });

  const [rechazo, setRechazo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [socioTab, setSocioTab] = useState('active');
  const [legalTab, setLegalTab] = useState('active');

  const socioOf = d => socios.find(s => s.id === d.socio_id);
  const coopOfSocio = socio => cooperativas.find(c => c.id === socio?.cooperativa_id);

  const scopedSocios = useMemo(() => {
    if (limited && mySocio?.id) return documentos.filter(d => d.socio_id === mySocio.id);
    return documentos;
  }, [documentos, limited, mySocio]);

  const socioCounts = useMemo(() => archiveCounts(scopedSocios, isDocumentoSocioArchived), [scopedSocios]);
  const socioRows = useMemo(
    () => filterByArchiveTab(scopedSocios, socioTab, isDocumentoSocioArchived),
    [scopedSocios, socioTab],
  );

  const legalCounts = useMemo(() => archiveCounts(legales, isDocumentoLegalArchived), [legales]);
  const legalRows = useMemo(
    () => filterByArchiveTab(legales, legalTab, isDocumentoLegalArchived),
    [legales, legalTab],
  );

  const view = async (d) => {
    if (!d.file_uri) {
      toast({ title: t('doc.noFileYet'), variant: 'destructive' });
      return;
    }
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
      await logAudit({
        tenant_id: d.tenant_id,
        accion: 'documento_socio_verificado',
        entidad_tipo: 'DocumentoSocio',
        entidad_id: d.id,
        valores_anteriores: { estado: d.estado },
        valores_nuevos: payload,
      });
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
      const payload = {
        estado: 'rechazado',
        motivo_rechazo: motivo,
        fecha_revision: new Date().toISOString().slice(0, 10),
      };
      await base44.entities.DocumentoSocio.update(d.id, payload);
      await logAudit({
        tenant_id: d.tenant_id,
        accion: 'documento_socio_rechazado',
        entidad_tipo: 'DocumentoSocio',
        entidad_id: d.id,
        valores_anteriores: { estado: d.estado },
        valores_nuevos: payload,
      });
      qc.invalidateQueries({ queryKey: ['documentosSocio'] });
      toast({ title: t('doc.rejected') });
      setRechazo(null);
    } catch (e) {
      toast({ title: t('doc.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  /** Restore rejected → solicitado (member must re-upload). Verified stays read-only in archive. */
  const restoreSocioDoc = async (d) => {
    if (d.estado !== 'rechazado') return;
    setBusy(true);
    try {
      const payload = { estado: 'solicitado', motivo_rechazo: null };
      await base44.entities.DocumentoSocio.update(d.id, payload);
      await logAudit({
        tenant_id: d.tenant_id,
        accion: 'documento_socio_reactivado',
        entidad_tipo: 'DocumentoSocio',
        entidad_id: d.id,
        valores_anteriores: { estado: d.estado },
        valores_nuevos: payload,
      });
      qc.invalidateQueries({ queryKey: ['documentosSocio'] });
      toast({ title: t('archive.restored') });
      setSocioTab('active');
    } catch (e) {
      toast({ title: t('archive.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  const setLegalEstado = async (d, estado) => {
    setBusy(true);
    try {
      await base44.entities.DocumentoLegal.update(d.id, { estado });
      await logAudit({
        tenant_id: d.tenant_id,
        accion: estado === 'archivado' ? 'documento_legal_archivado' : 'documento_legal_reactivado',
        entidad_tipo: 'DocumentoLegal',
        entidad_id: d.id,
        valores_anteriores: { estado: d.estado },
        valores_nuevos: { estado },
      });
      qc.invalidateQueries({ queryKey: ['documentosLegales'] });
      toast({ title: t(estado === 'archivado' ? 'archive.done' : 'archive.restored') });
    } catch (e) {
      toast({ title: t('archive.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  const memberUploadSocio = mySocio || null;
  const memberUploadCoop = coopOfSocio(memberUploadSocio);

  return (
    <>
      <PageHeader
        title={t('nav.documentos')}
        description={t('module.documentos.desc')}
        action={staff ? t('doc.requestAction') : (limited && memberUploadSocio ? t('doc.uploadAction') : undefined)}
        onAction={
          staff
            ? () => setRequestOpen(true)
            : (limited && memberUploadSocio ? () => setUploadTarget({ new: true }) : undefined)
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {staff && (
          <Button className="bg-[#102A43] hover:bg-[#173F5F]" onClick={() => setRequestOpen(true)}>
            {t('doc.requestAction')}
          </Button>
        )}
        {limited && memberUploadSocio && (
          <Button className="bg-[#102A43] hover:bg-[#173F5F]" onClick={() => setUploadTarget({ new: true })}>
            {t('doc.uploadAction')}
          </Button>
        )}
      </div>
      <Tabs defaultValue="socios">
        <TabsList className="mb-4">
          <TabsTrigger value="socios">{t('doc.tabSocios')}</TabsTrigger>
          {!limited && <TabsTrigger value="legales">{t('doc.tabLegales')}</TabsTrigger>}
        </TabsList>
        <TabsContent value="socios">
          <ArchiveTabs
            value={socioTab}
            onChange={setSocioTab}
            activeCount={socioCounts.active}
            archivedCount={socioCounts.archived}
          />
          {isLoading ? (
            <p className="text-slate-500">{t('common.loading')}</p>
          ) : (
            <DataTable
              columns={[
                { key: 'socio_id', label: t('fin.col.member'), render: (_, d) => socioOf(d)?.nombre_completo || '—' },
                { key: 'tipo', label: t('fin.f.type'), render: v => <span>{t('doc.' + v)}</span> },
                { key: 'nombre', label: t('inc.f.title') },
                { key: 'subido_por_email', label: 'Email' },
                { key: 'fecha_revision', label: t('leg.col.date'), render: formatDate },
                { key: 'estado', label: t('common.status'), badge: true },
                {
                  key: 'acciones',
                  label: '',
                  render: (_, d) => (
                    <div className="flex flex-wrap gap-2">
                      {d.file_uri && (
                        <Button size="sm" variant="outline" onClick={() => view(d)}>{t('doc.view')}</Button>
                      )}
                      {socioTab === 'active' && ((limited && mySocio && d.socio_id === mySocio.id) || staff) && d.estado === 'solicitado' && (
                        <Button size="sm" className="bg-teal-700 hover:bg-teal-800" onClick={() => setUploadTarget({ request: d })}>
                          {t('doc.uploadFulfill')}
                        </Button>
                      )}
                      {socioTab === 'active' && staff && d.estado === 'subido' && (
                        <>
                          <Button size="sm" className="bg-teal-700 hover:bg-teal-800" disabled={busy} onClick={() => verify(d)}>{t('doc.verify')}</Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" disabled={busy} onClick={() => setRechazo(d)}>{t('doc.reject')}</Button>
                        </>
                      )}
                      {socioTab === 'archived' && d.estado === 'rechazado' && (staff || (limited && mySocio && d.socio_id === mySocio.id)) && (
                        <>
                          {limited && mySocio && d.socio_id === mySocio.id && (
                            <Button size="sm" className="bg-teal-700 hover:bg-teal-800" onClick={() => setUploadTarget({ request: d })}>
                              {t('doc.uploadAgain')}
                            </Button>
                          )}
                          {staff && (
                            <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" disabled={busy} onClick={() => restoreSocioDoc(d)}>
                              {t('archive.unarchive')}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
              rows={socioRows}
            />
          )}
        </TabsContent>
        {!limited && (
          <TabsContent value="legales">
            <ArchiveTabs
              value={legalTab}
              onChange={setLegalTab}
              activeCount={legalCounts.active}
              archivedCount={legalCounts.archived}
            />
            {legalesLoading ? (
              <p className="text-slate-500">{t('common.loading')}</p>
            ) : (
              <DataTable
                columns={[
                  { key: 'titulo', label: t('inc.f.title') },
                  { key: 'tipo', label: t('leg.col.type') },
                  { key: 'visibilidad', label: t('leg.col.visibility'), render: v => <span>{st(v)}</span> },
                  { key: 'fecha_documento', label: t('leg.col.date'), render: formatDate },
                  { key: 'estado', label: t('common.status'), badge: true },
                  {
                    key: 'acciones',
                    label: '',
                    render: (_, d) => staff ? (
                      <div className="flex flex-wrap gap-2">
                        {legalTab === 'active' && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => setLegalEstado(d, 'archivado')}>
                            {t('archive.action')}
                          </Button>
                        )}
                        {legalTab === 'archived' && (
                          <Button size="sm" className="bg-[#102A43] hover:bg-[#173F5F]" disabled={busy} onClick={() => setLegalEstado(d, 'activo')}>
                            {t('archive.unarchive')}
                          </Button>
                        )}
                      </div>
                    ) : null,
                  },
                ]}
                rows={legalRows}
              />
            )}
          </TabsContent>
        )}
      </Tabs>
      {rechazo && <RechazoDialog onConfirm={reject} onClose={() => setRechazo(null)} busy={busy} />}
      {requestOpen && (
        <SolicitarDocumentosDialog
          socios={socios}
          cooperativas={cooperativas}
          onClose={() => setRequestOpen(false)}
        />
      )}
      {uploadTarget && memberUploadSocio && memberUploadCoop && (
        <UploadDocumentoDialog
          socio={memberUploadSocio}
          cooperativa={memberUploadCoop}
          request={uploadTarget.request || null}
          onClose={() => setUploadTarget(null)}
        />
      )}
      {uploadTarget && staff && uploadTarget.request && (
        <UploadDocumentoDialog
          socio={socioOf(uploadTarget.request)}
          cooperativa={coopOfSocio(socioOf(uploadTarget.request))}
          request={uploadTarget.request}
          onClose={() => setUploadTarget(null)}
        />
      )}
    </>
  );
}

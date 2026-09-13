import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { createPrivateDocSignedUrl } from '@/api/storage';

// Envoltorios de notificación con degradación elegante: la acción principal
// (crear incidencia, responder consulta…) nunca debe fallar por una
// notificación que no se pudo entregar.
//
// Phase 4: Base44 functions.invoke removed from the live path.
// - Alerta: client insert via entity façade (Supabase).
// - Email fan-out / member email: Edge Function stubs (fail soft until Resend/etc.).
// - Private docs: client Storage signed URL (Edge Function stub also available).

/**
 * Alerta in-app for the cooperativa. Email fan-out is best-effort via Edge Function stub.
 */
export async function notifyCooperative({ tenant_id, tipo = 'aviso', titulo, descripcion, prioridad = 'media' }) {
  try {
    const alerta = await base44.entities.Alerta.create({
      tenant_id,
      tipo,
      titulo,
      descripcion: descripcion || null,
      prioridad,
      estado: 'abierta',
    });

    // Best-effort email fan-out (stub returns emails_skipped until provider is configured).
    try {
      await supabase.functions.invoke('notificar_cooperativa', {
        body: {
          tenant_id,
          tipo,
          titulo,
          descripcion,
          prioridad,
          alerta_id: alerta?.id,
          email_only: true,
        },
      });
    } catch (e) {
      console.warn('notificar_cooperativa email stub:', e);
    }

    return { ok: true, alerta_id: alerta?.id, enviados: 0 };
  } catch (e) {
    console.warn('notificar_cooperativa falló:', e);
    return null;
  }
}

/**
 * Email a un miembro concreto — Edge Function stub until email provider is wired.
 */
export async function emailMember({ to_email, asunto, cuerpo }) {
  try {
    const { data, error } = await supabase.functions.invoke('enviar_email_miembro', {
      body: { to_email, asunto, cuerpo },
    });
    if (error) throw error;
    return data || null;
  } catch (e) {
    console.warn('enviar_email_miembro falló:', e);
    return null;
  }
}

/**
 * URL firmada temporal para abrir un documento privado de la bóveda.
 * Prefer client Storage createSignedUrl (RLS). Falls back to Edge Function stub
 * when client signing fails (e.g. needs service-role authz).
 */
export async function getPrivateDocUrl(document_id) {
  const doc = await base44.entities.DocumentoSocio.get(document_id);
  if (!doc) throw new Error('Documento no encontrado');
  if (!doc.file_uri) throw new Error('Documento sin file_uri');

  try {
    const signed = await createPrivateDocSignedUrl(doc.file_uri, 300);
    if (signed) return signed;
  } catch (clientErr) {
    console.warn('client createSignedUrl failed, trying Edge Function:', clientErr);
  }

  const { data, error } = await supabase.functions.invoke('url_documento_privado', {
    body: { document_id },
  });
  if (error) throw error;
  return data?.signed_url || null;
}

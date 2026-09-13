import { supabase } from './supabaseClient';

/** Private vault for DocumentoSocio.file_uri (object path only). */
export const BUCKET_DOCS_PRIVADOS = 'documentos-socio-privados';

/** Public bucket for Incidencia.foto_url (full public URL stored in DB). */
export const BUCKET_INCIDENCIAS = 'incidencias-fotos';

const SIGNED_URL_TTL_SEC = 300;

function safeFileName(name) {
  return String(name || 'file')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120) || 'file';
}

/**
 * Normalize a stored file_uri to a Storage object path inside documentos-socio-privados.
 * Accepts: raw path, `bucket/path`, or a full public/signed URL containing the path.
 */
export function normalizePrivateObjectPath(file_uri) {
  if (!file_uri) return null;
  let s = String(file_uri).trim();
  if (!s) return null;

  // Full URL → take pathname after /object/(public|sign)/bucket/ or /storage/v1/object/...
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const m = u.pathname.match(
        /\/storage\/v1\/object\/(?:public|sign|authenticated)\/documentos-socio-privados\/(.+)$/i
      );
      if (m) return decodeURIComponent(m[1].split('?')[0]);
      // Legacy Base44 / other hosts: cannot map — return as-is for checklist
      return s.startsWith('http') ? null : s;
    }
  } catch {
    /* fall through */
  }

  if (s.startsWith(`${BUCKET_DOCS_PRIVADOS}/`)) {
    s = s.slice(BUCKET_DOCS_PRIVADOS.length + 1);
  }
  if (s.startsWith('supabase://')) {
    s = s.replace(/^supabase:\/\/documentos-socio-privados\//i, '');
  }
  return s.replace(/^\/+/, '') || null;
}

/**
 * Upload a private socio document. Path convention: {tenant_id}/{socio_id}/{uuid}_{filename}
 * Returns { file_uri } — object path stored on documentos_socio.file_uri.
 */
export async function uploadPrivateFile({ file, tenant_id, socio_id }) {
  if (!file) throw new Error('file is required');
  if (!tenant_id) throw new Error('tenant_id is required for private upload path');

  const path = `${tenant_id}/${socio_id || 'unassigned'}/${crypto.randomUUID()}_${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET_DOCS_PRIVADOS).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return { file_uri: path };
}

/**
 * Upload an incidencia photo to the public bucket.
 * Returns { file_url } — public URL suitable for <img src> / foto_url.
 */
export async function uploadPublicFile({ file, tenant_id }) {
  if (!file) throw new Error('file is required');
  if (!tenant_id) throw new Error('tenant_id is required for public upload path');

  const path = `${tenant_id}/${crypto.randomUUID()}_${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET_INCIDENCIAS).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET_INCIDENCIAS).getPublicUrl(path);
  return { file_url: data?.publicUrl || null };
}

/**
 * Client-side signed URL for a private document object path (RLS must allow select).
 */
export async function createPrivateDocSignedUrl(file_uri, expiresIn = SIGNED_URL_TTL_SEC) {
  const path = normalizePrivateObjectPath(file_uri);
  if (!path) {
    throw new Error(
      'Cannot sign this file_uri (legacy Base44 URI or empty). Re-upload to Supabase Storage or use Edge Function with migration map.'
    );
  }
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCS_PRIVADOS)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

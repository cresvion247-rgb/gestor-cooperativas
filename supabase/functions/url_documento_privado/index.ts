// Phase 4 stub — signed URL for private socio documents with authz.
// Deploy: supabase functions deploy url_documento_privado
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (auto in hosted)
//
// Prefer client createSignedUrl when Storage RLS is enough; use this when
// service-role signing or stricter checks are required.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const BUCKET = 'documentos-socio-privados';
const TTL = 300;

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function normalizePath(file_uri: string): string | null {
  let s = String(file_uri || '').trim();
  if (!s) return null;
  if (s.startsWith(`${BUCKET}/`)) s = s.slice(BUCKET.length + 1);
  if (/^https?:\/\//i.test(s)) return null; // legacy Base44 URL — cannot sign
  return s.replace(/^\/+/, '') || null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) });
    }

    const body = await req.json();
    const document_id = String(body.document_id || '').trim();
    if (!document_id) {
      return Response.json({ error: 'document_id es obligatorio' }, { status: 400, headers: corsHeaders(origin) });
    }

    // RLS-scoped read as the caller
    const { data: doc, error: docErr } = await userClient
      .from('documentos_socio')
      .select('id, tenant_id, file_uri')
      .eq('id', document_id)
      .maybeSingle();
    if (docErr || !doc) {
      return Response.json({ error: 'Documento no encontrado' }, { status: 404, headers: corsHeaders(origin) });
    }

    const path = normalizePath(doc.file_uri);
    if (!path) {
      return Response.json(
        { error: 'file_uri is not a Supabase Storage path (legacy Base44 URI?)' },
        { status: 422, headers: corsHeaders(origin) },
      );
    }

    // Sign with service role after authz via RLS select succeeded
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, TTL);
    if (signErr || !signed?.signedUrl) {
      return Response.json({ error: signErr?.message || 'sign failed' }, { status: 500, headers: corsHeaders(origin) });
    }

    return Response.json({ signed_url: signed.signedUrl }, { headers: corsHeaders(origin) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500, headers: corsHeaders(origin) });
  }
});

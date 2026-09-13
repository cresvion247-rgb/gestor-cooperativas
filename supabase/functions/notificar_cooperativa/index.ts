// Phase 4 stub — email fan-out for cooperativa members.
// In-app Alerta is created on the client (entity façade). This function is
// email-only when body.email_only === true (default after Phase 4).
// Wire RESEND_API_KEY to actually send.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
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

    const body = await req.json().catch(() => ({}));
    const tenant_id = String(body.tenant_id || '').trim();
    const titulo = String(body.titulo || '').trim().slice(0, 200);
    const descripcion = String(body.descripcion || '').slice(0, 2000);
    if (!tenant_id || !titulo) {
      return Response.json(
        { error: 'tenant_id y titulo son obligatorios' },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      return Response.json(
        {
          ok: true,
          emails_skipped: true,
          reason: 'RESEND_API_KEY not configured',
          alerta_id: body.alerta_id || null,
          enviados: 0,
        },
        { headers: corsHeaders(origin) },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profiles } = await admin
      .from('profiles')
      .select('email, tenant_id, assigned_cooperativa_ids, estado')
      .neq('estado', 'inactivo')
      .limit(200);

    const recipients = (profiles || [])
      .filter((u) => {
        if (!u.email) return false;
        if (u.tenant_id === tenant_id) return true;
        const assigned = u.assigned_cooperativa_ids || [];
        return assigned.includes(tenant_id);
      })
      .slice(0, 50);

    const from = Deno.env.get('EMAIL_FROM') || 'noreply@example.com';
    let enviados = 0;
    for (const r of recipients) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from, to: [r.email], subject: titulo, text: descripcion }),
        });
        if (res.ok) enviados++;
      } catch {
        /* degrade */
      }
    }

    return Response.json(
      { ok: true, alerta_id: body.alerta_id || null, enviados },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500, headers: corsHeaders(origin) });
  }
});

// Phase 4 stub — member email.
// Wire Resend / Postmark / Supabase Auth email later; do not commit API keys.
// Expected secrets (when live): RESEND_API_KEY or EMAIL_PROVIDER_*

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
    const to_email = String(body.to_email || '').trim().toLowerCase();
    const asunto = String(body.asunto || '').slice(0, 200);
    const cuerpo = String(body.cuerpo || '').slice(0, 5000);

    if (!to_email || !asunto || !cuerpo) {
      return Response.json(
        { error: 'to_email, asunto y cuerpo son obligatorios' },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      // Soft stub — client already degrades; document in PHASE4_SUMMARY / DEPLOY
      return Response.json(
        {
          ok: false,
          skipped: true,
          reason: 'RESEND_API_KEY not configured. See PHASE4_SUMMARY.md checklist.',
        },
        { headers: corsHeaders(origin) },
      );
    }

    // Minimal Resend send when key is present (from_email must be verified domain)
    const from = Deno.env.get('EMAIL_FROM') || 'noreply@example.com';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to_email], subject: asunto, text: cuerpo }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: detail }, { status: 502, headers: corsHeaders(origin) });
    }
    return Response.json({ ok: true }, { headers: corsHeaders(origin) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500, headers: corsHeaders(origin) });
  }
});

// Phase 4 stub — neural TTS (was Base44 Core.GenerateSpeech).
// Client now uses browser speechSynthesis. Deploy + wire a TTS vendor later
// if product requires hosted audio URLs again.

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

  return Response.json(
    {
      ok: false,
      skipped: true,
      reason:
        'concierge_hablar stub — use client speechSynthesis or configure a TTS provider. See PHASE4_SUMMARY.md.',
      url: null,
    },
    { headers: corsHeaders(origin) },
  );
});

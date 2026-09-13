# Supabase Edge Functions (Phase 4 stubs)

| Function | Purpose | Status |
|----------|---------|--------|
| `url_documento_privado` | Authz + signed URL for `documentos-socio-privados` | Implementable; prefers service-role sign after RLS read |
| `enviar_email_miembro` | Email one member | Stub until `RESEND_API_KEY` (+ `EMAIL_FROM`) |
| `notificar_cooperativa` | Email fan-out (alerta created on client) | Stub until Resend |
| `concierge_hablar` | Neural TTS | Stub; client uses `speechSynthesis` |

Deploy example:

```bash
supabase functions deploy url_documento_privado
supabase functions deploy enviar_email_miembro
supabase functions deploy notificar_cooperativa
supabase functions deploy concierge_hablar
supabase secrets set RESEND_API_KEY=... EMAIL_FROM=Urbalex <noreply@yourdomain.com>
```

Do not commit secrets. Concierge agent tools (`concierge_alerta`, etc.) are **not** ported — checklist in PHASE4_SUMMARY.md.

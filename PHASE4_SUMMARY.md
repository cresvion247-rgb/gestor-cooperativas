# Phase 4 Summary — Uploads & side effects

## Approach

1. **Client Supabase Storage** for both upload sites (private socio docs + public incidencia photos).
2. **Client alerta create** for `notifyCooperative` (entity façade); email fan-out via Edge Function stub.
3. **Signed URLs** for private docs: client `createSignedUrl` first; Edge Function `url_documento_privado` as authz/service-role fallback.
4. **Concierge / WhatsApp / neural TTS:** UI kept; agents stub + browser `speechSynthesis`; no fake LLM.
5. **`@base44/*` packages remain installed** (Phase 5). Live `Core.Upload*` / `base44.functions.invoke` / `base44.agents.*` removed from product call sites.

## What changed (file list)

| Path | Action |
|------|--------|
| `src/api/storage.js` | **Added** — bucket constants, upload helpers, signed URL + path normalize |
| `src/api/agentsStub.js` | **Added** — local Concierge conversations; `addMessage` fails gracefully |
| `src/lib/notify.js` | **Rewritten** — no Base44 invoke; alerta client + `supabase.functions.invoke` stubs |
| `src/components/intake/IntakeForm.jsx` | **Wired** → `uploadPrivateFile` |
| `src/components/incidencias/IncidenciaDialog.jsx` | **Wired** → `uploadPublicFile` |
| `src/pages/Documentos.jsx` | **Wired** → `getPrivateDocUrl` (was direct `functions.invoke`) |
| `src/components/concierge/ConciergePanel.jsx` | **Wired** → `agentsStub` (UI unchanged) |
| `src/lib/spokenReplies.js` | **Rewritten** — browser TTS; no `concierge_hablar` invoke |
| `src/components/ui/image-helpers.js` | **Comment** — non-Base44/Supabase URLs pass through |
| `src/api/base44Client.js` | **Comment** — Phase 4 live-path note |
| `supabase/functions/url_documento_privado/index.ts` | **Added** — Deno stub (sign after RLS read) |
| `supabase/functions/enviar_email_miembro/index.ts` | **Added** — Resend-ready stub |
| `supabase/functions/notificar_cooperativa/index.ts` | **Added** — email fan-out stub |
| `supabase/functions/concierge_hablar/index.ts` | **Added** — TTS stub |
| `supabase/functions/README.md` | **Added** |
| `STORAGE.md` | **Added** — buckets + deploy notes |
| `PHASE4_SUMMARY.md` | **Added** — this file |

**Unchanged by design:** entity façades, auth, UX/copy, schema table defs, `@base44` package install, Base44 Deno sources under `base44/functions/` (dead for client; Phase 5 cleanup).

## Bucket names (exact)

| Bucket | Visibility | Call site | Stored value |
|--------|------------|-----------|--------------|
| `documentos-socio-privados` | private | IntakeForm | `file_uri` = object path |
| `incidencias-fotos` | public | IncidenciaDialog | `foto_url` = public URL |

## Removed from live path

| Base44 surface | Replacement |
|----------------|-------------|
| `Core.UploadPrivateFile` | `uploadPrivateFile` → Storage private bucket |
| `Core.UploadFile` | `uploadPublicFile` → Storage public bucket |
| `functions.invoke('url_documento_privado')` | `getPrivateDocUrl` (client sign ± Edge stub) |
| `functions.invoke('notificar_cooperativa')` | Client `Alerta.create` + email Edge stub |
| `functions.invoke('enviar_email_miembro')` | `supabase.functions.invoke('enviar_email_miembro')` stub |
| `functions.invoke('concierge_hablar')` | `speechSynthesis` in `spokenReplies.js` |
| `agents.list/get/createConversation`, `addMessage`, `subscribeToConversation`, `getWhatsAppConnectURL` | `agentsStub` |

## Function / agent disposition

| Name | Disposition | Equivalent |
|------|-------------|------------|
| `url_documento_privado` | **Replaced** | Client Storage signed URL + Edge Function stub |
| `enviar_email_miembro` | **Stub** | Edge Function; soft-skip without `RESEND_API_KEY` |
| `notificar_cooperativa` | **Partial** | Client alerta = working; email = stub |
| `concierge_hablar` | **Stub / client** | Browser TTS; Edge stub unused by client |
| `concierge_alerta` / `_contrato` / `_finanzas` / `_incidencia` / `_perfil_socio` | **Checklist** | Agent tools — no client call sites; need LLM agent rewrite |
| Agent `concierge` | **Stub** | `agentsStub` — UI opens, send shows error toast |
| WhatsApp connect URL | **Stub** | `#concierge-whatsapp-not-configured` |
| `Core.CreateFileSignedUrl` | **Replaced** | `storage.createSignedUrl` |
| `Core.SendEmail` | **Checklist / stub** | Resend in Edge Functions when secret set |
| `Core.GenerateSpeech` | **Replaced (approx.)** | `speechSynthesis` |
| `media.base44.com` transforms | **Kept for legacy** | Non-Wix URLs (incl. Supabase public) pass through |

## Human checklist (outside repo)

1. Create Storage buckets `documentos-socio-privados` (private) and `incidencias-fotos` (public). See `STORAGE.md`.
2. Uncomment + apply Storage RLS policies in `schema.sql`.
3. Deploy Edge Functions under `supabase/functions/` (optional until email/signing fallback needed).
4. Set secrets: `RESEND_API_KEY`, `EMAIL_FROM` (verified domain) — never commit.
5. Confirm public incidencia photo URLs load in UI (`foto_url` / view photo link).
6. Confirm private doc open from Documentos + PortalSocio (signed URL).
7. **Intake upload authz:** applicants may lack `can_mutate_tenant` for the target coop — may need a dedicated Edge upload or relaxed Storage insert policy for authenticated intake. Validate against real roles.
8. Concierge: choose LLM provider + tool Edge Functions; WhatsApp/Telegram connector; optional neural TTS — product decision, not done here.
9. Migrate/re-upload any legacy Base44 `file_uri` values (cannot sign as-is).

## Leftovers → Phase 5

- Uninstall `@base44/sdk`, `@base44/vite-plugin`; delete `base44/` tree, `app-params` Base44 tokens, vite plugin config.
- Full `DEPLOY.md` (Vercel SPA rewrite, env, Auth URLs, Storage, email).
- Invite user Edge Function (Phase 2 stub still).
- Concierge full replacement.
- Grep cleanup of remaining `base44` string references / dead imports.

## Grep check (src live path)

| Pattern | Expected after Phase 4 |
|---------|------------------------|
| `base44.integrations.Core.Upload` | **0** |
| `base44.functions.invoke` | **0** |
| `base44.agents.` | **0** |
| `supabase.functions.invoke` | notify.js only (stubs) |
| `uploadPrivateFile` / `uploadPublicFile` | IntakeForm / IncidenciaDialog |

## Blockers / notes

1. **Buckets + Storage RLS must exist** before uploads succeed at runtime.
2. **Intake Storage policy vs applicant role** — possible 403 on private upload (see checklist §7).
3. **Email** soft-fails until Resend (or other) secrets are set; in-app alertas still work.
4. **Concierge** does not answer; UI preserved with toast on send — intentional.
5. **Legacy file_uri** from Base44 vault will fail signing until remapped/re-uploaded.
6. Node / package engines unchanged; `@base44/*` still in `package.json` until Phase 5.

## Recommended next phase

**Phase 5 — Platform cleanup:** remove Base44 packages & vite plugin, env rename, `vercel.json`, full `DEPLOY.md`, dead code under `base44/`.

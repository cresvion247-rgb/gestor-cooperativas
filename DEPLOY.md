# Deploy — Urbalex ERP

Vite + React SPA → Vercel. Backend is Supabase (Auth, Postgres + RLS, Storage, optional Edge Functions).

This is not a Base44 app. There is no `base44` CLI, no hosted Base44 backend, and no `@base44/*` runtime dependency.

---

## 1. Environment variables

### Client (Vite / Vercel)

Set in `.env.local` for local work and in **Vercel → Project → Settings → Environment Variables** for Preview + Production. Never commit real values.

| Variable | Where used | Notes |
|----------|------------|--------|
| `VITE_SUPABASE_URL` | `src/api/supabaseClient.js` | Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | `src/api/supabaseClient.js` | Project Settings → API → `anon` `public` key |

There are **no** `VITE_BASE44_*` variables. Service role keys and Resend secrets must **not** be prefixed with `VITE_` and must never ship in the frontend bundle.

### Template

See `.env.example`. Copy to `.env.local`:

```bash
cp .env.example .env.local
```

---

## 2. Supabase project — run schema once

1. Create a Supabase project (region close to users).
2. Open **SQL Editor** and run **`supabase/schema.sql` once**.
   - Creates extensions, helper functions (`is_platform_admin`, `can_access_tenant`, `can_mutate_tenant`), `public.profiles` + trigger from `auth.users`, all domain tables, RLS policies, and grants.
   - Storage **policies at the bottom are commented**. Uncomment and run them **after** the buckets exist (section 3).
3. Do not re-run the whole file blindly on a live database (it is a create-once script, not a migration chain). Subsequent changes should be additive SQL.

After the first user signs up, promote a platform Super Admin by setting `public.profiles.role = 'admin'` for that `id` (Dashboard → Table Editor or SQL). Until then, tenant RLS will hide most rows from an ordinary `user`.

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

---

## 3. Storage buckets

Exact names the client uses (`src/api/storage.js`):

| Bucket id | Public? | Call site | Stored column |
|-----------|---------|-----------|---------------|
| `documentos-socio-privados` | **private** | IntakeForm → `uploadPrivateFile` | `documentos_socio.file_uri` = **object path** |
| `incidencias-fotos` | **public** | IncidenciaDialog → `uploadPublicFile` | `incidencias.foto_url` = **public URL** |

Path conventions:

- Private: `{tenant_id}/{socio_id}/{uuid}_{filename}`
- Public: `{tenant_id}/{uuid}_{filename}`

Create via Dashboard → Storage, or SQL (also commented in `schema.sql`):

```sql
insert into storage.buckets (id, name, public)
values
  ('documentos-socio-privados', 'documentos-socio-privados', false),
  ('incidencias-fotos', 'incidencias-fotos', true)
on conflict (id) do nothing;
```

Then uncomment and run the Storage RLS policies at the bottom of `supabase/schema.sql`.

Details: **[STORAGE.md](./STORAGE.md)**.

**Intake caveat:** applicants may lack `can_mutate_tenant` for the target cooperativa — private upload can 403 until you add a dedicated Edge upload or a relaxed insert policy. Validate against real roles.

**Legacy `file_uri`:** old Base44 vault URIs cannot be signed by Supabase Storage. Re-upload or keep a migration map.

---

## 4. Auth providers and redirect URLs

### Providers used by this app

| Provider | Pages | Supabase Dashboard |
|----------|-------|--------------------|
| Email / password | Login, Register, Forgot, Reset | Authentication → Providers → Email |
| Google OAuth | Login + Register (`signInWithOAuth({ provider: 'google' })`) | Authentication → Providers → Google |
| Email confirmation / 6-digit OTP | Register (`verifyOtp` type `signup` + `resend`) | Email confirmations ON if you want the OTP step; OFF if session is returned immediately |
| Password recovery | Forgot → email link → `/reset-password` | Email templates → Reset password |

Magic-link-as-primary-login is **not** a product flow. Invite-by-email from Administracion is **stubbed** (anon key cannot call `auth.admin.inviteUserByEmail`). Until an invite Edge Function exists: create the user in Dashboard → Auth, then edit `profiles` (`app_role`, `tenant_id`, `assigned_cooperativa_ids`).

### URL configuration

Dashboard → Authentication → URL Configuration. The app always uses `window.location.origin` for `redirectTo` / `emailRedirectTo`.

| Setting | Local | Production |
|---------|-------|------------|
| **Site URL** | `http://localhost:5173` | `https://<your-app>.vercel.app` (or custom domain) |
| **Redirect URLs** | `http://localhost:5173/**` | `https://<your-app>.vercel.app/**` plus any custom domain `https://erp.example.com/**` |

Flows that need these allow-lists:

| Flow | Redirect |
|------|----------|
| Google OAuth | `{origin}{returnTo}` (default `/`) |
| Register confirmation | `{origin}{returnTo}` |
| Forgot password | `{origin}/reset-password` |

Add **both** localhost and the Vercel URL (and Preview URLs if you test OAuth on previews).

---

## 5. Realtime

**No entity tables are subscribed via Supabase Realtime.** Pages poll with TanStack Query.

The only historical subscribe was Concierge `agents.subscribeToConversation`, now a no-op in `src/api/agentsStub.js`. You do **not** need to add tables to `supabase_realtime` for the current UI.

If you later enable Realtime, do it explicitly per table in Dashboard → Database → Publications — do not assume it is on.

---

## 6. Edge Functions and secrets

Sources: `supabase/functions/` (Deno stubs). Not required for first login + CRUD; required for email fan-out and optional signed-URL fallback.

| Function | Purpose | Status |
|----------|---------|--------|
| `url_documento_privado` | Authz + signed URL if client `createSignedUrl` fails | Implementable stub |
| `enviar_email_miembro` | Email one member | Soft-skip without secret |
| `notificar_cooperativa` | Email fan-out (alerta is created on the client) | Soft-skip without secret |
| `concierge_hablar` | Neural TTS | Unused by client (`speechSynthesis`) |

Deploy:

```bash
supabase functions deploy url_documento_privado
supabase functions deploy enviar_email_miembro
supabase functions deploy notificar_cooperativa
supabase functions deploy concierge_hablar
```

### Secrets (Dashboard → Edge Functions → Secrets, or `supabase secrets set`)

| Secret | Used by | Notes |
|--------|---------|--------|
| `RESEND_API_KEY` | `enviar_email_miembro`, `notificar_cooperativa` | Never commit |
| `EMAIL_FROM` | same | Verified domain, e.g. `Urbalex <noreply@yourdomain.com>` |

Hosted functions already receive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Do not put the service role in Vercel `VITE_*` vars.

**Not ported (checklist, not blockers for launch):** Concierge LLM tools (`concierge_alerta`, `concierge_contrato`, `concierge_finanzas`, `concierge_incidencia`, `concierge_perfil_socio`), WhatsApp/Telegram connector, invite-user Edge Function.

---

## 7. Vercel (SPA)

`vercel.json` already rewrites every non-file path to `/index.html` so `BrowserRouter` routes (`/login`, `/cooperativas`, `/portal`, …) work on refresh.

1. Import the Git repo (framework preset: Vite).
2. Build command: `npm run build` (default). Output: `dist`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Confirm a hard refresh on `/login` and `/cooperativas` does not 404.
5. Add the production (and preview) origins to Supabase Redirect URLs (section 4).

---

## 8. Unused Base44-only routes

These files remain in the tree but are **not registered** in `src/App.jsx`. They are dead product routes.

| File | Why unused |
|------|------------|
| `src/pages/OAuthConsent.jsx` | Base44 MCP OAuth consent. There is no `base44/mcp` server and no `/oauth-consent` (or similar) route. |
| `src/lib/app-params.js` | Only imported by OAuthConsent. Neutralized — no SDK, empty params. |

Do not add them to the router unless you rebuild an MCP consent server.

---

## 9. Launch checklist (adapted to this app)

### Supabase

- [ ] Project created; `schema.sql` executed once
- [ ] First user exists; `profiles.role = 'admin'` for at least one operator
- [ ] Email provider enabled; confirmations match the Register OTP UX you want
- [ ] Google provider enabled (client id/secret from Google Cloud)
- [ ] Site URL + Redirect URLs include localhost and the Vercel host
- [ ] Buckets `documentos-socio-privados` (private) and `incidencias-fotos` (public) exist
- [ ] Storage RLS policies from `schema.sql` uncommented and applied
- [ ] (Optional) Edge Functions deployed; `RESEND_API_KEY` + `EMAIL_FROM` set
- [ ] No service-role key in any `VITE_*` or git-tracked file

### Vercel / frontend

- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set for Production (and Preview)
- [ ] `vercel.json` present (SPA rewrite)
- [ ] `npm run build` succeeds locally
- [ ] Hard-refresh of a deep route serves the app, not a Vercel 404

### Product smoke (after env + schema)

- [ ] Register + email confirm / OTP (or immediate session if confirmations off)
- [ ] Login email/password
- [ ] Login Google (redirect lands back on origin)
- [ ] Forgot → email → `/reset-password` updates password
- [ ] Inactive user (`profiles.estado = 'inactivo'`) sees the blocked screen
- [ ] Cooperativas / Proyectos / Socios list + create/update (RLS: tenant or admin)
- [ ] Intake private upload opens later from Documentos / PortalSocio (signed URL)
- [ ] Incidencia photo displays via public `foto_url`
- [ ] Comunicaciones alerta create works even if email Edge Function is unset
- [ ] Concierge panel opens; send shows the stub toast (intentional — no LLM)
- [ ] Administracion invite button shows the Edge Function checklist toast

### Explicit non-goals / leftovers

- [ ] Data migration from a former Base44 vault (credentials/export not in this repo)
- [ ] Invite-user Edge Function
- [ ] Concierge LLM + WhatsApp
- [ ] Neural TTS (`concierge_hablar`) — browser `speechSynthesis` is enough
- [ ] Stripe packages are unused in `src/` — ignore unless you add billing

---

## 10. Local vs production

```bash
# local
cp .env.example .env.local   # then fill VITE_*
npm install
npm run dev                  # http://localhost:5173

# production bundle
npm run build
npm run preview
```

Never run a second undocumented backend for this frontend. The only APIs the UI calls are Supabase REST/Auth/Storage and (optionally) `supabase.functions.invoke` for the stubs in `src/lib/notify.js`.

# Phase 0 Inventory — Urbalex ERP (gestor-cooperativas)

**App name (Base44):** Urbalex ERP  
**Export path:** `/workspace/gestor-cooperativas`  
**Target GitHub (later, not this phase):** private `cresvion247-rgb/gestor-cooperativas`  
**Phase scope:** discovery + mapping draft only — no schema.sql, no auth swap, no Base44 package removal.

---

## 1. Stack summary

| Layer | Choice |
|--------|--------|
| Build | **Vite 8** (`vite.config.js`) + `@vitejs/plugin-react` |
| UI | **React 18** (JSX, not Next.js) |
| Router | **react-router-dom v6** `BrowserRouter` + `<Routes>` — **SPA** |
| Data fetching | **TanStack React Query** v5 |
| UI kit | **shadcn/ui** (New York) + **Radix** primitives + **Tailwind CSS 3** + lucide-react |
| Forms / validation | react-hook-form + zod (+ `@hookform/resolvers`) |
| Charts / PDF / maps | recharts, jspdf/html2canvas, react-leaflet, three (present) |
| Backend today | **Base44** (`@base44/sdk` + `@base44/vite-plugin`) — entities, auth, functions, agents, Core integrations |
| Package name | `base44-app` (private) |

**One-liner:** Vite + React 18 SPA (react-router-dom BrowserRouter), shadcn/Radix/Tailwind, TanStack Query, fully coupled to Base44 SDK for data/auth/functions/agents.

**Not used in product code (deps present only):** `@stripe/*` (no `src/` imports found). `nitro` appears in devDependencies with no nitro/vercel config in-repo.

---

## 2. Base44 surface area (packages & imports)

| Item | Location / notes |
|------|------------------|
| `@base44/sdk` | `package.json`; `createClient` in `src/api/base44Client.js`; `getAccessToken` in `src/lib/app-params.js` |
| `@base44/vite-plugin` | `vite.config.js` (`legacySDKImports`, HMR/navigation/analytics/visualEditAgent) |
| `base44Client` | `src/api/base44Client.js` → exported `base44` singleton |
| `media.base44.com` | `src/components/ui/image-helpers.js` (+ comment in `image.jsx`) — Wix/Base44 public image CDN transforms |
| Deno functions | `base44/functions/*/entry.ts` via `npm:@base44/sdk@0.8.44` `createClientFromRequest` |
| Agent | `base44/agents/concierge.jsonc` + client `base44.agents.*` |
| Shared server helpers | `base44/shared/concierge.ts` |
| Config | `base44/config.jsonc` (site build/serve → `./dist`) |
| `.npmrc` | cooldown + `min-release-age-exclude=@base44/*` |
| Env (client) | `VITE_BASE44_APP_ID`, `VITE_BASE44_FUNCTIONS_VERSION`, `VITE_BASE44_APP_BASE_URL` |
| Tokens | `localStorage` keys `base44_access_token`, `token` |

No `base44/mcp/` directory in this export. `src/pages/OAuthConsent.jsx` exists (MCP consent comments) but is **not** registered in `App.jsx` routes.

---

## 3. Entities → proposed Postgres tables

Discovered from `base44/entities/*.jsonc` (19 entity files). System fields used in call sites (`id`, `created_date`, `updated_date`) are Base44-managed and should be modeled as `id uuid` + timestamps on every table.

| Base44 entity | Proposed table | Key fields (schema) | Call-site ops in `src/` |
|---------------|----------------|---------------------|-------------------------|
| **Cooperativa** | `cooperativas` | tenant_id, nombre, cif, forma_juridica, estado, direccion, municipio, provincia, codigo_postal, email, telefono, fecha_constitucion, administrador_urbalex, notas | list, create, update |
| **Proyecto** | `proyectos` | tenant_id, cooperativa_id, nombre, codigo, estado, direccion, municipio, provincia, referencia_catastral, responsable, inicio/fin previstos, fin_estimado, viviendas, presupuesto_total, coste_comprometido, coste_real, riesgo, progreso_previsto/real, resumen | list, update |
| **Socio** | `socios` | tenant_id, cooperativa_id, nombre_completo, dni_nie, email, telefono, direccion, estado, fecha_admision, vivienda_id, referencia_pago, preferencia_comunicacion | list, filter, get, create, update |
| **Vivienda** | `viviendas` | tenant_id, proyecto_id, referencia, bloque, planta, puerta, tipologia, dormitorios, metros_cuadrados, estado, socio_id, coste_estimado, coste_final | list, get, update |
| **Adjudicacion** | `adjudicaciones` | tenant_id, cooperativa_id, proyecto_id, socio_id, vivienda_id, fecha_adjudicacion, estado, importe, notas | list, filter, create, update |
| **Aportacion** | `aportaciones` | tenant_id, cooperativa_id, proyecto_id, socio_id, tipo, fecha_vencimiento, importe_debido/pagado/pendiente, estado, referencia | list, filter, create, update |
| **Contrato** | `contratos` | tenant_id, cooperativa_id, proyecto_id, codigo, titulo(+traducido), categoria, contraparte, estado, responsable, fechas, importes, moneda, riesgo, terminos_pago, garantia_requerida, exige_modificacion, procedencia | list, create, update |
| **ContratoModificacion** | `contrato_modificaciones` | tenant_id, cooperativa_id, contrato_id, motivo, descripcion, importes/fechas anteriores/nuevas, terminos_pago_nuevos, estado, fechas solicitud/aplicación, solicitado_por, notas | filter, create, update |
| **Licitacion** | `licitaciones` | tenant_id, cooperativa_id, proyecto_id, titulo, categoria, referencia, estado, fechas, presupuesto_base, requisitos, proveedor_adjudicado_id, notas | list, create, update |
| **Oferta** | `ofertas` | tenant_id, cooperativa_id, licitacion_id, proveedor_id, importe, plazo_ejecucion, puntuacion, observaciones, estado, fecha_presentacion | list, create, update |
| **Proveedor** | `proveedores` | tenant_id, cooperativa_id, nombre, cif_nif, categoria, contacto_nombre, email, telefono, direccion, valoracion, estado, fecha_homologacion, notas | list, create, update |
| **Incidencia** | `incidencias` | tenant_id, cooperativa_id, proyecto_id, socio_id, titulo, descripcion, categoria, prioridad, estado, foto_url, asignado_a, resolucion, fecha_resolucion | list, create, update, get (socio) |
| **Alerta** | `alertas` | tenant_id, tipo, titulo(+traducido), descripcion(+traducida), prioridad, fecha_limite, estado, entidad_tipo, entidad_id | list, create, update |
| **Consulta** | `consultas` | tenant_id, cooperativa_id, socio_id, solicitante_email, categoria, asunto, mensaje, origen, estado, respuesta, conversacion | list, filter, create, update |
| **DocumentoSocio** | `documentos_socio` | tenant_id, cooperativa_id, socio_id, tipo, nombre, **file_uri**, subido_por_email, estado, fecha_revision, motivo_rechazo | list, filter, create, update |
| **DocumentoLegal** | `documentos_legales` | tenant_id, cooperativa_id, proyecto_id, titulo(+traducido), tipo, referencia, fecha_documento, estado, visibilidad, resumen(+traducido) | list, create, update |
| **ExpedienteUrbanistico** | `expedientes_urbanisticos` | tenant_id, proyecto_id, tipo, administracion, referencia_oficial, estado, fechas, responsable, riesgo, requisitos, notas | list, create, update |
| **AuditLog** | `audit_logs` | tenant_id, accion, entidad_tipo, entidad_id, usuario_id/email/rol, valores_anteriores/nuevos, ip_direccion, detalle, fecha | list, filter, create |
| **User** | see §4 (not a plain domain table) | role, app_role, tenant_id, assigned_cooperativa_ids[], interface_language, estado | list, update (+ invite API) |

**Multi-tenancy note:** Nearly every entity is scoped by `tenant_id` (often = cooperativa identity). RLS in JSONC allows: own `tenant_id`, `assigned_cooperativa_ids`, or platform `role === admin`. Soft-delete patterns: several entities set `"delete": false` (e.g. Adjudicacion, Aportacion, Contrato, AuditLog, Documento*).

**Central tenant constant:** `urbalex-central` (`src/lib/permissions.js`).

---

## 4. Base44 User → auth.users + public.profiles

| Concern | Mapping |
|---------|---------|
| Identity / credentials | Supabase (or equiv.) **`auth.users`** — email/password, Google OAuth, password reset, OTP verify |
| App profile | **`public.profiles`** (`id uuid PK/FK → auth.users.id`) |

**Profile fields used in this app (from User.jsonc + call sites):**

| Field | Usage |
|-------|--------|
| `role` | Platform: `admin` \| `user` (super admin = `role === 'admin'`) |
| `app_role` | Functional ERP profile enum (10 values; see permissions) |
| `tenant_id` | Home cooperativa (null for some internal staff) |
| `assigned_cooperativa_ids` | `text[]` / `uuid[]` — Urbalex internal multi-coop assignment |
| `interface_language` | `es` \| `en` \| `eu` \| `fr` — synced via `auth.updateMe` / i18n |
| `estado` | `activo` \| `inactivo` — blocks UI (`InactiveUserScreen`) |
| `email` | From auth user; displayed / used for Socio matching & invites |

**Auth flows found in `src/`:**

| Flow | API / page |
|------|------------|
| Email + password login | `base44.auth.loginViaEmailPassword` — `Login.jsx` |
| Google OAuth | `base44.auth.loginWithProvider("google", …)` — Login + Register |
| Register + OTP | `auth.register` → `auth.verifyOtp` → `auth.setToken`; `auth.resendOtp` — `Register.jsx` |
| Forgot password | `auth.resetPasswordRequest(email)` — `ForgotPassword.jsx` |
| Reset password | `auth.resetPassword({ resetToken, newPassword })` — `ResetPassword.jsx` |
| Session | `auth.me`, `auth.logout`, `auth.redirectToLogin`, `app.getPublicSettings` — `AuthContext.jsx` |
| Update self | `auth.updateMe({ interface_language })` — `i18n.jsx` |
| Invite user | `base44.users.inviteUser(email, 'admin'|'user')` then `entities.User.update` — `UsersPanel.jsx` |
| Magic link | **Not found** as a dedicated flow |

---

## 5. Base44 functions / agent / email → migration disposition

These are **leftovers** (not Postgres tables). Count of function entrypoints: **9**. Plus **1 agent** and Core integrations used from functions.

| Name | Kind | Client call sites | Proposed equivalent |
|------|------|-------------------|---------------------|
| `url_documento_privado` | Function | `Documentos.jsx`, `notify.js` | **Edge Function** — authz check + signed URL from Storage |
| `enviar_email_miembro` | Function (+ `Core.SendEmail`) | `notify.js`; called by other functions | **Edge Function** + email provider (Resend/Postmark/Supabase) |
| `notificar_cooperativa` | Function (+ Alerta create + email) | `notify.js`; concierge_contrato/incidencia | Split: client insert into `alertas` **or** Edge Function that inserts + fans out email |
| `concierge_hablar` | Function (`Core.GenerateSpeech`) | `spokenReplies.js` | **Edge Function** / TTS vendor; or drop if voice optional |
| `concierge_alerta` | Function (agent tool) | Agent only | Edge Function **or** replace with RLS-safe client CRUD + audit |
| `concierge_contrato` | Function (agent tool) | Agent only | Same |
| `concierge_finanzas` | Function (agent tool) | Agent only | Same |
| `concierge_incidencia` | Function (agent tool) | Agent only | Same |
| `concierge_perfil_socio` | Function (agent tool) | Agent only | Same |
| **Agent `concierge`** | Agent/MCP-style | `ConciergePanel.jsx`: list/get/createConversation, addMessage, **subscribeToConversation**, getWhatsAppConnectURL | **Manual checklist** — replace with own LLM agent (Edge + tools), or third-party; WhatsApp/Telegram connectors are Base44-hosted leftovers |
| `Core.UploadFile` | Integration | `IncidenciaDialog.jsx` → `foto_url` | Client → **Supabase Storage** (public or signed) |
| `Core.UploadPrivateFile` | Integration | `IntakeForm.jsx` → `DocumentoSocio.file_uri` | **Private Storage bucket** + path in DB |
| `Core.CreateFileSignedUrl` | Integration | `url_documento_privado` | Storage signed URLs |
| `Core.SendEmail` | Integration | email functions | Email provider |
| `Core.GenerateSpeech` | Integration | `concierge_hablar` | TTS provider |
| `asServiceRole` | Privileged SDK | several functions | Supabase **service role** only inside Edge Functions |

**Function leftovers count: 9** (plus 1 agent + Core integrations above).

---

## 6. Uploads / realtime / i18n / env / router

### Uploads

| Site | API | Host / storage semantics |
|------|-----|---------------------------|
| `src/components/intake/IntakeForm.jsx` | `base44.integrations.Core.UploadPrivateFile` | Private vault; URI stored on `DocumentoSocio.file_uri`; opened via signed URL function |
| `src/components/incidencias/IncidenciaDialog.jsx` | `base44.integrations.Core.UploadFile` | Public-ish file URL → `Incidencia.foto_url` |
| Image CDN helper | `media.base44.com` / `static.wixstatic.com` | Client-side transform helpers only — migrate off or leave for legacy URLs |

### Realtime / subscribe

| Site | API |
|------|-----|
| `src/components/concierge/ConciergePanel.jsx` | `base44.agents.subscribeToConversation(conversation.id, cb)` |

No `entities.*.subscribe` usage found. Entity data is poll/query-based (React Query).

### i18n

- Custom provider: `src/lib/i18n.jsx` (`LANG_STORAGE_KEY = urbalex_lang`)
- Locales: `es`, `en`, `eu`, `fr` JSON under `src/lib/locales/` + `status.json`
- Aggregated in `src/lib/translations.js`
- Preference persisted to User.`interface_language` when session exists
- UI: `LanguageSelector.jsx`
- **Not** react-i18next / next-intl / GTranslate

### Env vars

| Variable | Role |
|----------|------|
| `VITE_BASE44_APP_ID` | App id for SDK |
| `VITE_BASE44_FUNCTIONS_VERSION` | Functions pin |
| `VITE_BASE44_APP_BASE_URL` | App base URL |
| `BASE44_LEGACY_SDK_IMPORTS` | Vite plugin flag (build-time `process.env`) |

No `.env` / `.env.example` in the zip. `base44/.app.jsonc` is gitignored (per README) and absent here.

### Router → vercel.json rewrites?

- **SPA** with `BrowserRouter` and client paths (`/login`, `/cooperativas`, `/portal`, …).
- **No** `vercel.json` today; no SSR framework.
- **Yes — SPA rewrites needed** for any static host (Vercel/Netlify): rewrite all non-file routes → `/index.html`.

Example (Phase 1+, do not apply now):

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 7. Grep leftover Base44 string hit counts

Counts from repo root, excluding `package-lock.json` / `node_modules`:

| Pattern | Hits (approx.) |
|---------|----------------|
| `base44` (all) | **396** |
| Files containing `base44` | **76** |
| `@base44` | **15** |
| `base44Client` | **56** |
| `createClientFromRequest` | **18** |
| `media.base44` | **2** |
| `functions.invoke` | **9** |
| `agents.` (client agent API) | **7** |
| `asServiceRole` | **6** |
| `subscribeToConversation` | **1** |
| `UploadPrivateFile` / `UploadFile` | **1** each |

---

## 8. Pages / modules discovered (product shape — not invented)

ERP modules wired in `App.jsx`: Home, Cooperativas, Promociones (Proyecto), Socios, Urbanismo, Juridico, Contratos, Finanzas, Proveedores (tabs: proveedores + licitaciones), Construccion, Gobierno, Entregas, Documentos, Comunicaciones, Informes, PortalSocio, AltaSocio, Incidencias, Soporte, Bandeja, Administracion (+ auth pages).

---

## 9. Recommended next phase (Phase 1)

**Do not start in this deliverable.** Suggested Phase 1 order:

1. Create private GitHub repo `cresvion247-rgb/gestor-cooperativas` and push this tree (still Base44-backed).
2. Add Supabase project: Postgres schema from §3, `profiles` from §4, tenant RLS mirroring JSONC rules, Storage buckets (public incidents + private socio docs).
3. Introduce `@supabase/supabase-js` **alongside** Base44 (dual-run) or feature-flag; do **not** delete `@base44/*` until parity.
4. Swap auth pages to Supabase Auth (email/password, Google, reset); map `profiles` fields.
5. Port highest-traffic entities first: `cooperativas`, `proyectos`, `socios`, `aportaciones`, `alertas`.
6. Replace upload + `url_documento_privado` with Storage + Edge Function.
7. Defer Concierge agent / TTS / WhatsApp to a later phase (largest leftover).
8. Add `vercel.json` SPA rewrite; replace `VITE_BASE44_*` with `VITE_SUPABASE_*`.

---

## 10. Blockers / risks for later phases

1. **No live Base44 credentials / `.env` / `.app.jsonc` in export** — cannot run against hosted backend or export production data from this zip alone.
2. **Private document vault + signed URLs** — must re-implement before cutting over Documentos/Intake.
3. **Concierge agent** (conversations, subscribe, WhatsApp URL, 5 tool functions + speech) — largest non-SQL leftover; product regression if dropped without replacement.
4. **Multi-tenant RLS** (`tenant_id` + `assigned_cooperativa_ids` + platform admin) — must be recreated carefully in Postgres policies.
5. **Invite flow** (`users.inviteUser`) — needs Supabase invite / magic-link / admin create-user equivalent.
6. **Immutable audit logs** — schema forbids normal update/delete; enforce with RLS/triggers.
7. **Stripe packages unused** — ignore or remove later; not a migration dependency.
8. **OAuthConsent / MCP** — page present but unrouted; no `base44/mcp` folder in export — confirm whether production uses MCP before planning.

---

*Generated Phase 0 only — inventory & mapping draft. No migration code written.*

---

## 11. Phase 1 field mapping (added)

Full Base44 → Postgres column mapping lives in **`PHASE1_FIELD_MAPPING.md`**.  
Schema file: **`supabase/schema.sql`**. Client stub: **`src/api/supabaseClient.js`**.

# Phase 1 Summary — Base44 → Supabase (schema + client stub)

## What changed (file list)

| Path | Action |
|------|--------|
| `supabase/schema.sql` | **Added** — single SQL file: tables, FKs, CHECKs, RLS, grants, triggers, commented Storage policies |
| `src/api/supabaseClient.js` | **Added** — `createClient` with `persistSession` + `autoRefreshToken`, env `VITE_SUPABASE_*` |
| `.env.example` | **Added** — `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` only |
| `PHASE1_FIELD_MAPPING.md` | **Added** — full entity.field → table.column → type |
| `PHASE1_SUMMARY.md` | **Added** — this file |
| `PHASE0_INVENTORY.md` | **Appended** §11 pointer to field mapping |
| `.gitignore` | **Tweaked** — `!.env.example` so the example is not ignored by `.env.*` |
| `package.json` / lockfile | **Added** `@supabase/supabase-js` dependency (Base44 packages kept) |

## What Base44 pieces were removed

**None.** `@base44/sdk`, `@base44/vite-plugin`, `base44Client.js`, entities, functions, and agent remain. App still runs on Base44.

## What the equivalent is now

| Base44 | Supabase (Phase 1) |
|--------|---------------------|
| Entity schemas in `base44/entities/*.jsonc` | Empty Postgres tables in `supabase/schema.sql` |
| Base44 User | `auth.users` + `public.profiles` (+ insert trigger) |
| Entity RLS (tenant / assigned / admin) | RLS policies using `(select auth.uid())` + helper funcs |
| `created_date` / `updated_date` | `created_at` / `updated_at` (+ `set_updated_at` trigger) |
| `UploadPrivateFile` / `UploadFile` | Bucket names documented; Storage policies **commented** until buckets exist |
| `base44Client` | Parallel stub `supabaseClient` (not wired into pages yet) |

**Table count:** **19** (`profiles` + 18 domain tables).

**Domain tables:** `cooperativas`, `proyectos`, `socios`, `viviendas`, `adjudicaciones`, `aportaciones`, `proveedores`, `licitaciones`, `ofertas`, `contratos`, `contrato_modificaciones`, `incidencias`, `alertas`, `consultas`, `documentos_socio`, `documentos_legales`, `expedientes_urbanisticos`, `audit_logs`.

**`profiles` fields:** `id`, `email`, `full_name`, `role`, `app_role`, `tenant_id`, `assigned_cooperativa_ids`, `interface_language`, `estado`, `created_at`, `updated_at`.

**Storage buckets (to create):**
1. `documentos-socio-privados` — private (socio intake docs)
2. `incidencias-fotos` — public (incidencia photos)

## Field mapping pointer

See **`PHASE1_FIELD_MAPPING.md`**.

## What the user must do outside the repo

1. Create a Supabase project.
2. Paste/run **`supabase/schema.sql`** once in the SQL Editor (empty tables; no data import).
3. Create Storage buckets: `documentos-socio-privados` (private) and `incidencias-fotos` (public).
4. Uncomment/adapt Storage policies in `schema.sql` (or Dashboard) after buckets exist.
5. Copy `.env.example` → `.env` and set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (never commit secrets).
6. Enable Auth providers later (email/password, Google) — Phase 2.
7. Optionally seed first platform admin (`profiles.role = 'admin'`) after first signup.

## What is still left

- Phase 2: swap auth pages / `AuthContext` to Supabase Auth; map `auth.me` → session + `profiles`.
- Phase 3: data façades (`entities.*` → Supabase queries) while keeping UI field names (`created_date` façade aliases).
- Edge Functions: private signed URLs, email, notifications, concierge tools.
- Agent / TTS / WhatsApp concierge replacement.
- Data migration from live Base44 (blocked without credentials/export).
- SPA host rewrite (`vercel.json`) and eventual removal of `@base44/*`.

## Recommended next phase

**Phase 2 — Auth:** wire Login/Register/Forgot/Reset/Google to Supabase Auth; load/update `public.profiles`; keep Base44 data layer until Phase 3.

## Blockers / notes

- No production Base44 data in this zip — schema is empty by design.
- `audit_logs.valores_*` are **jsonb** (Base44 used stringified JSON); Phase 3 façade should accept objects or strings.
- `tenant_id` stays **text** (slug), including `urbalex-central`; `assigned_cooperativa_ids` stores those slugs, not cooperativa UUIDs.
- Node engine warning from some `@supabase/*` packages (want Node ≥22); install succeeded on current box Node 20 — prefer Node 22+ in CI/local when possible.

# Phase 3 Summary — Data layer (Base44 entities → Supabase)

## Approach used

**Central shim on `base44.entities` (preferred for this codebase).**

Discovery showed **125** call sites across **45** files of the form `base44.entities.<Entity>.(list|filter|get|create|update)` — all imported via `@/api/base44Client`. There is **no** per-page API helper layer and **no** `entities.*.subscribe` (only `base44.agents.subscribeToConversation` → Phase 4).

Changing every page import would be invasive and risk UX diffs. Instead:

1. `src/api/entityFacade.js` — generic Base44-shaped CRUD → Supabase PostgREST (`list` / `filter` / `get` / `create` / `update` / `delete`), with field/sort/query translation and soft-delete policy.
2. `src/api/entities.js` — exports the singleton `entities` map + helpers.
3. `src/api/base44Client.js` — still constructs `@base44/sdk` `createClient` for **functions / agents / integrations**, but a **Proxy** always returns the Supabase façade for `.entities`.

**Pages were not rewritten.** Call sites still say `base44.entities.*`; the live network path for those methods is Supabase (anon key + RLS + session from Phase 2 auth).

Auth remains Supabase (Phase 2). `@base44/*` packages stay installed (Phase 5). Uploads / Core.* / functions / agents stay Base44 (Phase 4).

## What changed (file list)

| Path | Action |
|------|--------|
| `src/api/entityFacade.js` | **Added** — registry, sort/filter/field mapping, `createEntityApi`, `createSupabaseEntities` |
| `src/api/entities.js` | **Added** — public export + singleton |
| `src/api/base44Client.js` | **Updated** — Proxy shim: `.entities` → Supabase façade |
| `src/lib/audit.js` | **Comment** — AuditLog.create now via façade (jsonb parse note) |
| `PHASE3_SUMMARY.md` | **Added** — this file |

**Unchanged by design:** page/component UX/copy, `supabase/schema.sql`, auth pages, `@base44` packages, functions/agents/upload call sites.

## Entities migrated (all 19) — order by call-site frequency

| Rank | Entity | Table | Call sites | Soft-delete (`delete:false`) |
|------|--------|-------|------------|------------------------------|
| 1 | Cooperativa | `cooperativas` | 21 | no |
| 2 | Proyecto | `proyectos` | 14 | no |
| 3 | Socio | `socios` | 12 | no |
| 4 | Aportacion | `aportaciones` | 8 | yes |
| 5 | Contrato | `contratos` | 8 | yes |
| 6 | Alerta | `alertas` | 7 | no |
| 7 | Vivienda | `viviendas` | 6 | no |
| 8 | DocumentoSocio | `documentos_socio` | 5 | yes |
| 9 | DocumentoLegal | `documentos_legales` | 5 | yes |
| 10 | Adjudicacion | `adjudicaciones` | 5 | yes |
| 11 | ContratoModificacion | `contrato_modificaciones` | 5 | yes |
| 12 | Proveedor | `proveedores` | 5 | yes |
| 13 | Consulta | `consultas` | 4 | no |
| 14 | Incidencia | `incidencias` | 4 | no |
| 15 | Licitacion | `licitaciones` | 4 | yes |
| 16 | AuditLog | `audit_logs` | 3 | yes (hard delete refused) |
| 17 | ExpedienteUrbanistico | `expedientes_urbanisticos` | 3 | yes |
| 18 | Oferta | `ofertas` | 3 | yes |
| 19 | User | `profiles` | 3 | yes → `{ estado: 'inactivo' }` |

**Methods in use:** `list` (65), `update` (32), `create` (18), `filter` (8), `get` (2). **No** `.delete()` call sites. **No** entity `.subscribe()`.

## Base44 entity pieces removed from the *live* path

| Base44 | Status |
|--------|--------|
| `base44.entities.*.list/filter/get/create/update/delete` (SDK HTTP) | **Replaced** by Supabase façade behind the same names |
| Entity realtime subscribe | N/A (none in app) |

**Still on Base44 (intentional leftovers → Phase 4/5):**

| Surface | Call sites (approx.) |
|---------|----------------------|
| `base44.functions.invoke` | Documentos, notify, spokenReplies |
| `base44.agents.*` (+ subscribe) | ConciergePanel |
| `base44.integrations.Core.UploadFile` / `UploadPrivateFile` | IncidenciaDialog, IntakeForm |
| `@base44/sdk` client bootstrap | `base44Client.js` (kept for above) |
| `@base44/vite-plugin` | build config |

## Equivalents / mapping notes

### Field aliases (façade boundary)

| UI (Base44) | Postgres | Behaviour |
|-------------|----------|-----------|
| `created_date` | `created_at` | Returned on every row; stripped on write (DB default) |
| `updated_date` | `updated_at` | Returned on every row; stripped on write (trigger) |
| domain fields | same snake_case | Pass-through |
| `User.*` | `profiles.*` | `list` / `update` (invite still Phase 2 stub) |
| `AuditLog.valores_*` | `jsonb` | `logAudit` still `JSON.stringify`s; façade **parses** strings → objects on insert |

### Sort keys

| Base44 sort | Supabase |
|-------------|----------|
| `-created_date` | `.order('created_at', { ascending: false })` |
| `-updated_date` | `.order('updated_at', { ascending: false })` |
| `-fecha` / `-fecha_documento` / `-fecha_adjudicacion` / `-fecha_vencimiento` | `.order('<col>', { ascending: false })` (same column name) |
| `list()` with no sort | no `.order` (DB default) |
| `list(sort, limit)` / `list(limit)` | supported |

### Query objects (`filter`)

| Base44 filter | Supabase |
|---------------|----------|
| `{ field: value }` | `.eq(field, value)` |
| `{ field: [a,b] }` | `.in(field, [a,b])` |
| `{ field: { $in: [...] } }` | `.in` |
| `{ field: { $ne / $gt / $gte / $lt / $lte / $ilike } }` | matching operators |
| `{ $or: [{ a: 1 }, { b: 2 }] }` | `.or('a.eq.1,b.eq.2')` |
| `{ field: null }` | `.is(field, null)` |

Call sites in this app only use plain equality filters (e.g. `{ socio_id }`, `{ email }`, `{ solicitante_email }`, `{ contrato_id }`, audit `tenant_id` / `entidad_tipo`).

### Soft-delete

Entities marked `delete:false` in Base44 / schema comments: hard `delete()` throws `SOFT_DELETE_ONLY` (or for `User`, patches `estado: 'inactivo'`). UI never calls `.delete()`.

### Multi-tenant

RLS in `schema.sql` (`can_access_tenant` / `can_mutate_tenant`) remains the server-side gate. Client queries still pass `tenant_id` / FKs when the UI already did; façade does not invent extra tenant filters.

### Realtime

No entity subscribe to migrate. Agent `subscribeToConversation` left for Phase 4.

## Grep leftovers (`base44.entities` / entity SDK)

**Source still contains `base44.entities` syntax (by design — shim):**

| Metric | Count |
|--------|-------|
| `base44.entities` method call sites | **125** |
| Files with `base44.entities` | **45** (+ `base44Client.js` wiring) |
| Live Base44 **entity HTTP** usage after shim | **0** |
| `entities.*.delete(` | **0** |
| `entities.*.subscribe` | **0** |

**Non-entity Base44 still live (Phase 4+):**

- `base44.functions.invoke` — url_documento_privado, notificar_cooperativa, enviar_email_miembro, concierge_hablar
- `base44.agents.*` — ConciergePanel (list/get/createConversation, addMessage, subscribeToConversation, getWhatsAppConnectURL)
- `base44.integrations.Core.UploadFile` / `UploadPrivateFile`

## What the user must do outside the repo

1. Ensure Phase 1 schema + Phase 2 Auth are applied; `.env` has `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
2. Signed-in users need `profiles` rows with correct `tenant_id` / `assigned_cooperativa_ids` / `role` so RLS allows reads/writes.
3. Empty tables until data is imported from Base44 (still blocked without export credentials).
4. Optional: seed demo cooperativas/proyectos to exercise UI against Supabase.

## Recommended next phase

**Phase 4 — Uploads & side effects:** replace `Core.Upload*` + `url_documento_privado` with Supabase Storage + Edge Function; migrate email/notify functions; leave or stub Concierge agent/TTS/WhatsApp.

## Blockers / notes

- Without Supabase credentials + seeded data, entity pages will error/empty at runtime (expected soft-break vs old Base44 backend).
- Invite user remains Phase 2 stub (needs Edge Function / Admin API).
- `audit_logs` has no `updated_at`; façade omits timestamp aliases on write for that table’s extras via transform.
- Schema not modified (no critical bug found). Circular `socios.vivienda_id` ↔ `viviendas.socio_id` FKs remain as designed — create order is app-controlled.
- Node 20 vs `@supabase/*` engine preference (≥22) unchanged from Phase 1.

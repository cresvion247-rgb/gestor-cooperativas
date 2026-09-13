# Forms / RLS fix (2026-09-13)

## Symptom
Reports → Export PDF showed: `new row violates row-level security policy for table "audit_logs"`.
Many forms `await logAudit(...)` after a successful create/update/PDF, so the same RLS miss looked like “the form failed.”

## Root cause
1. `logAudit` defaults `tenant_id` to `urbalex-central` (`CENTRAL_TENANT_ID`) when callers omit it (e.g. Informes PDF export).
2. RLS helpers `is_platform_admin` / `can_access_tenant` / `can_mutate_tenant` previously only treated `profiles.role = 'admin'` as platform-wide access (they did **not** call each other; mutate duplicated the admin check).
3. Typical platform operators have `app_role` in (`super_admin_urbalex`, `administrador_urbalex`) but `role = 'user'`, with empty `tenant_id` / `assigned_cooperativa_ids` — so `can_mutate_tenant('urbalex-central')` failed and `AuditLog.create` was denied.
4. Because every mutation flow awaited `logAudit` inside the same `try/catch` as the primary write, audit RLS errors bubbled as form/PDF failure toasts.

## Fixes shipped

| Change | File |
|--------|------|
| Expand platform-admin helpers to include Urbalex admin `app_role`s | `supabase/schema.sql` |
| Additive SQL patch for live projects (CREATE OR REPLACE functions; no full re-run) | `supabase/rls_form_fixes.sql` **← run this in SQL Editor** |
| Soft-fail `logAudit` + resolve tenant from actor profile / assigned list when possible | `src/lib/audit.js` |
| Align UI `isSuperAdmin` with the same app roles | `src/lib/permissions.js` |
| Set `tenant_id` (and default `estado`) on ExpedienteUrbanistico create | `src/components/urbanismo/ExpedienteDialog.jsx` |
| Deploy note | `DEPLOY.md` |

Policies for `audit_logs_insert` already use `can_mutate_tenant(tenant_id)` — replacing the helper is enough; no DROP/CREATE POLICY required.

## Create-payload scan (`tenant_id`)

| Create site | `tenant_id` |
|-------------|-------------|
| OfertaDialog, LicitacionDialog, LicitacionesTab→Contrato, ContratoDialog, ModificacionDialog | set on payload before create |
| DocumentoLegalDialog, AportacionDialog, ProveedorDialog, SocioDialog | `payload.tenant_id = coop…` before create |
| IncidenciaDialog, ConsultaDialog, AdjudicacionDialog, IntakeForm (Socio + DocumentoSocio), CooperativaDialog, notify.js Alerta | inline / explicit |
| Comunicaciones Alerta | from `ComunicacionDialog` (`tenant_id: cooperativa.tenant_id`) |
| **ExpedienteDialog** | **was missing** — fixed (`payload.tenant_id = proyecto.tenant_id`) |
| AuditLog via `logAudit` | always set (`resolveAuditTenant`) |

No `URBALEX_TENANT` constant found; global actions use `CENTRAL_TENANT_ID` (`urbalex-central`) from `permissions.js` / `UsersPanel` / `UserDialog`.

## UX paths where audit used to fail the primary action

All of these `await logAudit` inside the same try as the mutation/PDF. Soft-fail in `logAudit` means primary success toasts no longer depend on audit RLS:

- PDF: `Informes.jsx`, `Contratos.jsx`, `SocioDetailDialog.jsx`
- Creates/updates: CooperativaDialog, UserDialog/UsersPanel, SocioDialog, AdjudicacionDialog, AportacionDialog, PagoDialog, ContratoDialog, ModificacionDialog/List, LicitacionDialog, OfertaDialog/Panel, LicitacionesTab award, ProveedorDialog/Tab, DocumentoLegalDialog, ExpedienteDialog, ProgresoDialog, IncidenciaDialog, ConsultaDialog/Reply, Comunicaciones, Documentos, Socios status, Entregas, IntakeForm, Cooperativas status

## SQL the user must run

In Supabase → **SQL Editor**, run the full contents of:

`supabase/rls_form_fixes.sql`

It replaces `is_platform_admin`, `can_access_tenant`, and `can_mutate_tenant` so platform operators with Urbalex admin `app_role` can mutate any tenant (including `urbalex-central` audit rows). Safe to re-run.

Optional (commented in the patch): promote those profiles to `role = 'admin'` so UI and RLS stay aligned.

## Remaining risks
- Non-admin staff without matching `tenant_id` / `assigned_cooperativa_ids` still cannot mutate (by design).
- Creating/deleting cooperatives still requires platform admin (policy unchanged).
- Soft-fail can hide persistent audit outages — watch browser console for `[logAudit] skipped:`.
- `urbalex-central` is a business slug, not necessarily a row in `cooperativas` (no FK; fine for audit).
- Invite-user remains stubbed (Edge Function).
- Expediente create previously also risked `estado` NULL (column NOT NULL); defaulted to `en_tramite` when empty.
- No Proyecto/Vivienda create dialogs in this SPA path (seeded/elsewhere) — out of scope if added later without `tenant_id`.

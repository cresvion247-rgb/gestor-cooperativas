# Forms / RLS fix (2026-09-13)

## Symptom
Reports → Export PDF showed: `new row violates row-level security policy for table "audit_logs"`.
Many forms await `logAudit` after a successful create/update, so the same RLS miss looked like “the form failed.”

## Root cause
1. `logAudit` defaults `tenant_id` to `urbalex-central` when callers omit it (e.g. Informes PDF).
2. RLS `can_mutate_tenant` / `is_platform_admin` only treated `profiles.role = 'admin'` as platform-wide access.
3. Seeded operators often have `app_role = super_admin_urbalex` but `role = 'user'`, and are not assigned `urbalex-central`, so inserts into `audit_logs` were denied.

## Fixes shipped
| Change | File |
|--------|------|
| Expand platform-admin helpers to include Urbalex admin `app_role`s | `supabase/schema.sql` |
| Additive SQL patch for live projects | `supabase/rls_form_fixes.sql` **← run this in SQL Editor** |
| Soft-fail `logAudit` + resolve tenant from profile when possible | `src/lib/audit.js` |
| Align UI `isSuperAdmin` with the same app roles | `src/lib/permissions.js` |
| Deploy note | `DEPLOY.md` |

## What you must do
1. Supabase → **SQL Editor** → paste and run `supabase/rls_form_fixes.sql`.
2. Confirm your user has `app_role` in (`super_admin_urbalex`, `administrador_urbalex`) **or** `role = 'admin'`, **or** `assigned_cooperativa_ids` containing the cooperative `tenant_id` you edit.
3. Redeploy / hard-refresh the app (Vercel picks up the client soft-fail automatically after this push).

## Remaining risks
- Non-admin staff without cooperative assignment still cannot mutate (by design).
- Creating cooperatives still requires platform admin (policy unchanged).
- Invite-user remains stubbed (Edge Function).

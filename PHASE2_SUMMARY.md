# Phase 2 Summary — Auth (Base44 → Supabase)

## What changed (file list)

| Path | Action |
|------|--------|
| `src/lib/AuthContext.jsx` | **Rewritten** — session via `supabase.auth`; merges `auth.users` + `public.profiles`; keeps provider shape (`user`, `isAuthenticated`, `isLoadingAuth`, `isLoadingPublicSettings`, `authError`, `appPublicSettings`, `authChecked`, `logout`, `navigateToLogin`, `checkUserAuth`, `checkAppState`) + **`refreshUser`** |
| `src/pages/Login.jsx` | **Wired** to `signInWithPassword` + Google `signInWithOAuth` |
| `src/pages/Register.jsx` | **Wired** to `signUp` + `verifyOtp` (signup) + `resend` + Google OAuth |
| `src/pages/ForgotPassword.jsx` | **Wired** to `resetPasswordForEmail` with `redirectTo` = `{origin}/reset-password` |
| `src/pages/ResetPassword.jsx` | **Wired** to recovery session + `updateUser({ password })` (no Base44 `?token=`) |
| `src/lib/i18n.jsx` | **Wired** — reads/writes `profiles.interface_language` (+ localStorage as before) |
| `src/lib/audit.js` | **Actor** from Supabase session + profiles; `AuditLog.create` still Base44 entities |
| `src/lib/PageNotFound.jsx` | Uses `useAuth()` instead of `base44.auth.me()` |
| `src/components/erp/admin/UsersPanel.jsx` | **Invite stub** — no `base44.users.inviteUser`; toast + checklist |
| `src/api/supabaseClient.js` | `detectSessionInUrl: true` for OAuth/recovery |
| `.env.example` | Auth redirect URL notes |
| `PHASE2_SUMMARY.md` | **Added** — this file |

**Unchanged (by design):** `@base44/*` packages, `base44Client.js`, `app-params.js` (entity token for Phase 3 data), entity call sites, schema, InactiveUserScreen gate (`user?.estado === 'inactivo'` in `App.jsx`).

## What Base44 auth was removed (live UI path)

| Base44 API | Status |
|------------|--------|
| `base44.auth.loginViaEmailPassword` | Replaced → `supabase.auth.signInWithPassword` |
| `base44.auth.loginWithProvider("google")` | Replaced → `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| `base44.auth.register` / `verifyOtp` / `resendOtp` / `setToken` | Replaced → `signUp` / `verifyOtp` / `resend` (session auto-persisted) |
| `base44.auth.resetPasswordRequest` | Replaced → `resetPasswordForEmail` |
| `base44.auth.resetPassword({ resetToken })` | Replaced → recovery session + `updateUser({ password })` |
| `base44.auth.me` (AuthContext, i18n, PageNotFound, audit actor) | Replaced → session + `profiles` select |
| `base44.auth.updateMe` | Replaced → `profiles.update({ interface_language })` |
| `base44.auth.logout` / `redirectToLogin` | Replaced → `signOut` + `/login` navigation |
| `base44.app.getPublicSettings` | Removed from bootstrap; stub `appPublicSettings` kept for App.jsx gate |
| `base44.users.inviteUser` | **Stubbed** (needs Edge Function / Admin API) |

Logout also clears legacy `base44_access_token` / `token` from localStorage so Base44 tokens are not the live **UI** session path.

## Equivalent mapping

| Concern | Supabase |
|---------|----------|
| Credentials / session | `supabase.auth` (persist + auto-refresh) |
| Profile fields on `user` | `public.profiles` merged on load: `role`, `app_role`, `tenant_id`, `assigned_cooperativa_ids`, `interface_language`, `estado`, `email`, `full_name` |
| Inactive gate | Unchanged: `user.estado === 'inactivo'` → `InactiveUserScreen` |
| Redirects | `window.location.origin` (+ path) for OAuth, signup confirm, password recovery |

### OTP / register UX difference (documented)

Base44 used an in-app **6-digit OTP** after register (`verifyOtp` + `setToken`).

Supabase nearest equivalent:

1. `signUp` → if confirmations are **disabled**, session is immediate (skip OTP UI).
2. If confirmations are **enabled**, UI still shows the OTP step and calls `verifyOtp({ type: 'signup' })` + `resend`.
3. **Default Supabase email templates are magic links**, not 6-digit codes. For the existing OTP UI to work 1:1, customize the Auth email template to include `{{ .Token }}` (and keep Confirm email enabled). Users can also confirm via the magic link in the email; that still establishes a session via `detectSessionInUrl`.

No new product features were invented beyond this nearest mapping.

### Invite caveat

`UsersPanel` invite button no longer calls Base44. Client anon key **cannot** call `auth.admin.inviteUserByEmail`. Stub shows a checklist toast. Manual workaround until Edge Function: create user in Dashboard → Auth, then edit `profiles` (`app_role`, `tenant_id`).

## What the user must do outside the repo

1. Ensure Phase 1 schema is applied (`profiles` + `handle_new_user` trigger).
2. Set `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. **Authentication → Providers:** enable Email; enable Google OAuth (Client ID/Secret from Google Cloud).
4. **Authentication → URL Configuration:**
   - Site URL: production Vercel URL (and use localhost when developing).
   - Redirect URLs allowlist: `http://localhost:5173/**`, `https://<vercel-domain>/**` (include `/reset-password`, `/`, etc.).
5. Optional: customize signup email template for `{{ .Token }}` if keeping the 6-digit OTP screen.
6. Optional: first platform admin — after signup, set `profiles.role = 'admin'` (and `app_role`) in SQL/Dashboard.
7. Invite Edge Function (later): service-role `inviteUserByEmail` + profile patch; rewire UsersPanel.

## Grep leftovers (`base44.auth` / `base44_access_token`)

| Hit | File | Notes |
|-----|------|--------|
| Comment only | `src/pages/OAuthConsent.jsx:48` | Mentions `base44.auth.isAuthenticated` in a comment; page **not** routed in `App.jsx` |
| Clear on logout | `src/lib/AuthContext.jsx` | Removes legacy `base44_access_token` |
| Entity SDK bootstrap | `src/lib/app-params.js` | Still reads/clears `base44_access_token` via `@base44/sdk` `getAccessToken` for **entity** client (Phase 3/5) — **not** used for UI session |

No live `base44.auth.*` call sites remain in Login/Register/Forgot/Reset/AuthContext/i18n/PageNotFound/audit actor.

## Soft-break / leftovers for later phases

- **Data layer still Base44:** pages continue `base44.entities.*` (needs Base44 token/appId until Phase 3). UI auth session is Supabase-only.
- **`app-params.js` / `base44Client.js`:** kept for entities/functions/agents.
- **Invite:** stub only.
- **OAuthConsent / MCP:** unrouted; still Base44-oriented comments.
- **Packages:** `@base44/sdk` + vite-plugin remain (Phase 5 removal).

## Recommended next phase

**Phase 3 — Data façades:** replace `base44.entities.*` with Supabase queries/mutations while keeping UI field names (`created_date` aliases where needed); then entity RLS becomes the live path.

## Blockers / notes

- Without real `VITE_SUPABASE_*` and Dashboard Auth config, auth pages will error at runtime (expected).
- Google OAuth will fail until provider + redirect URLs are configured.
- Entity APIs may fail without Base44 credentials — expected soft-break until Phase 3.

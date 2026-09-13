# Phase 5 Summary — Platform cleanup

Remove `@base44/*` from the installable app. Entity façades, auth, and storage from Phases 2–4 are unchanged. No GitHub remote / push (Phase 6).

## Approach

1. Drop `@base44/sdk` and `@base44/vite-plugin` from `package.json`; strip the Vite plugin.
2. Keep the filename `src/api/base44Client.js` and the export name `base44` so ~45 pages/components need **no import rewrite**. The export is now `{ entities }` — a compatibility object, **not** the SDK.
3. Neutralize `src/lib/app-params.js` (only leftover consumer: unrouted `OAuthConsent.jsx`).
4. Delete the unused generated `base44/` tree (entities jsonc, agent, Deno functions, config). Edge stubs already live under `supabase/functions/`.
5. Delete + regenerate `package-lock.json`; `npm install` succeeds with **zero** `@base44` lock entries.
6. Add `vercel.json` SPA rewrite, `DEPLOY.md`, refresh README / AGENTS / `.gitignore` / `.npmrc`.

## What changed

| Path | Action |
|------|--------|
| `package.json` | Removed `@base44/sdk`, `@base44/vite-plugin`; renamed package `gestor-cooperativas` |
| `package-lock.json` | Deleted and regenerated — does not pin `@base44/*` |
| `vite.config.js` | Plugin import/usage removed; `@vitejs/plugin-react` + `@` alias only |
| `src/api/base44Client.js` | **Rewritten** — `{ entities }` compat object, no SDK |
| `src/lib/app-params.js` | **Neutralized** — no `getAccessToken` / `VITE_BASE44_*` |
| `src/api/entities.js` | Comment update (same singleton) |
| `src/api/entityFacade.js` | Header comment only (façade logic unchanged) |
| `base44/` | **Deleted** (entities, agents, functions, shared, config) |
| `.npmrc` | Removed `min-release-age-exclude=@base44/*`; kept 7-day cooldown |
| `.gitignore` | Explicit `node_modules`, `dist`, `.env`, `.env.local`; keep `!.env.example`; dropped `base44/.app.jsonc` |
| `vercel.json` | **Added** — `/(.*) → /index.html` |
| `DEPLOY.md` | **Added** — env, schema, buckets, redirects, Realtime (none), Auth, Edge secrets, checklists |
| `README.md` | Rewritten: Vite + Supabase + Vercel (no Base44 CLI) |
| `AGENTS.md` | Rewritten for this stack |
| `index.html` | Title `Urbalex ERP`; removed `base44.com` favicon |
| `PHASE5_SUMMARY.md` | This file |

**Unchanged by design:** `entityFacade.js` CRUD, `AuthContext`, `storage.js` helpers, `agentsStub.js`, notify Edge invokes, page UX, `supabase/schema.sql` table defs, unrouted `OAuthConsent.jsx`.

## Dead routes

| Page | Router | Disposition |
|------|--------|-------------|
| `src/pages/OAuthConsent.jsx` | **Not registered** in `App.jsx` | Marked unused in `DEPLOY.md` §8. MCP consent page; no `base44/mcp` tree. |

## npm install

**Succeeded** (exit 0). Removed 31 packages (the `@base44/*` subtree). Lockfile `packages` with `base44` in the key: **0**.

Pre-existing `EBADENGINE` warnings: `@supabase/*@2.116.0` wants Node `>=22`; box is Node `v20.19.2`. Not introduced by this phase.

`npm run build` **succeeded** (Vite 8, 2796 modules). No `@base44/sdk` resolve.

## Grep leftovers (case-insensitive)

Scoped to the repo **excluding** `node_modules`, `package-lock.json`, `dist`.

| Pattern / bucket | Hits | Files | Status |
|------------------|------|-------|--------|
| All (`base44` \| `@base44` \| `media.base44` \| `base44Client`) | **392** | **73** | Expected |
| `@base44/sdk` or `@base44/vite-plugin` **import** | **0** | 0 | Clean |
| `package.json` / lock `@base44` | **0** | 0 | Clean |
| Compat `import { base44 } from '@/api/base44Client'` + `base44.entities.*` | **173** | ~45 src files | **Keep** — not the SDK |
| Comments / legacy helpers / error strings in `src/` | **34** + 3 user-facing strings | see below | Allowed |
| `PHASE*.md` + field mapping | **164** | 6 | Allowed docs |
| `DEPLOY.md` / `README.md` / `AGENTS.md` / `STORAGE.md` | **11** | 4 | Allowed docs |
| `supabase/schema.sql` + Edge stub comments | **7** | 3 | Allowed comments |
| `media.base44.com` in product code | **2** | `image-helpers.js`, `image.jsx` | Legacy URL helper — keep |

### Product-code leftovers (not PHASE docs)

**Compat client (intentional)**

- `src/api/base44Client.js` — `export const base44 = { entities }`
- Every ERP page/dialog still imports that path (Home, Cooperativas, Socios, …). Live network is Supabase.

**Legacy URL helpers**

- `src/components/ui/image-helpers.js` — `WIX_MEDIA_HOSTS["media.base44.com"]`
- `src/components/ui/image.jsx` — comment that those hosts get transforms; Supabase public URLs pass through

**Comments / logout cleanup / unused page**

- `src/lib/AuthContext.jsx` — `clearLegacyBase44Tokens()` removes `base44_access_token` / `token` on logout
- `src/lib/app-params.js` — neutralized leftover; still imported only by OAuthConsent
- `src/pages/OAuthConsent.jsx` — unrouted MCP comments (`base44/mcp/config.json`, `base44.auth.isAuthenticated`)
- `src/pages/ResetPassword.jsx`, `Register.jsx` — comments comparing old Base44 token/OTP
- `src/lib/notify.js`, `agentsStub.js`, `spokenReplies.js`, `permissions.js`, `audit.js`, `storage.js` — Phase 4 / mapping comments
- `src/api/entityFacade.js` — mapping comments + soft-delete error text mentioning `Base44 delete:false`
- `src/api/storage.js` — error if `file_uri` is a legacy vault URI

**Schema / Edge**

- `supabase/schema.sql` header + a few table comments
- `supabase/functions/url_documento_privado` / `concierge_hablar` — “was Base44 / legacy URI” comments

### Files with leftover hits (73)

PHASE0–4 docs (6), DEPLOY/README/AGENTS/STORAGE (4), `supabase/` (3), `src/api/*` (5), `src/lib/*` (7), `src/pages/*` (19 including OAuthConsent), `src/components/**` (29).

Full per-file counts are reproducible with:

```bash
rg -n -i "base44|@base44|media\.base44|base44Client" --glob '!node_modules/**' --glob '!package-lock.json' --glob '!dist/**'
```

No remaining hit is a runtime `@base44/sdk` import.

## Blockers

None for this phase.

Still **outside** Phase 5 (already documented in DEPLOY.md / PHASE4):

1. Supabase project + one-time `schema.sql` + buckets + Auth URLs must exist before production login works.
2. Invite-user Edge Function still stubbed.
3. Concierge LLM / WhatsApp still stubbed.
4. Email Edge Functions soft-skip without `RESEND_API_KEY`.
5. Legacy Base44 `file_uri` values cannot be signed.
6. Node 20 vs `@supabase/*` engine `>=22` warning (pre-existing).

## Recommended next phase

**Phase 6 — GitHub:** create/push the private repo (parent). Then connect Vercel and apply `DEPLOY.md`.

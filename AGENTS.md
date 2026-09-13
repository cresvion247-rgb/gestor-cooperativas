# AGENTS.md

## Project Context

Urbalex ERP — Vite + React SPA backed by Supabase (auth, PostgREST, Storage) and deployed as a static site on Vercel. Treat this as user-owned application code. Keep changes focused on the request and preserve existing conventions.

Start with `README.md` for local setup and `DEPLOY.md` for environment, schema, and host configuration.

## Key files

- `src/` — frontend application source
- `src/api/supabaseClient.js` — Supabase JS client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- `src/api/entities.js` / `src/api/entityFacade.js` — Supabase-backed entity APIs
- `src/api/base44Client.js` — compatibility export `{ entities }` (not `@base44/sdk`)
- `src/lib/AuthContext.jsx` — session + `public.profiles`
- `src/api/storage.js` — Storage helpers
- `vite.config.js` — Vite + `@vitejs/plugin-react` + `@` alias
- `vercel.json` — SPA rewrite to `/index.html`
- `.env.local` — local-only values; never commit secrets

## Working notes

- Default local command is `npm run dev`.
- Do not add `@base44/sdk` or `@base44/vite-plugin` back.
- Prefer the existing entity façade over new ad-hoc `supabase.from(...)` in pages.
- Run the relevant checks from `package.json` (`lint`, `typecheck`, `build`) before finishing code changes.

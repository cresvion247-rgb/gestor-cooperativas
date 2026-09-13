# Urbalex ERP (gestor-cooperativas)

Vite + React 18 SPA for housing-cooperative operations. Data, auth, and storage run on **Supabase**. The frontend is a static site intended for **Vercel** (or any host that rewrites unknown paths to `index.html`).

This repo is no longer a Base44 app. Local development is `npm run dev` against your Supabase project.

## Stack

| Layer | Choice |
|--------|--------|
| Build | Vite 8 + `@vitejs/plugin-react` |
| UI | React 18, react-router-dom v6 (`BrowserRouter`), shadcn/Radix, Tailwind |
| Data | TanStack Query + Supabase PostgREST façade (`src/api/entityFacade.js`) |
| Auth | Supabase Auth (email/password, Google OAuth, recovery) |
| Storage | Supabase Storage (`documentos-socio-privados`, `incidencias-fotos`) |
| Host | Vercel SPA (`vercel.json` rewrites → `/index.html`) |

## Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com) project
- (Deploy) a Vercel project pointed at this repo

## Local development

1. Clone the repository and `cd` into it.
2. Copy env: `cp .env.example .env.local`
3. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. Install and run:

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

The first time you stand up a project, run `supabase/schema.sql` **once** in the Supabase SQL Editor, create the two Storage buckets, and enable Email + Google providers. See **[DEPLOY.md](./DEPLOY.md)** for the full checklist.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Preview the production bundle |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -p ./jsconfig.json` |

## Deploy

Push to Git and connect the repo to Vercel. Set the same `VITE_*` vars in the Vercel project. SPA rewrites are already in `vercel.json`.

Full runbook: **[DEPLOY.md](./DEPLOY.md)**  
Storage / email cutover notes: **[STORAGE.md](./STORAGE.md)**

## Entity API (compat)

Pages still write `import { base44 } from '@/api/base44Client'` and call `base44.entities.*`. That object is **not** the Base44 SDK — it is a thin wrapper around the Supabase façade in `src/api/entities.js`. New code can import `entities` from there directly.

## Docs in this repo

- `DEPLOY.md` — production checklist
- `STORAGE.md` — buckets and signed URLs
- `supabase/schema.sql` — Postgres schema (run once)
- `supabase/functions/` — Edge Function stubs
- `PHASE0_INVENTORY.md` … `PHASE4_SUMMARY.md` — migration history

Do not commit `.env`, `.env.local`, or any service-role / Resend secrets.

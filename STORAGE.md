# Supabase Storage — Urbalex ERP

Phase 4 upload target. Full `DEPLOY.md` is Phase 5; this file is the storage/email cutover cheat-sheet.

## Buckets

| Bucket id | Public? | Used by | DB field |
|-----------|---------|---------|----------|
| `documentos-socio-privados` | **private** | `IntakeForm` → `uploadPrivateFile` | `documentos_socio.file_uri` (object **path**) |
| `incidencias-fotos` | **public** | `IncidenciaDialog` → `uploadPublicFile` | `incidencias.foto_url` (full **public URL**) |

Path conventions (also in `schema.sql` comments):

- Private: `{tenant_id}/{socio_id}/{uuid}_{filename}`
- Public: `{tenant_id}/{uuid}_{filename}`

## Create buckets (Dashboard or SQL)

```sql
insert into storage.buckets (id, name, public)
values
  ('documentos-socio-privados', 'documentos-socio-privados', false),
  ('incidencias-fotos', 'incidencias-fotos', true)
on conflict (id) do nothing;
```

Then **uncomment** the Storage RLS policies at the bottom of `supabase/schema.sql` and run them (they depend on `can_access_tenant` / `can_mutate_tenant`).

## Client helpers

- `src/api/storage.js` — `uploadPrivateFile`, `uploadPublicFile`, `createPrivateDocSignedUrl`
- Signed open: `getPrivateDocUrl` in `src/lib/notify.js` (client sign → Edge Function fallback)
- Public URLs from `getPublicUrl` work in existing `<img>` / `foto_url` / “view photo” links without image-helper transforms

## Edge Functions related to files/email

See `supabase/functions/README.md`. Secrets (Dashboard → Edge Functions → Secrets, never git):

- `RESEND_API_KEY`, `EMAIL_FROM` — for `enviar_email_miembro` / `notificar_cooperativa`
- Hosted functions already receive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Legacy Base44 `file_uri` values

Old vault URIs cannot be signed by Supabase Storage. Re-upload or keep a migration map. New uploads store object paths only.

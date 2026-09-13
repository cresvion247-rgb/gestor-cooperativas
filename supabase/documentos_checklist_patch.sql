-- =============================================================================
-- Document checklist + member upload support (run once in SQL Editor)
-- Allows staff to request docs before a file exists (estado = solicitado).
-- Safe to re-run.
-- =============================================================================

alter table public.documentos_socio
  alter column file_uri drop not null;

alter table public.documentos_socio
  drop constraint if exists documentos_socio_estado_check;

alter table public.documentos_socio
  add constraint documentos_socio_estado_check
  check (estado in ('solicitado', 'subido', 'verificado', 'rechazado'));

-- Optional: default stays 'subido' for intake uploads; requests set solicitado explicitly.

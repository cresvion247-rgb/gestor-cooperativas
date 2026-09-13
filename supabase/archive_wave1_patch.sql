-- =============================================================================
-- Archive wave 1: Communications (alertas) can be archivado
-- Consultas / incidencias already use cerrada as the archive bucket.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- =============================================================================

alter table public.alertas
  drop constraint if exists alertas_estado_check;

alter table public.alertas
  add constraint alertas_estado_check
  check (estado in ('abierta', 'en_gestion', 'resuelta', 'archivado'));

-- =============================================================================
-- Trial placeholder cooperative (safe to re-run)
-- Creates one demo coop for Promociones / Urbanismo / etc. during trials.
-- Run in Supabase SQL Editor.
-- =============================================================================

insert into public.cooperativas (
  tenant_id,
  nombre,
  cif,
  forma_juridica,
  estado,
  municipio,
  provincia,
  email,
  administrador_urbalex,
  notas
)
values (
  'demo-trial',
  'Cooperativa Demo Trial',
  'B00000000',
  'Cooperativa de viviendas',
  'activa',
  'Madrid',
  'Madrid',
  'demo@gestor-cooperativa.local',
  'kamskillz1@gmail.com',
  'Placeholder cooperative for trial / staging. Safe to edit or archive later.'
)
on conflict (tenant_id) do update set
  nombre = excluded.nombre,
  estado = excluded.estado,
  municipio = excluded.municipio,
  provincia = excluded.provincia,
  email = excluded.email,
  administrador_urbalex = excluded.administrador_urbalex,
  notas = excluded.notas,
  updated_at = now();

-- Optional: also resolve CIF unique collisions if tenant already exists under another cif
-- (no-op when the row above matched on tenant_id).

-- Link platform admin profile to this tenant for convenience (keeps role/app_role as-is)
update public.profiles p
set
  tenant_id = coalesce(nullif(p.tenant_id, ''), 'demo-trial'),
  assigned_cooperativa_ids = (
    select array(
      select distinct x
      from unnest(
        coalesce(p.assigned_cooperativa_ids, '{}'::text[]) || array['demo-trial']::text[]
      ) as x
    )
  )
where lower(coalesce(p.email, '')) = 'kamskillz1@gmail.com'
   or p.id in (
     select id from auth.users where lower(email) = 'kamskillz1@gmail.com'
   );

select id, tenant_id, nombre, cif, estado, municipio
from public.cooperativas
where tenant_id = 'demo-trial';

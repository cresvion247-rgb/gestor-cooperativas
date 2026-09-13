-- =============================================================================
-- RLS form fixes (run in Supabase SQL Editor on an already-migrated project)
-- Fixes: audit_logs / entity inserts failing for Urbalex admin app roles when
-- profiles.role is still "user", and for audit rows using urbalex-central.
-- Safe to re-run (CREATE OR REPLACE).
-- =============================================================================

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (
        p.role = 'admin'
        or p.app_role in ('super_admin_urbalex', 'administrador_urbalex')
      )
  );
$$;

create or replace function public.can_access_tenant(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (
        p.role = 'admin'
        or p.app_role in ('super_admin_urbalex', 'administrador_urbalex')
        or (p.tenant_id is not null and p.tenant_id = p_tenant_id)
        or (p.assigned_cooperativa_ids is not null and p_tenant_id = any (p.assigned_cooperativa_ids))
      )
  );
$$;

create or replace function public.can_mutate_tenant(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (
        p.role = 'admin'
        or p.app_role in ('super_admin_urbalex', 'administrador_urbalex')
        or (p.tenant_id is not null and p.tenant_id = p_tenant_id)
        or (p.assigned_cooperativa_ids is not null and p_tenant_id = any (p.assigned_cooperativa_ids))
      )
  );
$$;

-- Optional: promote known platform operators so UI isSuperAdmin matches RLS
-- (uncomment and adjust emails if needed)
-- update public.profiles
-- set role = 'admin'
-- where app_role in ('super_admin_urbalex', 'administrador_urbalex')
--   and role <> 'admin';

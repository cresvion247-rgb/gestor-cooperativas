-- =============================================================================
-- Urbalex ERP (gestor-cooperativas) — Phase 1 Supabase schema
-- Empty tables only. Run once in the Supabase SQL Editor.
-- Maps Base44 entities → snake_case plural tables + public.profiles.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Platform Super Admin (profiles.role = 'admin')
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Platform operators: profiles.role = admin OR Urbalex admin app roles
  -- (migration often seeds app_role without flipping role to admin).
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

-- Tenant access: own tenant_id, assigned_cooperativa_ids, or platform admin
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

-- Assigned staff (or admin) may mutate cooperativa-scoped rows when assigned
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

-- -----------------------------------------------------------------------------
-- profiles (Base44 User + auth.users)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user'
    check (role in ('admin', 'user')),
  app_role text
    check (
      app_role is null
      or app_role in (
        'super_admin_urbalex',
        'administrador_urbalex',
        'responsable_proyecto',
        'responsable_juridico_urbanistico',
        'responsable_financiero',
        'responsable_contratos',
        'consejo_rector',
        'socio_cooperativista',
        'tecnico_externo',
        'proveedor_externo'
      )
    ),
  tenant_id text,
  assigned_cooperativa_ids text[] not null default '{}',
  interface_language text not null default 'es'
    check (interface_language in ('es', 'en', 'eu', 'fr')),
  estado text not null default 'activo'
    check (estado in ('activo', 'inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, interface_language, estado)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'user',
    coalesce(new.raw_user_meta_data->>'interface_language', 'es'),
    'activo'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- cooperativas (Cooperativa)
-- tenant_id is a business slug (e.g. urbalex-central), not a FK.
-- -----------------------------------------------------------------------------

create table public.cooperativas (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  nombre text not null,
  cif text not null,
  forma_juridica text,
  estado text not null
    check (estado in ('pre_formacion', 'activa', 'inactiva', 'cerrada')),
  direccion text,
  municipio text,
  provincia text,
  codigo_postal text,
  email text,
  telefono text,
  fecha_constitucion date,
  administrador_urbalex text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id),
  unique (cif)
);

create trigger cooperativas_set_updated_at
  before update on public.cooperativas
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- proyectos (Proyecto)
-- -----------------------------------------------------------------------------

create table public.proyectos (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  nombre text not null,
  codigo text not null,
  estado text not null
    check (estado in (
      'viabilidad', 'adquisicion_suelo', 'urbanismo', 'licencias', 'licitacion',
      'construccion', 'entrega', 'garantia', 'cerrado'
    )),
  direccion text,
  municipio text,
  provincia text,
  referencia_catastral text,
  responsable text,
  inicio_previsto date,
  fin_previsto date,
  fin_estimado date,
  viviendas integer,
  presupuesto_total numeric,
  coste_comprometido numeric,
  coste_real numeric,
  riesgo text
    check (riesgo is null or riesgo in ('bajo', 'medio', 'alto', 'critico')),
  progreso_previsto numeric,
  progreso_real numeric,
  resumen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger proyectos_set_updated_at
  before update on public.proyectos
  for each row execute function public.set_updated_at();

create index proyectos_tenant_id_idx on public.proyectos (tenant_id);
create index proyectos_cooperativa_id_idx on public.proyectos (cooperativa_id);

-- -----------------------------------------------------------------------------
-- socios (Socio) — vivienda_id FK added after viviendas
-- -----------------------------------------------------------------------------

create table public.socios (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  nombre_completo text not null,
  dni_nie text not null,
  email text,
  telefono text,
  direccion text,
  estado text not null
    check (estado in ('candidato', 'activo', 'lista_espera', 'baja', 'completado')),
  fecha_admision date,
  vivienda_id uuid,
  referencia_pago text,
  preferencia_comunicacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger socios_set_updated_at
  before update on public.socios
  for each row execute function public.set_updated_at();

create index socios_tenant_id_idx on public.socios (tenant_id);
create index socios_cooperativa_id_idx on public.socios (cooperativa_id);
create index socios_email_idx on public.socios (email);

-- -----------------------------------------------------------------------------
-- viviendas (Vivienda)
-- -----------------------------------------------------------------------------

create table public.viviendas (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  proyecto_id uuid not null references public.proyectos (id),
  referencia text not null,
  bloque text,
  planta text,
  puerta text,
  tipologia text,
  dormitorios integer,
  metros_cuadrados numeric,
  estado text not null
    check (estado in ('disponible', 'reservada', 'adjudicada', 'entregada')),
  socio_id uuid references public.socios (id),
  coste_estimado numeric,
  coste_final numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger viviendas_set_updated_at
  before update on public.viviendas
  for each row execute function public.set_updated_at();

create index viviendas_tenant_id_idx on public.viviendas (tenant_id);
create index viviendas_proyecto_id_idx on public.viviendas (proyecto_id);

alter table public.socios
  add constraint socios_vivienda_id_fkey
  foreign key (vivienda_id) references public.viviendas (id);

-- -----------------------------------------------------------------------------
-- adjudicaciones (Adjudicacion) — delete:false in Base44
-- -----------------------------------------------------------------------------

create table public.adjudicaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  proyecto_id uuid references public.proyectos (id),
  socio_id uuid not null references public.socios (id),
  vivienda_id uuid not null references public.viviendas (id),
  fecha_adjudicacion date,
  estado text not null
    check (estado in ('activa', 'entregada', 'cancelada')),
  importe numeric,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger adjudicaciones_set_updated_at
  before update on public.adjudicaciones
  for each row execute function public.set_updated_at();

create index adjudicaciones_tenant_id_idx on public.adjudicaciones (tenant_id);

-- -----------------------------------------------------------------------------
-- aportaciones (Aportacion) — delete:false
-- -----------------------------------------------------------------------------

create table public.aportaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  proyecto_id uuid references public.proyectos (id),
  socio_id uuid not null references public.socios (id),
  tipo text
    check (
      tipo is null
      or tipo in ('entrada', 'periodica', 'extraordinaria', 'ajuste', 'devolucion', 'liquidacion_final')
    ),
  fecha_vencimiento date not null,
  importe_debido numeric not null,
  importe_pagado numeric,
  importe_pendiente numeric,
  estado text not null
    check (estado in ('pendiente', 'parcial', 'pagada', 'vencida', 'cancelada')),
  referencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger aportaciones_set_updated_at
  before update on public.aportaciones
  for each row execute function public.set_updated_at();

create index aportaciones_tenant_id_idx on public.aportaciones (tenant_id);
create index aportaciones_socio_id_idx on public.aportaciones (socio_id);

-- -----------------------------------------------------------------------------
-- proveedores (Proveedor) — delete:false
-- -----------------------------------------------------------------------------

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  nombre text not null,
  cif_nif text not null,
  categoria text,
  contacto_nombre text,
  email text,
  telefono text,
  direccion text,
  valoracion text
    check (valoracion is null or valoracion in ('excelente', 'buena', 'regular', 'baja')),
  estado text not null default 'candidato'
    check (estado in ('candidato', 'homologado', 'suspendido')),
  fecha_homologacion date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger proveedores_set_updated_at
  before update on public.proveedores
  for each row execute function public.set_updated_at();

create index proveedores_tenant_id_idx on public.proveedores (tenant_id);

-- -----------------------------------------------------------------------------
-- licitaciones (Licitacion) — delete:false
-- -----------------------------------------------------------------------------

create table public.licitaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  proyecto_id uuid not null references public.proyectos (id),
  titulo text not null,
  categoria text,
  referencia text,
  estado text not null default 'abierta'
    check (estado in ('abierta', 'en_evaluacion', 'adjudicada', 'cancelada')),
  fecha_apertura date,
  fecha_limite date,
  presupuesto_base numeric,
  requisitos text,
  proveedor_adjudicado_id uuid references public.proveedores (id),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger licitaciones_set_updated_at
  before update on public.licitaciones
  for each row execute function public.set_updated_at();

create index licitaciones_tenant_id_idx on public.licitaciones (tenant_id);

-- -----------------------------------------------------------------------------
-- ofertas (Oferta) — delete:false
-- -----------------------------------------------------------------------------

create table public.ofertas (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  licitacion_id uuid not null references public.licitaciones (id),
  proveedor_id uuid not null references public.proveedores (id),
  importe numeric not null,
  plazo_ejecucion text,
  puntuacion numeric,
  observaciones text,
  estado text not null default 'presentada'
    check (estado in ('presentada', 'favorable', 'descartada')),
  fecha_presentacion date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ofertas_set_updated_at
  before update on public.ofertas
  for each row execute function public.set_updated_at();

create index ofertas_tenant_id_idx on public.ofertas (tenant_id);
create index ofertas_licitacion_id_idx on public.ofertas (licitacion_id);

-- -----------------------------------------------------------------------------
-- contratos (Contrato) — delete:false
-- -----------------------------------------------------------------------------

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  proyecto_id uuid references public.proyectos (id),
  codigo text not null,
  titulo text not null,
  titulo_traducido text,
  categoria text not null,
  contraparte text,
  estado text not null
    check (estado in (
      'solicitud', 'borrador', 'revision', 'pendiente_aprobacion', 'aprobado',
      'pendiente_firma', 'activo', 'suspendido', 'vencido', 'resuelto',
      'cerrado', 'archivado'
    )),
  responsable text,
  fecha_firma date,
  fecha_vencimiento date,
  importe_base numeric,
  iva numeric,
  importe_total numeric,
  moneda text default 'EUR',
  riesgo text
    check (riesgo is null or riesgo in ('bajo', 'medio', 'alto', 'critico')),
  terminos_pago text,
  garantia_requerida boolean,
  exige_modificacion boolean not null default false,
  procedencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contratos_set_updated_at
  before update on public.contratos
  for each row execute function public.set_updated_at();

create index contratos_tenant_id_idx on public.contratos (tenant_id);
create index contratos_cooperativa_id_idx on public.contratos (cooperativa_id);

-- -----------------------------------------------------------------------------
-- contrato_modificaciones (ContratoModificacion) — delete:false
-- -----------------------------------------------------------------------------

create table public.contrato_modificaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  contrato_id uuid not null references public.contratos (id),
  motivo text not null,
  descripcion text,
  importe_total_anterior numeric,
  importe_total_nuevo numeric,
  fecha_vencimiento_anterior date,
  fecha_vencimiento_nueva date,
  terminos_pago_nuevos text,
  estado text not null default 'pendiente_aprobacion'
    check (estado in ('pendiente_aprobacion', 'aprobado', 'aplicado', 'rechazado')),
  fecha_solicitud date,
  fecha_aplicacion date,
  solicitado_por text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contrato_modificaciones_set_updated_at
  before update on public.contrato_modificaciones
  for each row execute function public.set_updated_at();

create index contrato_modificaciones_contrato_id_idx on public.contrato_modificaciones (contrato_id);

-- -----------------------------------------------------------------------------
-- incidencias (Incidencia)
-- -----------------------------------------------------------------------------

create table public.incidencias (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  proyecto_id uuid references public.proyectos (id),
  socio_id uuid references public.socios (id),
  titulo text not null,
  descripcion text,
  categoria text not null default 'otra'
    check (categoria in ('estructura', 'areas_comunes', 'instalaciones', 'acabados', 'otra')),
  prioridad text not null default 'media'
    check (prioridad in ('baja', 'media', 'alta', 'critica')),
  estado text not null default 'abierta'
    check (estado in ('abierta', 'en_gestion', 'resuelta', 'cerrada')),
  foto_url text,
  asignado_a text,
  resolucion text,
  fecha_resolucion date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger incidencias_set_updated_at
  before update on public.incidencias
  for each row execute function public.set_updated_at();

create index incidencias_tenant_id_idx on public.incidencias (tenant_id);

-- -----------------------------------------------------------------------------
-- alertas (Alerta)
-- -----------------------------------------------------------------------------

create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tipo text,
  titulo text not null,
  titulo_traducido text,
  descripcion text,
  descripcion_traducida text,
  prioridad text not null
    check (prioridad in ('baja', 'media', 'alta', 'critica')),
  fecha_limite date,
  estado text not null
    check (estado in ('abierta', 'en_gestion', 'resuelta', 'archivado')),
  entidad_tipo text,
  entidad_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger alertas_set_updated_at
  before update on public.alertas
  for each row execute function public.set_updated_at();

create index alertas_tenant_id_idx on public.alertas (tenant_id);

-- -----------------------------------------------------------------------------
-- consultas (Consulta)
-- -----------------------------------------------------------------------------

create table public.consultas (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  socio_id uuid references public.socios (id),
  solicitante_email text,
  categoria text not null
    check (categoria in ('juridica', 'financiera', 'construccion', 'secretaria')),
  asunto text not null,
  mensaje text,
  origen text not null default 'portal'
    check (origen in ('portal', 'concierge', 'secretaria')),
  estado text not null default 'abierta'
    check (estado in ('abierta', 'en_gestion', 'resuelta', 'cerrada')),
  respuesta text,
  conversacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger consultas_set_updated_at
  before update on public.consultas
  for each row execute function public.set_updated_at();

create index consultas_tenant_id_idx on public.consultas (tenant_id);
create index consultas_solicitante_email_idx on public.consultas (solicitante_email);

-- -----------------------------------------------------------------------------
-- documentos_socio (DocumentoSocio) — delete:false; private Storage path in file_uri
-- -----------------------------------------------------------------------------

create table public.documentos_socio (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  socio_id uuid not null references public.socios (id),
  tipo text not null
    check (tipo in ('dni_nie', 'justificante_ingresos', 'declaracion_jurada', 'contrato_firmado', 'otro')),
  nombre text,
  file_uri text, -- null while estado = solicitado (staff checklist request)
  subido_por_email text,
  estado text not null default 'subido'
    check (estado in ('solicitado', 'subido', 'verificado', 'rechazado')),
  fecha_revision date,
  motivo_rechazo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger documentos_socio_set_updated_at
  before update on public.documentos_socio
  for each row execute function public.set_updated_at();

create index documentos_socio_tenant_id_idx on public.documentos_socio (tenant_id);
create index documentos_socio_socio_id_idx on public.documentos_socio (socio_id);

-- -----------------------------------------------------------------------------
-- documentos_legales (DocumentoLegal) — delete:false
-- -----------------------------------------------------------------------------

create table public.documentos_legales (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  cooperativa_id uuid not null references public.cooperativas (id),
  proyecto_id uuid references public.proyectos (id),
  titulo text not null,
  titulo_traducido text,
  tipo text not null,
  referencia text,
  fecha_documento date,
  estado text not null
    check (estado in ('activo', 'archivado', 'caducado')),
  visibilidad text
    check (visibilidad is null or visibilidad in ('consejo_rector', 'interno', 'todos')),
  resumen text,
  resumen_traducido text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger documentos_legales_set_updated_at
  before update on public.documentos_legales
  for each row execute function public.set_updated_at();

create index documentos_legales_tenant_id_idx on public.documentos_legales (tenant_id);

-- -----------------------------------------------------------------------------
-- expedientes_urbanisticos (ExpedienteUrbanistico) — delete:false
-- -----------------------------------------------------------------------------

create table public.expedientes_urbanisticos (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  proyecto_id uuid not null references public.proyectos (id),
  tipo text not null,
  administracion text,
  referencia_oficial text,
  estado text not null,
  fecha_presentacion date,
  fecha_limite date,
  responsable text,
  riesgo text
    check (riesgo is null or riesgo in ('bajo', 'medio', 'alto', 'critico')),
  requisitos text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger expedientes_urbanisticos_set_updated_at
  before update on public.expedientes_urbanisticos
  for each row execute function public.set_updated_at();

create index expedientes_urbanisticos_tenant_id_idx on public.expedientes_urbanisticos (tenant_id);
create index expedientes_urbanisticos_proyecto_id_idx on public.expedientes_urbanisticos (proyecto_id);

-- -----------------------------------------------------------------------------
-- audit_logs (AuditLog) — immutable (no update/delete)
-- valores_* stored as jsonb (Base44 used JSON strings; façade may stringify)
-- -----------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  accion text not null,
  entidad_tipo text not null,
  entidad_id text,
  usuario_id uuid references public.profiles (id),
  usuario_email text,
  usuario_rol text,
  valores_anteriores jsonb,
  valores_nuevos jsonb,
  ip_direccion text,
  detalle text,
  fecha timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index audit_logs_tenant_id_idx on public.audit_logs (tenant_id);
create index audit_logs_fecha_idx on public.audit_logs (fecha desc);

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.cooperativas enable row level security;
alter table public.proyectos enable row level security;
alter table public.socios enable row level security;
alter table public.viviendas enable row level security;
alter table public.adjudicaciones enable row level security;
alter table public.aportaciones enable row level security;
alter table public.proveedores enable row level security;
alter table public.licitaciones enable row level security;
alter table public.ofertas enable row level security;
alter table public.contratos enable row level security;
alter table public.contrato_modificaciones enable row level security;
alter table public.incidencias enable row level security;
alter table public.alertas enable row level security;
alter table public.consultas enable row level security;
alter table public.documentos_socio enable row level security;
alter table public.documentos_legales enable row level security;
alter table public.expedientes_urbanisticos enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_platform_admin()
  );

create policy "profiles_update_own_or_admin"
  on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or public.is_platform_admin()
  )
  with check (
    id = (select auth.uid())
    or public.is_platform_admin()
  );

-- Platform admin may insert profile rows (e.g. invite flows); trigger handles signup.
create policy "profiles_insert_admin"
  on public.profiles for insert to authenticated
  with check (public.is_platform_admin());

-- cooperativas: create/delete admin only; update admin|assigned; read tenant|assigned|admin
create policy "cooperativas_select"
  on public.cooperativas for select to authenticated
  using (public.can_access_tenant(tenant_id));

create policy "cooperativas_insert_admin"
  on public.cooperativas for insert to authenticated
  with check (public.is_platform_admin());

create policy "cooperativas_update"
  on public.cooperativas for update to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and tenant_id = any (p.assigned_cooperativa_ids)
    )
  )
  with check (
    public.is_platform_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and tenant_id = any (p.assigned_cooperativa_ids)
    )
  );

create policy "cooperativas_delete_admin"
  on public.cooperativas for delete to authenticated
  using (public.is_platform_admin());

-- Generic tenant-scoped CRUD macro via repeated policies
-- proyectos
create policy "proyectos_select" on public.proyectos for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "proyectos_insert" on public.proyectos for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "proyectos_update" on public.proyectos for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));
create policy "proyectos_delete_admin" on public.proyectos for delete to authenticated
  using (public.is_platform_admin());

-- socios
create policy "socios_select" on public.socios for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "socios_insert" on public.socios for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "socios_update" on public.socios for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));
create policy "socios_delete_admin" on public.socios for delete to authenticated
  using (public.is_platform_admin());

-- viviendas
create policy "viviendas_select" on public.viviendas for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "viviendas_insert" on public.viviendas for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "viviendas_update" on public.viviendas for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));
create policy "viviendas_delete_admin" on public.viviendas for delete to authenticated
  using (public.is_platform_admin());

-- adjudicaciones (no delete)
create policy "adjudicaciones_select" on public.adjudicaciones for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "adjudicaciones_insert" on public.adjudicaciones for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "adjudicaciones_update" on public.adjudicaciones for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));

-- aportaciones (no delete)
create policy "aportaciones_select" on public.aportaciones for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "aportaciones_insert" on public.aportaciones for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "aportaciones_update" on public.aportaciones for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));

-- proveedores (no delete)
create policy "proveedores_select" on public.proveedores for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "proveedores_insert" on public.proveedores for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "proveedores_update" on public.proveedores for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));

-- licitaciones (no delete)
create policy "licitaciones_select" on public.licitaciones for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "licitaciones_insert" on public.licitaciones for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "licitaciones_update" on public.licitaciones for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));

-- ofertas (no delete)
create policy "ofertas_select" on public.ofertas for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "ofertas_insert" on public.ofertas for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "ofertas_update" on public.ofertas for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));

-- contratos (no delete)
create policy "contratos_select" on public.contratos for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "contratos_insert" on public.contratos for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "contratos_update" on public.contratos for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));

-- contrato_modificaciones (no delete)
create policy "contrato_modificaciones_select" on public.contrato_modificaciones for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "contrato_modificaciones_insert" on public.contrato_modificaciones for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "contrato_modificaciones_update" on public.contrato_modificaciones for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));

-- incidencias
create policy "incidencias_select" on public.incidencias for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "incidencias_insert" on public.incidencias for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "incidencias_update" on public.incidencias for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));
create policy "incidencias_delete_admin" on public.incidencias for delete to authenticated
  using (public.is_platform_admin());

-- alertas
create policy "alertas_select" on public.alertas for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "alertas_insert" on public.alertas for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "alertas_update" on public.alertas for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));
create policy "alertas_delete_admin" on public.alertas for delete to authenticated
  using (public.is_platform_admin());

-- consultas
create policy "consultas_select" on public.consultas for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "consultas_insert" on public.consultas for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "consultas_update" on public.consultas for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));
create policy "consultas_delete_admin" on public.consultas for delete to authenticated
  using (public.is_platform_admin());

-- documentos_socio (no delete)
create policy "documentos_socio_select" on public.documentos_socio for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "documentos_socio_insert" on public.documentos_socio for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "documentos_socio_update" on public.documentos_socio for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));

-- documentos_legales (no delete)
create policy "documentos_legales_select" on public.documentos_legales for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "documentos_legales_insert" on public.documentos_legales for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "documentos_legales_update" on public.documentos_legales for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));

-- expedientes_urbanisticos (no delete)
create policy "expedientes_urbanisticos_select" on public.expedientes_urbanisticos for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "expedientes_urbanisticos_insert" on public.expedientes_urbanisticos for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));
create policy "expedientes_urbanisticos_update" on public.expedientes_urbanisticos for update to authenticated
  using (public.can_mutate_tenant(tenant_id))
  with check (public.can_mutate_tenant(tenant_id));

-- audit_logs: select tenant|admin; insert tenant|admin; no update; no delete
create policy "audit_logs_select" on public.audit_logs for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "audit_logs_insert" on public.audit_logs for insert to authenticated
  with check (public.can_mutate_tenant(tenant_id));

-- =============================================================================
-- Grants
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- No anon table reads required (ERP is authenticated). Storage public bucket covers photo URLs.
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Immutable audit_logs: still grant update/delete at table level; RLS blocks them.
grant usage, select on all sequences in schema public to authenticated;

-- Helper functions callable by authenticated (and by RLS)
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.can_access_tenant(text) to authenticated;
grant execute on function public.can_mutate_tenant(text) to authenticated;

-- =============================================================================
-- Storage buckets (create in Dashboard or via API). Policies below are COMMENTED
-- — enable after buckets exist.
--
-- Buckets inferred from upload code:
--   1) documentos-socio-privados  — private vault (IntakeForm UploadPrivateFile → DocumentoSocio.file_uri)
--   2) incidencias-fotos         — public-ish incidencia photos (IncidenciaDialog UploadFile → foto_url)
-- =============================================================================

-- insert into storage.buckets (id, name, public)
-- values
--   ('documentos-socio-privados', 'documentos-socio-privados', false),
--   ('incidencias-fotos', 'incidencias-fotos', true)
-- on conflict (id) do nothing;

-- -- Private socio documents: authenticated tenant members may upload/read own tenant paths
-- -- Expected object path convention: {tenant_id}/{socio_id}/{filename}
-- create policy "documentos_socio_privados_select"
--   on storage.objects for select to authenticated
--   using (
--     bucket_id = 'documentos-socio-privados'
--     and public.can_access_tenant((storage.foldername(name))[1])
--   );
-- create policy "documentos_socio_privados_insert"
--   on storage.objects for insert to authenticated
--   with check (
--     bucket_id = 'documentos-socio-privados'
--     and public.can_mutate_tenant((storage.foldername(name))[1])
--   );
-- create policy "documentos_socio_privados_update"
--   on storage.objects for update to authenticated
--   using (
--     bucket_id = 'documentos-socio-privados'
--     and public.can_mutate_tenant((storage.foldername(name))[1])
--   );
-- -- no delete policy (mirrors DocumentoSocio delete:false); signed URLs via Edge Function later

-- -- Public incidencia photos: anyone can read; authenticated can upload under tenant folder
-- create policy "incidencias_fotos_public_select"
--   on storage.objects for select to anon, authenticated
--   using (bucket_id = 'incidencias-fotos');
-- create policy "incidencias_fotos_insert"
--   on storage.objects for insert to authenticated
--   with check (
--     bucket_id = 'incidencias-fotos'
--     and public.can_mutate_tenant((storage.foldername(name))[1])
--   );

// Central access-control rules. These mirror (never replace) the RLS rules
// defined on each entity in base44/entities/*.jsonc — UI checks only hide or
// disable controls, the entity rules remain the actual security boundary.

export const APP_ROLES = [
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
];

// Tenant used for global Urbalex actions (audit entries, internal staff).
export const CENTRAL_TENANT_ID = 'urbalex-central';

export const isSuperAdmin = (user) => user?.role === 'admin';

export const assignedCooperativaIds = (user) => user?.assigned_cooperativa_ids || [];

// Assigned internal staff may edit cooperatives assigned to them (all fields
// except lifecycle status); only the Super Admin can change status.
export const canEditCooperativa = (user, cooperativa) =>
  isSuperAdmin(user) || assignedCooperativaIds(user).includes(cooperativa?.tenant_id);

export const canChangeCooperativaStatus = (user) => isSuperAdmin(user);

export const canManageUsers = (user) => isSuperAdmin(user);

// Member-platform roles: external contractors never see member-facing features.
export const EXTERNAL_ROLES = ['tecnico_externo', 'proveedor_externo'];

export const isInternalUser = (user) =>
  isSuperAdmin(user) || !EXTERNAL_ROLES.includes(user?.app_role);

// Personal de cooperativa: roles internos con perfil asignado, excluidos los socios.
export const isCoopStaff = (user) =>
  isSuperAdmin(user) || (isInternalUser(user) && Boolean(user?.app_role) && user.app_role !== 'socio_cooperativista');
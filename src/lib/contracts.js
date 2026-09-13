import { isSuperAdmin } from '@/lib/permissions';

// Ciclo de vida contractual: solicitud → activo. Las transiciones se avanzan
// una a una y cada salto queda auditado; «activo» exige firma y actualiza el
// coste comprometido del proyecto.
export const PIPELINE = ['solicitud', 'borrador', 'revision', 'pendiente_aprobacion', 'aprobado', 'pendiente_firma', 'activo'];

// Roles con capacidad de aprobar contratos (paso pendiente_aprobacion → aprobado).
const APPROVER_ROLES = ['administrador_urbalex', 'responsable_contratos', 'responsable_financiero', 'responsable_juridico_urbanistico'];

export const canApproveContract = (user) =>
  isSuperAdmin(user) || APPROVER_ROLES.includes(user?.app_role);
import { base44 } from '@/api/base44Client';

// Localiza el expediente de socio asociado al email del usuario conectado.
export async function findMySocio(email) {
  if (!email) return null;
  const res = await base44.entities.Socio.filter({ email });
  return res?.[0] || null;
}

// Cooperativa a la que pertenece el usuario (por tenant o por asignación).
export function findMyCooperativa(cooperativas, user) {
  if (!user || !Array.isArray(cooperativas)) return null;
  const assigned = user.assigned_cooperativa_ids || [];
  return cooperativas.find(c => c.tenant_id === user.tenant_id || assigned.includes(c.tenant_id)) || null;
}
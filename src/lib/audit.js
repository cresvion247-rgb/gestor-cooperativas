import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { CENTRAL_TENANT_ID } from '@/lib/permissions';

// Single shared audit service: every mutation flow should call logAudit.
// Actor and IP are resolved once per session and cached (the app hard-reloads
// on auth changes, so the cache cannot outlive a login/logout).
//
// Audit writes must NEVER break the primary action (create/update/PDF). If RLS
// or network fails, we log to the console and return null.

let cachedActor;
let cachedIp;

async function getActor() {
  if (cachedActor === undefined) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        cachedActor = null;
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, role, app_role, tenant_id, assigned_cooperativa_ids')
          .eq('id', session.user.id)
          .maybeSingle();
        cachedActor = {
          id: session.user.id,
          email: profile?.email || session.user.email || null,
          role: profile?.role ?? null,
          app_role: profile?.app_role ?? null,
          tenant_id: profile?.tenant_id ?? null,
          assigned_cooperativa_ids: profile?.assigned_cooperativa_ids || [],
        };
      }
    } catch (e) {
      cachedActor = null;
    }
  }
  return cachedActor;
}

async function getIp() {
  if (cachedIp === undefined) {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      cachedIp = (await res.json()).ip || null;
    } catch (e) { cachedIp = null; }
  }
  return cachedIp;
}

function resolveAuditTenant(explicit, actor) {
  if (explicit) return explicit;
  if (actor?.tenant_id) return actor.tenant_id;
  const assigned = actor?.assigned_cooperativa_ids || [];
  if (assigned.length) return assigned[0];
  return CENTRAL_TENANT_ID;
}

export async function logAudit({ tenant_id, accion, entidad_tipo, entidad_id, valores_anteriores, valores_nuevos, detalle }) {
  try {
    const [usuario, ip] = await Promise.all([getActor(), getIp()]);
    return await base44.entities.AuditLog.create({
      tenant_id: resolveAuditTenant(tenant_id, usuario),
      accion,
      entidad_tipo,
      entidad_id: entidad_id || null,
      usuario_id: usuario?.id || null,
      usuario_email: usuario?.email || null,
      usuario_rol: usuario?.app_role || usuario?.role || null,
      valores_anteriores: valores_anteriores ? JSON.stringify(valores_anteriores) : null,
      valores_nuevos: valores_nuevos ? JSON.stringify(valores_nuevos) : null,
      ip_direccion: ip,
      detalle: detalle || null,
      fecha: new Date().toISOString()
    });
  } catch (e) {
    console.warn('[logAudit] skipped:', e?.message || e);
    return null;
  }
}

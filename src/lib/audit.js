import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { CENTRAL_TENANT_ID } from '@/lib/permissions';

// Single shared audit service: every mutation flow must call logAudit.
// Actor and IP are resolved once per session and cached (the app hard-reloads
// on auth changes, so the cache cannot outlive a login/logout).
//
// Phase 2: actor comes from Supabase session + profiles (UI auth).
// Phase 3: AuditLog.create goes through the Supabase entities façade
// (valores_* JSON strings are parsed to jsonb at the façade boundary).

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
          .select('id, email, role, app_role')
          .eq('id', session.user.id)
          .maybeSingle();
        cachedActor = {
          id: session.user.id,
          email: profile?.email || session.user.email || null,
          role: profile?.role ?? null,
          app_role: profile?.app_role ?? null,
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

export async function logAudit({ tenant_id, accion, entidad_tipo, entidad_id, valores_anteriores, valores_nuevos, detalle }) {
  const [usuario, ip] = await Promise.all([getActor(), getIp()]);
  return base44.entities.AuditLog.create({
    tenant_id: tenant_id || CENTRAL_TENANT_ID,
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
}

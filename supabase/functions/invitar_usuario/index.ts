// Invite (or create) a user and set profiles.app_role / tenant / platform role.
// Callers must be platform admins (profiles.role = admin or Urbalex admin app_role).
// Returns invite_link when Auth email cannot send, so the admin can share it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const PLATFORM_APP_ROLES = ['super_admin_urbalex', 'administrador_urbalex'];

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function isPlatformAdmin(profile: { role?: string | null; app_role?: string | null } | null) {
  if (!profile) return false;
  return profile.role === 'admin' || PLATFORM_APP_ROLES.includes(String(profile.app_role || ''));
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('id, role, app_role, estado')
      .eq('id', callerData.user.id)
      .maybeSingle();

    if (!isPlatformAdmin(callerProfile) || callerProfile?.estado === 'inactivo') {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders(origin) });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const app_role = body.app_role ? String(body.app_role).trim() : null;
    const tenant_id = body.tenant_id ? String(body.tenant_id).trim() : null;
    const redirectTo = String(body.redirect_to || Deno.env.get('SITE_URL') || origin || '').replace(/\/$/, '') || undefined;

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'email is required' }, { status: 400, headers: corsHeaders(origin) });
    }

    const platform = app_role && PLATFORM_APP_ROLES.includes(app_role);
    const profilePatch = {
      email,
      app_role: app_role || null,
      tenant_id: platform ? null : (tenant_id || null),
      role: platform ? 'admin' : 'user',
      estado: 'activo',
    };

    let userId: string | null = null;
    let inviteLink: string | null = null;
    let invitedByEmail = false;

    const inviteRes = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo ? `${redirectTo}/login` : undefined,
      data: { app_role, tenant_id },
    });

    if (!inviteRes.error && inviteRes.data?.user?.id) {
      userId = inviteRes.data.user.id;
      invitedByEmail = true;
    } else {
      // Fallback: create user + magic invite link for the admin to copy
      const createRes = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { app_role, tenant_id },
      });
      if (createRes.error || !createRes.data?.user?.id) {
        // Maybe already exists — look up
        const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = (listed?.users || []).find((u) => (u.email || '').toLowerCase() === email);
        if (!existing) {
          return Response.json(
            { error: inviteRes.error?.message || createRes.error?.message || 'Could not create user' },
            { status: 400, headers: corsHeaders(origin) },
          );
        }
        userId = existing.id;
      } else {
        userId = createRes.data.user.id;
      }

      const linkRes = await admin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { redirectTo: redirectTo ? `${redirectTo}/login` : undefined },
      });
      inviteLink = linkRes.data?.properties?.action_link || null;
    }

    if (!userId) {
      return Response.json({ error: 'User id missing after invite' }, { status: 500, headers: corsHeaders(origin) });
    }

    // Profile row is usually created by trigger; upsert fields we care about
    const { error: upsertErr } = await admin.from('profiles').upsert(
      { id: userId, ...profilePatch },
      { onConflict: 'id' },
    );
    if (upsertErr) {
      // Trigger may race — retry update
      await admin.from('profiles').update(profilePatch).eq('id', userId);
    }

    return Response.json(
      {
        ok: true,
        user_id: userId,
        email,
        invited_by_email: invitedByEmail,
        invite_link: inviteLink,
        profile: profilePatch,
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500, headers: corsHeaders(origin) });
  }
});

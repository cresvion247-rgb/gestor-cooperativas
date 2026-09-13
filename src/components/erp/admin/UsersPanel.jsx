import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import DataTable from '@/components/erp/DataTable';
import UserDialog from '@/components/erp/admin/UserDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import ConfirmDialog from '@/components/erp/ConfirmDialog';
import { APP_ROLES, CENTRAL_TENANT_ID } from '@/lib/permissions';

export default function UsersPanel() {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('socio_cooperativista');
  const [tenant, setTenant] = useState('');
  const [inviting, setInviting] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const { user: me } = useAuth();
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.list() });
  const { data: coops = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list() });
  const coopName = id => (coops.find(c => c.tenant_id === id) || {}).nombre || id || '—';

  const deactivate = async u => {
    setBusy(true);
    try {
      await base44.entities.User.update(u.id, { estado: 'inactivo', tenant_id: null, assigned_cooperativa_ids: [] });
      await logAudit({
        tenant_id: CENTRAL_TENANT_ID,
        accion: 'usuario_desactivado',
        entidad_tipo: 'User',
        entidad_id: u.id,
        valores_anteriores: { tenant_id: u.tenant_id, assigned_cooperativa_ids: u.assigned_cooperativa_ids, estado: u.estado },
        valores_nuevos: { estado: 'inactivo', tenant_id: null, assigned_cooperativa_ids: [] }
      });
      qc.invalidateQueries({ queryKey: ['users'] });
      toast({ title: t('users.deactivated') });
      setConfirming(null);
    } catch (e) {
      toast({ title: t('users.deactivateFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

  const invite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invitar_usuario', {
        body: {
          email: email.trim(),
          app_role: role,
          tenant_id: tenant || null,
          redirect_to: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await logAudit({
        tenant_id: tenant || CENTRAL_TENANT_ID,
        accion: 'usuario_invitado',
        entidad_tipo: 'User',
        entidad_id: data?.user_id || email,
        valores_nuevos: { email, app_role: role, tenant_id: tenant || null, invited_by_email: data?.invited_by_email },
      });

      if (data?.invite_link) {
        try { await navigator.clipboard.writeText(data.invite_link); } catch { /* ignore */ }
        toast({
          title: t('users.invited'),
          description: t('users.inviteLinkCopied'),
        });
      } else {
        toast({ title: t('users.invited'), description: t('users.inviteEmailSent') });
      }
      setEmail('');
      qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e) {
      const msg = String(e?.message || e);
      const needsDeploy = /not found|404|Failed to send|FunctionsRelayError|FunctionException/i.test(msg);
      toast({
        title: t('users.inviteFailed'),
        description: needsDeploy ? t('users.inviteDeployHint') : msg,
        variant: 'destructive',
      });
    }
    setInviting(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#102A43]">{t('users.inviteTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('users.inviteHint')}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1.4fr_1.4fr_auto]">
          <div><Label className="mb-1">{t('users.email')}</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@correo.com" className="bg-slate-50" /></div>
          <div><Label className="mb-1">{t('users.profile')}</Label><select value={role} onChange={e => setRole(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">{APP_ROLES.map(r => <option key={r} value={r}>{st(r)}</option>)}</select></div>
          <div><Label className="mb-1">{t('users.cooperative')}</Label><select value={tenant} onChange={e => setTenant(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"><option value="">{t('users.internalStaff')}</option>{coops.map(c => <option key={c.id} value={c.tenant_id}>{c.nombre}</option>)}</select></div>
          <div className="flex items-end"><Button onClick={invite} disabled={inviting} className="bg-[#102A43] hover:bg-[#173F5F]">{inviting ? t('users.sending') : t('users.invite')}</Button></div>
        </div>
      </section>
      {isLoading ? <p className="text-slate-500">{t('users.loadingUsers')}</p> : (
        <DataTable
          columns={[
            { key: 'email', label: t('users.col.user') },
            { key: 'role', label: t('users.col.platformRole'), badge: true },
            { key: 'app_role', label: t('users.col.profile'), render: v => v ? st(v) : '—' },
            { key: 'tenant_id', label: t('users.cooperative'), render: coopName },
            { key: 'assigned_cooperativa_ids', label: t('users.col.assigned'), render: v => (v && v.length) ? v.map(coopName).join(', ') : '—' },
            { key: 'estado', label: t('common.status'), badge: true },
            { key: 'acciones', label: '', render: (_, u) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(u)}>{t('common.manage')}</Button>
                {u.estado !== 'inactivo' && u.id !== me?.id && <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setConfirming(u)}>{t('users.deactivate')}</Button>}
              </div>
            ) }
          ]}
          rows={users}
        />
      )}
      {editing && <UserDialog user={editing} cooperativas={coops} onClose={() => setEditing(null)} />}
      {confirming && (
        <ConfirmDialog
          title={t('users.deactivateTitle')}
          description={t('users.deactivateBody')}
          busy={busy}
          onClose={() => setConfirming(null)}
          actions={[{ label: t('users.deactivate'), destructive: true, onConfirm: () => deactivate(confirming) }]}
        />
      )}
    </div>
  );
}
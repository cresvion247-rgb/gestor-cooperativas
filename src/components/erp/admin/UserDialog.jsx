import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { APP_ROLES, CENTRAL_TENANT_ID } from '@/lib/permissions';
import { useI18n } from '@/lib/i18n';

export default function UserDialog({ user, cooperativas, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [appRole, setAppRole] = useState(user.app_role || '');
  const [tenant, setTenant] = useState(user.tenant_id || '');
  const [assigned, setAssigned] = useState(user.assigned_cooperativa_ids || []);
  const [estado, setEstado] = useState(user.estado || 'activo');
  const [saving, setSaving] = useState(false);
  const toggle = id => setAssigned(a => (a.includes(id) ? a.filter(x => x !== id) : [...a, id]));

  const save = async () => {
    setSaving(true);
    try {
      const inactive = estado === 'inactivo';
      await base44.entities.User.update(user.id, { app_role: appRole || null, tenant_id: inactive ? null : (tenant || null), assigned_cooperativa_ids: inactive ? [] : assigned, estado });
      await logAudit({
        tenant_id: (inactive ? null : tenant) || user.tenant_id || CENTRAL_TENANT_ID,
        accion: inactive ? 'usuario_desactivado' : (user.estado === 'inactivo' && estado === 'activo' ? 'usuario_reactivado' : 'usuario_actualizado'),
        entidad_tipo: 'User',
        entidad_id: user.id,
        valores_anteriores: { app_role: user.app_role, tenant_id: user.tenant_id, assigned_cooperativa_ids: user.assigned_cooperativa_ids, estado: user.estado },
        valores_nuevos: { app_role: appRole, tenant_id: inactive ? null : tenant, assigned_cooperativa_ids: inactive ? [] : assigned, estado }
      });
      toast({ title: t('users.updated') });
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (e) {
      toast({ title: t('users.updateFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('users.manageTitle')} · {user.email}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1">{t('common.status')}</Label>
            <select value={estado} onChange={e => setEstado(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              <option value="activo">{st('activo')}</option>
              <option value="inactivo">{st('inactivo')}</option>
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('users.accessProfile')}</Label>
            <select value={appRole} onChange={e => setAppRole(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              <option value="">{t('users.noProfile')}</option>
              {APP_ROLES.map(r => <option key={r} value={r}>{st(r)}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('users.membership')}</Label>
            <select value={tenant} onChange={e => setTenant(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              <option value="">{t('users.internalStaff')}</option>
              {cooperativas.map(c => <option key={c.id} value={c.tenant_id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1">{t('users.assignedList')}</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {cooperativas.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={assigned.includes(c.tenant_id)} onChange={() => toggle(c.tenant_id)} className="h-4 w-4 accent-teal-700" />
                  {c.nombre}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('users.cancel')}</Button>
          <Button onClick={save} disabled={saving} className="bg-[#102A43] hover:bg-[#173F5F]">{saving ? t('users.saving') : t('users.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
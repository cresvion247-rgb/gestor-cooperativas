import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { notifyCooperative } from '@/lib/notify';
import { useI18n } from '@/lib/i18n';

const RIESGOS = ['', 'bajo', 'medio', 'alto', 'critico'];
const FIELDS = ['codigo', 'titulo', 'categoria', 'contraparte', 'responsable', 'importe_base', 'iva', 'importe_total', 'fecha_vencimiento', 'terminos_pago', 'riesgo'];
const NUM_FIELDS = ['importe_base', 'iva', 'importe_total'];
const EXPIRY_WINDOW_DAYS = 30;

export default function ContratoDialog({ contrato, cooperativas, proyectos, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(contrato?.id);
  const [cooperativaId, setCooperativaId] = useState(contrato?.cooperativa_id || '');
  const [proyectoId, setProyectoId] = useState(contrato?.proyecto_id || '');
  const [garantia, setGarantia] = useState(Boolean(contrato?.garantia_requerida));
  const [exigeMod, setExigeMod] = useState(Boolean(contrato?.exige_modificacion));
  const [form, setForm] = useState(() => {
    const base = Object.fromEntries(FIELDS.map(k => [k, '']));
    if (contrato) FIELDS.forEach(k => { base[k] = contrato[k] ?? ''; });
    return base;
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Total = base × (1 + IVA %), recalculado al editar base o IVA.
  const recalcTotal = (k, v) => {
    const next = { ...form, [k]: v };
    const base = parseFloat(next.importe_base);
    const iva = parseFloat(next.iva);
    if (!isNaN(base)) next.importe_total = +(base * (1 + (isNaN(iva) ? 0 : iva) / 100)).toFixed(2);
    setForm(next);
  };

  const raiseAlerts = async (payload, tenant_id) => {
    const alerts = [];
    if (payload.fecha_vencimiento) {
      const days = Math.ceil((new Date(payload.fecha_vencimiento) - new Date()) / 86400000);
      if (days < 0) alerts.push({ prioridad: 'critica', descripcion: t('con.expiryOverdue') });
      else if (days <= EXPIRY_WINDOW_DAYS) alerts.push({ prioridad: 'alta', descripcion: t('con.expirySoon') });
    }
    if (['alto', 'critico'].includes(payload.riesgo)) alerts.push({ prioridad: 'alta', descripcion: t('con.riskAlert') });
    for (const a of alerts) {
      await notifyCooperative({ tenant_id, tipo: 'contrato', titulo: `${t('con.title')}: ${payload.codigo || payload.titulo}`, descripcion: a.descripcion, prioridad: a.prioridad });
    }
    if (alerts.length) toast({ title: t('con.alertRaised') });
  };

  const save = async () => {
    if (isEdit && contrato.estado === 'activo' && contrato.exige_modificacion) {
      toast({ title: t('con.amendmentBlocked'), variant: 'destructive' });
      return;
    }
    if (!form.codigo || !form.titulo || !cooperativaId) {
      toast({ title: t('con.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const coop = cooperativas.find(c => c.id === cooperativaId);
      const payload = Object.fromEntries(FIELDS.map(k => [k, NUM_FIELDS.includes(k) ? (form[k] === '' ? null : Number(form[k])) : (form[k] === '' ? null : form[k])]));
      payload.garantia_requerida = garantia;
      payload.exige_modificacion = exigeMod;
      payload.proyecto_id = proyectoId || null;
      if (isEdit) {
        await base44.entities.Contrato.update(contrato.id, payload);
        await logAudit({ tenant_id: coop.tenant_id, accion: 'contrato_actualizado', entidad_tipo: 'Contrato', entidad_id: contrato.id, valores_nuevos: payload });
        toast({ title: t('con.updated') });
      } else {
        payload.tenant_id = coop.tenant_id;
        payload.cooperativa_id = cooperativaId;
        payload.estado = 'solicitud';
        const res = await base44.entities.Contrato.create(payload);
        await logAudit({ tenant_id: coop.tenant_id, accion: 'contrato_creado', entidad_tipo: 'Contrato', entidad_id: res?.id || null, valores_nuevos: payload });
        toast({ title: t('con.created') });
      }
      await raiseAlerts(payload, coop.tenant_id);
      qc.invalidateQueries({ queryKey: ['contratos'] });
      onClose();
    } catch (e) {
      toast({ title: isEdit ? t('con.updateFailed') : t('con.createFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  const field = (key, label, type = 'text') => (
    <div key={key}>
      <Label className="mb-1">{label}</Label>
      <Input type={type} value={form[key] ?? ''} onChange={e => set(key, e.target.value)} className="bg-slate-50" />
    </div>
  );

  const coopProyectos = proyectos.filter(p => p.cooperativa_id === cooperativaId);

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? t('con.editTitle') : t('con.newTitle')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('codigo', t('con.f.code'))}
          {field('titulo', t('con.f.title'))}
          {field('categoria', t('con.f.category'))}
          {field('contraparte', t('con.f.counterpart'))}
          <div>
            <Label className="mb-1">{t('users.cooperative')}</Label>
            <Select value={cooperativaId || undefined} onValueChange={v => { setCooperativaId(v); setProyectoId(''); }} disabled={isEdit}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 disabled:opacity-60">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {cooperativas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1">{t('common.project')}</Label>
            <Select value={proyectoId || undefined} onValueChange={setProyectoId}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {coopProyectos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1">{t('con.f.amount')}</Label>
            <Input type="number" value={form.importe_base ?? ''} onChange={e => recalcTotal('importe_base', e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="mb-1">{t('con.f.vat')}</Label>
            <Input type="number" value={form.iva ?? ''} onChange={e => recalcTotal('iva', e.target.value)} className="bg-slate-50" />
          </div>
          {field('importe_total', t('con.f.total'), 'number')}
          {field('fecha_vencimiento', t('con.f.expiry'), 'date')}
          {field('terminos_pago', t('con.f.paymentTerms'))}
          {field('responsable', t('urba.col.responsible'))}
          <div>
            <Label className="mb-1">{t('common.risk')}</Label>
            <select value={form.riesgo || ''} onChange={e => set('riesgo', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              {RIESGOS.map(r => <option key={r} value={r}>{r ? st(r) : '—'}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={garantia} onChange={e => setGarantia(e.target.checked)} className="h-4 w-4 accent-[#102A43]" />
            {t('con.f.guarantee')}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={exigeMod} onChange={e => setExigeMod(e.target.checked)} className="h-4 w-4 accent-[#102A43]" />
            {t('con.f.amendmentRequired')}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={saving} className="bg-[#102A43] hover:bg-[#173F5F]">{saving ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
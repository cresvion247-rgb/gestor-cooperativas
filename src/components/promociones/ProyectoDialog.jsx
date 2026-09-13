import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';

const FASES = [
  'viabilidad',
  'adquisicion_suelo',
  'urbanismo',
  'licencias',
  'licitacion',
  'construccion',
  'entrega',
  'garantia',
  'cerrado',
];
const RIESGOS = ['', 'bajo', 'medio', 'alto', 'critico'];
const TEXT_FIELDS = [
  'codigo',
  'nombre',
  'direccion',
  'municipio',
  'provincia',
  'referencia_catastral',
  'responsable',
  'resumen',
];
const DATE_FIELDS = ['inicio_previsto', 'fin_previsto'];
const NUM_FIELDS = ['presupuesto_total', 'viviendas'];

export default function ProyectoDialog({ proyecto, cooperativas, onClose }) {
  const { t, st } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(proyecto?.id);

  const [cooperativaId, setCooperativaId] = useState(proyecto?.cooperativa_id || '');
  const [estado, setEstado] = useState(proyecto?.estado || 'viabilidad');
  const [form, setForm] = useState(() => {
    const base = Object.fromEntries([...TEXT_FIELDS, ...DATE_FIELDS, ...NUM_FIELDS, 'riesgo'].map((k) => [k, '']));
    if (proyecto) {
      [...TEXT_FIELDS, ...DATE_FIELDS, ...NUM_FIELDS, 'riesgo'].forEach((k) => {
        base[k] = proyecto[k] ?? '';
      });
    }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.codigo?.trim() || !form.nombre?.trim() || !cooperativaId) {
      toast({ title: t('prom.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const coop = cooperativas.find((c) => c.id === cooperativaId);
      if (!coop?.tenant_id) {
        toast({ title: t('prom.createFailed'), description: t('prom.coopMissing'), variant: 'destructive' });
        setSaving(false);
        return;
      }
      const payload = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        estado,
        direccion: form.direccion || null,
        municipio: form.municipio || null,
        provincia: form.provincia || null,
        referencia_catastral: form.referencia_catastral || null,
        responsable: form.responsable || null,
        resumen: form.resumen || null,
        inicio_previsto: form.inicio_previsto || null,
        fin_previsto: form.fin_previsto || null,
        presupuesto_total: form.presupuesto_total === '' ? null : Number(form.presupuesto_total),
        viviendas: form.viviendas === '' ? null : Number(form.viviendas),
        riesgo: form.riesgo || null,
      };

      if (isEdit) {
        await base44.entities.Proyecto.update(proyecto.id, payload);
        await logAudit({
          tenant_id: proyecto.tenant_id || coop.tenant_id,
          accion: 'proyecto_actualizado',
          entidad_tipo: 'Proyecto',
          entidad_id: proyecto.id,
          valores_anteriores: {
            codigo: proyecto.codigo,
            nombre: proyecto.nombre,
            estado: proyecto.estado,
          },
          valores_nuevos: payload,
        });
        toast({ title: t('prom.updated') });
      } else {
        payload.tenant_id = coop.tenant_id;
        payload.cooperativa_id = cooperativaId;
        const res = await base44.entities.Proyecto.create(payload);
        await logAudit({
          tenant_id: coop.tenant_id,
          accion: 'proyecto_creado',
          entidad_tipo: 'Proyecto',
          entidad_id: res?.id || null,
          valores_nuevos: payload,
        });
        toast({ title: t('prom.created') });
      }
      qc.invalidateQueries({ queryKey: ['proyectos'] });
      onClose();
    } catch (e) {
      toast({
        title: isEdit ? t('prom.updateFailed') : t('prom.createFailed'),
        description: String(e?.message || e),
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  const field = (key, label, type = 'text') => (
    <div key={key}>
      <Label className="mb-1">{label}</Label>
      <Input
        type={type}
        value={form[key] ?? ''}
        onChange={(e) => set(key, e.target.value)}
        className="bg-slate-50"
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('prom.editTitle') : t('prom.newTitle')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('users.cooperative')}</Label>
            <Select
              value={cooperativaId || undefined}
              onValueChange={setCooperativaId}
              disabled={isEdit}
            >
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 disabled:opacity-60">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {cooperativas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field('codigo', t('prom.col.code'))}
          {field('nombre', t('prom.col.project'))}
          <div>
            <Label className="mb-1">{t('prom.col.phase')}</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FASES.map((f) => (
                  <SelectItem key={f} value={f}>{st(f)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1">{t('common.risk')}</Label>
            <Select value={form.riesgo || '__none'} onValueChange={(v) => set('riesgo', v === '__none' ? '' : v)}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {RIESGOS.filter(Boolean).map((r) => (
                  <SelectItem key={r} value={r}>{st(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field('municipio', t('prom.col.municipality'))}
          {field('provincia', t('prom.f.province'))}
          {field('direccion', t('prom.f.address'))}
          {field('referencia_catastral', t('prom.f.cadastral'))}
          {field('responsable', t('prom.f.responsible'))}
          {field('viviendas', t('prom.f.units'), 'number')}
          {field('presupuesto_total', t('prom.col.budget'), 'number')}
          {field('inicio_previsto', t('prom.f.start'), 'date')}
          {field('fin_previsto', t('prom.f.end'), 'date')}
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('prom.f.summary')}</Label>
            <Textarea
              value={form.resumen || ''}
              onChange={(e) => set('resumen', e.target.value)}
              rows={3}
              className="bg-slate-50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={saving} className="bg-[#102A43] hover:bg-[#173F5F]">
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

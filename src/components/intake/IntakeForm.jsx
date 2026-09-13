import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { uploadPrivateFile } from '@/api/storage';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { logAudit } from '@/lib/audit';
import { notifyCooperative } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { BadgeCheck, CheckCircle2, Circle } from 'lucide-react';

const DECLARACIONES = ['e1', 'e2', 'e3'];

export default function IntakeForm() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: coops = [] } = useQuery({ queryKey: ['cooperativas'], queryFn: () => base44.entities.Cooperativa.list() });
  const openCoops = coops.filter(c => c.estado === 'activa' || c.estado === 'pre_formacion');

  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ cooperativa_id: '', nombre_completo: '', dni_nie: '', email: user?.email || '', telefono: '', direccion: '' });
  const [decl, setDecl] = useState({ e1: false, e2: false, e3: false });
  const [files, setFiles] = useState({ dni: null, ingresos: null });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (done) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"><BadgeCheck className="h-6 w-6" /></div>
        <h2 className="mt-4 font-semibold text-[#102A43]">{t('intake.successTitle')}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{t('intake.success')}</p>
      </div>
    );
  }

  const step1Ok = Boolean(form.cooperativa_id && form.nombre_completo && form.dni_nie && form.email);
  const step2Ok = DECLARACIONES.every(k => decl[k]);

  const next = () => {
    if (step === 1 && !step1Ok) return toast({ title: t('intake.required'), variant: 'destructive' });
    if (step === 2 && !step2Ok) return toast({ title: t('intake.eligibilityRequired'), variant: 'destructive' });
    setStep(step + 1);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const coop = openCoops.find(c => c.id === form.cooperativa_id);
      if (!coop) throw new Error(t('sup.noCoop'));
      const socio = await base44.entities.Socio.create({
        tenant_id: coop.tenant_id,
        cooperativa_id: coop.id,
        nombre_completo: form.nombre_completo,
        dni_nie: form.dni_nie,
        email: form.email,
        telefono: form.telefono || null,
        direccion: form.direccion || null,
        estado: 'candidato'
      });
      const uploads = [['dni_nie', files.dni], ['justificante_ingresos', files.ingresos]];
      for (const [tipo, file] of uploads) {
        if (!file) continue;
        const { file_uri } = await uploadPrivateFile({ file, tenant_id: coop.tenant_id, socio_id: socio.id });
        await base44.entities.DocumentoSocio.create({
          tenant_id: coop.tenant_id,
          cooperativa_id: coop.id,
          socio_id: socio.id,
          tipo,
          nombre: file.name,
          file_uri,
          subido_por_email: user?.email || form.email,
          estado: 'subido'
        });
      }
      await logAudit({
        tenant_id: coop.tenant_id,
        accion: 'solicitud_admision_creada',
        entidad_tipo: 'Socio',
        entidad_id: socio.id,
        valores_nuevos: { nombre_completo: form.nombre_completo, dni_nie: form.dni_nie, email: form.email, estado: 'candidato' }
      });
      await notifyCooperative({
        tenant_id: coop.tenant_id,
        tipo: 'admision',
        titulo: t('intake.notifyTitle'),
        descripcion: `${form.nombre_completo} ${t('intake.notifyBody')}`,
        prioridad: 'media'
      });
      qc.invalidateQueries({ queryKey: ['portal-socio'] });
      setDone(true);
    } catch (e) {
      toast({ title: t('intake.error'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  const steps = [t('intake.step1'), t('intake.step2'), t('intake.step3')];

  return (
    <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${step > i ? 'bg-[#102A43] text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
            <span className={`text-sm font-medium ${step > i ? 'text-[#102A43]' : 'text-slate-400'}`}>{label}</span>
            {i < 2 && <div className="mx-2 h-px w-8 bg-slate-200" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1">{t('intake.selectCoop')}</Label>
            <select value={form.cooperativa_id} onChange={e => set('cooperativa_id', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              <option value="">—</option>
              {openCoops.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div><Label className="mb-1">{t('intake.fullName')}</Label><Input value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)} className="bg-slate-50" /></div>
          <div><Label className="mb-1">{t('intake.dni')}</Label><Input value={form.dni_nie} onChange={e => set('dni_nie', e.target.value)} className="bg-slate-50" /></div>
          <div><Label className="mb-1">{t('users.email')}</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="bg-slate-50" /></div>
          <div><Label className="mb-1">{t('coop.f.phone')}</Label><Input value={form.telefono} onChange={e => set('telefono', e.target.value)} className="bg-slate-50" /></div>
          <div className="sm:col-span-2"><Label className="mb-1">{t('coop.f.address')}</Label><Input value={form.direccion} onChange={e => set('direccion', e.target.value)} className="bg-slate-50" /></div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="font-semibold text-[#102A43]">{t('intake.eligibilityTitle')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('intake.eligibilityDesc')}</p>
          <div className="mt-4 space-y-3">
            {DECLARACIONES.map(k => (
              <button key={k} type="button" onClick={() => setDecl(p => ({ ...p, [k]: !p[k] }))} className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left text-sm hover:bg-slate-50">
                {decl[k] ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />}
                <span>{t(`intake.${k}`)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm text-slate-500 sm:col-span-2">{t('intake.docsDesc')}</p>
          <div>
            <Label className="mb-1">{t('intake.docDni')}</Label>
            <Input type="file" onChange={e => setFiles(p => ({ ...p, dni: e.target.files?.[0] || null }))} className="bg-slate-50" />
            {files.dni && <p className="mt-1 text-xs text-teal-700">{files.dni.name}</p>}
          </div>
          <div>
            <Label className="mb-1">{t('intake.docIncome')}</Label>
            <Input type="file" onChange={e => setFiles(p => ({ ...p, ingresos: e.target.files?.[0] || null }))} className="bg-slate-50" />
            {files.ingresos && <p className="mt-1 text-xs text-teal-700">{files.ingresos.name}</p>}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        {step > 1 ? <Button variant="outline" onClick={() => setStep(step - 1)}>{t('intake.back')}</Button> : <span />}
        {step < 3
          ? <Button className="bg-[#102A43] hover:bg-[#173F5F]" onClick={next}>{t('intake.next')}</Button>
          : <Button className="bg-[#102A43] hover:bg-[#173F5F]" disabled={saving} onClick={submit}>{saving ? t('intake.submitting') : t('intake.submit')}</Button>}
      </div>
    </div>
  );
}
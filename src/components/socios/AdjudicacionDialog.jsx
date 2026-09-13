import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/audit';
import { useI18n } from '@/lib/i18n';

// Adjudicación de vivienda: crea el registro de adjudicación, marca la
// vivienda como adjudicada y la vincula al socio, todo con auditoría.
export default function AdjudicacionDialog({ socio, cooperativas, viviendas, proyectos, onClose }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [viviendaId, setViviendaId] = useState('');
  const [saving, setSaving] = useState(false);

  const coop = cooperativas.find(c => c.id === socio.cooperativa_id);
  const coopProyectoIds = proyectos.filter(p => p.cooperativa_id === socio.cooperativa_id).map(p => p.id);
  const disponibles = viviendas.filter(v => coopProyectoIds.includes(v.proyecto_id) && v.estado === 'disponible');

  const confirm = async () => {
    if (!viviendaId) return;
    setSaving(true);
    try {
      const vivienda = viviendas.find(v => v.id === viviendaId);
      await base44.entities.Adjudicacion.create({
        tenant_id: coop.tenant_id,
        cooperativa_id: socio.cooperativa_id,
        proyecto_id: vivienda.proyecto_id,
        socio_id: socio.id,
        vivienda_id: viviendaId,
        estado: 'activa',
        fecha_adjudicacion: new Date().toISOString().slice(0, 10),
        importe: vivienda.coste_estimado ?? null
      });
      await base44.entities.Vivienda.update(viviendaId, { socio_id: socio.id, estado: 'adjudicada' });
      await base44.entities.Socio.update(socio.id, { vivienda_id: viviendaId });
      await logAudit({
        tenant_id: coop.tenant_id,
        accion: 'adjudicacion_creada',
        entidad_tipo: 'Adjudicacion',
        entidad_id: socio.id,
        valores_nuevos: { socio_id: socio.id, vivienda_id: viviendaId, vivienda: vivienda.referencia, estado: 'activa' }
      });
      qc.invalidateQueries({ queryKey: ['socios'] });
      qc.invalidateQueries({ queryKey: ['viviendas'] });
      toast({ title: t('soc.allocated') });
      onClose();
    } catch (e) {
      toast({ title: t('soc.allocateFailed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('soc.allocationTitle')} · {socio.nombre_completo}</DialogTitle></DialogHeader>
        <div>
          <Label className="mb-1">{t('soc.selectHousing')}</Label>
          {disponibles.length ? (
            <select value={viviendaId} onChange={e => setViviendaId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
              <option value="">—</option>
              {disponibles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.referencia}{v.tipologia ? ` · ${v.tipologia}` : ''}{v.metros_cuadrados ? ` · ${v.metros_cuadrados} m²` : ''}
                </option>
              ))}
            </select>
          ) : <p className="text-sm text-slate-500">{t('soc.noHomes')}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={confirm} disabled={saving || !viviendaId} className="bg-[#102A43] hover:bg-[#173F5F]">{saving ? t('common.saving') : t('soc.allocate')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
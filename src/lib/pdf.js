// Plantilla PDF compartida de Urbalex: cabecera corporativa (azul marino con
// filo teal), pie con fecha DD/MM/AAAA y paginación, importes en euros.
// Generación íntegra en cliente con jsPDF — sin llamadas de red.

import { jsPDF } from 'jspdf';
import { formatEur, formatDate } from '@/lib/format';
import { effectiveEstado, importePendiente } from '@/lib/finance';

const NAVY = [16, 42, 67];
const TEAL = [15, 118, 110];
const SLATE = [100, 116, 139];
const LIGHT = [244, 247, 249];
const MARGIN = 14;
const PAGE_W = 210;
const BOTTOM = 282;

const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');

function newDoc(title, subtitle) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(String(title).slice(0, 58), MARGIN, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(String(subtitle || '').slice(0, 92), MARGIN, 19);
  doc.setFillColor(...TEAL);
  doc.rect(0, 26, PAGE_W, 1.2, 'F');
  return doc;
}

function footers(doc) {
  const pages = doc.getNumberOfPages();
  const fecha = formatDate(new Date().toISOString());
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(`Urbalex ERP · ${fecha}`, MARGIN, 291);
    doc.text(`${i} / ${pages}`, PAGE_W - MARGIN, 291, { align: 'right' });
  }
}

function heading(doc, y, text) {
  if (y > BOTTOM) { doc.addPage(); y = 24; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(String(text), MARGIN, y);
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, y + 1.5, PAGE_W - MARGIN, y + 1.5);
  return y + 6;
}

function infoGrid(doc, y, pairs) {
  doc.setFontSize(9);
  pairs.forEach(([label, value], i) => {
    const col = i % 2;
    const x = MARGIN + col * 92;
    const rowY = y + Math.floor(i / 2) * 10;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE);
    doc.text(String(label).toUpperCase(), x, rowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(String(value ?? '—').slice(0, 48), x, rowY + 4.5);
  });
  return y + Math.ceil(pairs.length / 2) * 10 + 6;
}

// Tabla simple con cabecera sombreada, salto de página y líneas de separación.
function table(doc, y, cols, rows) {
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  const rowH = 6.5;
  const drawHeader = (y2) => {
    doc.setFillColor(...LIGHT);
    doc.rect(MARGIN, y2, totalW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    let x = MARGIN + 2;
    cols.forEach(c => {
      if (c.align === 'right') doc.text(String(c.label), x + c.width - 4, y2 + 4.3, { align: 'right' });
      else doc.text(String(c.label), x, y2 + 4.3);
      x += c.width;
    });
    return y2 + rowH;
  };
  y = drawHeader(y);
  const drawRows = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
  };
  drawRows();
  rows.forEach(r => {
    if (y + rowH > BOTTOM) { doc.addPage(); y = drawHeader(20); drawRows(); }
    let x = MARGIN + 2;
    cols.forEach((c, i) => {
      const v = String(r[i] ?? '—').slice(0, Math.floor(c.width * 2));
      if (c.align === 'right') doc.text(v, x + c.width - 4, y + 4.3, { align: 'right' });
      else doc.text(v, x, y + 4.3);
      x += c.width;
    });
    doc.setDrawColor(241, 245, 249);
    doc.line(MARGIN, y + rowH, MARGIN + totalW, y + rowH);
    y += rowH;
  });
  return y + 6;
}

// Ficha completa de un contrato con su histórico de modificaciones.
export function exportContratoPdf({ contrato, cooperativa, proyecto, modificaciones = [], t, st }) {
  const doc = newDoc(t('pdf.contractTitle'), `${contrato.codigo} · ${cooperativa?.nombre || ''}`);
  let y = 38;
  y = infoGrid(doc, y, [
    [t('common.status'), st(contrato.estado)],
    [t('con.f.code'), contrato.codigo],
    [t('con.f.counterpart'), contrato.contraparte],
    [t('con.f.category'), contrato.categoria],
    [t('users.cooperative'), cooperativa?.nombre],
    [t('common.project'), proyecto?.nombre],
    [t('urba.col.responsible'), contrato.responsable],
    [t('con.f.total'), formatEur(contrato.importe_total, true)],
    [t('con.f.expiry'), formatDate(contrato.fecha_vencimiento)],
    [t('common.risk'), contrato.riesgo ? st(contrato.riesgo) : '—'],
    [t('con.f.paymentTerms'), contrato.terminos_pago],
    [t('con.f.guarantee'), contrato.garantia_requerida ? 'Sí' : 'No']
  ]);
  y += 4;
  y = heading(doc, y, t('con.amendments'));
  if (modificaciones.length) {
    y = table(doc, y, [
      { label: t('con.am.f.motivo'), width: 62 },
      { label: t('leg.col.date'), width: 28 },
      { label: t('con.f.total'), width: 50 },
      { label: t('common.status'), width: 42 }
    ], modificaciones.map(m => [
      m.motivo,
      formatDate(m.fecha_solicitud),
      m.importe_total_nuevo != null ? `${formatEur(m.importe_total_anterior, true)} / ${formatEur(m.importe_total_nuevo, true)}` : '—',
      st(m.estado)
    ]));
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...SLATE);
    doc.text(t('common.empty'), MARGIN, y);
  }
  footers(doc);
  doc.save(`Contrato_${slug(contrato.codigo)}.pdf`);
}

// Estado de cuenta de un socio: datos de membresía, detalle de aportaciones
// y totales. Pensado para compartirlo directamente con el miembro.
export function exportEstadoSocioPdf({ socio, cooperativa, aportaciones = [], t, st }) {
  const doc = newDoc(t('pdf.statementTitle'), `${socio.nombre_completo} · ${cooperativa?.nombre || ''}`);
  let y = 38;
  y = infoGrid(doc, y, [
    [t('common.status'), st(socio.estado)],
    [t('intake.dni'), socio.dni_nie],
    [t('users.email'), socio.email],
    [t('coop.f.phone'), socio.telefono],
    [t('portal.memberSince'), formatDate(socio.fecha_admision)],
    [t('coop.f.address'), socio.direccion]
  ]);
  y += 2;
  y = heading(doc, y, t('soc.contributions'));
  const rows = [...aportaciones].sort((a, b) => String(a.fecha_vencimiento || '').localeCompare(String(b.fecha_vencimiento || '')));
  y = table(doc, y, [
    { label: t('fin.col.expiry'), width: 26 },
    { label: t('fin.col.reference'), width: 32 },
    { label: t('fin.col.type'), width: 30 },
    { label: t('fin.col.amount'), width: 34, align: 'right' },
    { label: t('fin.col.paid'), width: 34, align: 'right' },
    { label: t('common.status'), width: 26 }
  ], rows.map(a => [
    formatDate(a.fecha_vencimiento),
    a.referencia || '—',
    st(a.tipo),
    formatEur(a.importe_debido, true),
    formatEur(a.importe_pagado, true),
    st(effectiveEstado(a))
  ]));
  if (y > BOTTOM - 10) { doc.addPage(); y = 24; }
  const debido = rows.reduce((s, a) => s + (a.importe_debido || 0), 0);
  const pagado = rows.reduce((s, a) => s + (a.importe_pagado || 0), 0);
  const pendiente = rows.reduce((s, a) => s + (a.estado !== 'cancelada' ? importePendiente(a) : 0), 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(`${t('portal.due')}: ${formatEur(debido, true)}    ${t('portal.paid')}: ${formatEur(pagado, true)}    ${t('portal.pending')}: ${formatEur(pendiente, true)}`, MARGIN, y);
  footers(doc);
  doc.save(`EstadoCuenta_${slug(socio.nombre_completo)}.pdf`);
}

// Informe ejecutivo: pipeline de promociones, situación financiera por
// cooperativa y distribución de contratos e incidencias por estado.
export function exportInformePdf({ cooperativas, proyectos, contratos, incidencias, aportaciones, t, st }) {
  const doc = newDoc(t('pdf.reportTitle'), formatDate(new Date().toISOString()));
  let y = 36;
  const counts = (list) => {
    const m = new Map();
    list.forEach(r => { const k = r.estado || '—'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()];
  };
  y = heading(doc, y, t('inf.projects'));
  y = table(doc, y, [
    { label: t('common.status'), width: 140 },
    { label: '#', width: 42, align: 'right' }
  ], counts(proyectos).map(([k, v]) => [st(k), String(v)]));
  y = heading(doc, y, t('inf.finance'));
  y = table(doc, y, [
    { label: t('nav.cooperativas'), width: 62 },
    { label: t('fin.stats.due'), width: 40, align: 'right' },
    { label: t('inf.collected'), width: 40, align: 'right' },
    { label: t('inf.pending'), width: 40, align: 'right' }
  ], cooperativas.map(c => {
    const rows = aportaciones.filter(a => a.cooperativa_id === c.id && a.estado !== 'cancelada');
    return [
      c.nombre,
      formatEur(rows.reduce((s, a) => s + (a.importe_debido || 0), 0), true),
      formatEur(rows.reduce((s, a) => s + (a.importe_pagado || 0), 0), true),
      formatEur(rows.reduce((s, a) => s + importePendiente(a), 0), true)
    ];
  }));
  y = heading(doc, y, t('inf.contracts'));
  y = table(doc, y, [
    { label: t('common.status'), width: 140 },
    { label: '#', width: 42, align: 'right' }
  ], counts(contratos).map(([k, v]) => [st(k), String(v)]));
  y = heading(doc, y, t('inf.incidences'));
  y = table(doc, y, [
    { label: t('common.status'), width: 140 },
    { label: '#', width: 42, align: 'right' }
  ], counts(incidencias).map(([k, v]) => [st(k), String(v)]));
  footers(doc);
  doc.save(`Informe_${new Date().toISOString().slice(0, 10)}.pdf`);
}
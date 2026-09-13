// Shared finance rules for aportaciones: derived status and payment transitions.
// Aportaciones never get deleted; their status is always recomputed from the
// amounts and the due date.

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const isOverdue = (a) => Boolean(a?.fecha_vencimiento) && new Date(a.fecha_vencimiento) < startOfToday();

// Estado efectivo mostrado al usuario: derivado de importes y vencimiento,
// incluso si el registro sigue marcado como "pendiente" por defecto.
export const effectiveEstado = (a) => {
  if (!a) return 'pendiente';
  if (a.estado === 'cancelada') return 'cancelada';
  const pendiente = (a.importe_debido || 0) - (a.importe_pagado || 0);
  if (pendiente <= 0.001) return 'pagada';
  if (isOverdue(a)) return 'vencida';
  return (a.importe_pagado || 0) > 0 ? 'parcial' : 'pendiente';
};

// Estado resultante tras registrar un pago del importe indicado.
export const estadoAfterPayment = (a, nuevoPagado) => {
  const pendiente = (a.importe_debido || 0) - nuevoPagado;
  if (pendiente <= 0.001) return 'pagada';
  return isOverdue(a) ? 'vencida' : 'parcial';
};

export const importePendiente = (a) => Math.max(0, (a.importe_debido || 0) - (a.importe_pagado || 0));
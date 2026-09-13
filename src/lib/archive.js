/** Shared Active / Archived filtering for working queues. */

export function filterByArchiveTab(rows, tab, isArchivedFn) {
  const list = Array.isArray(rows) ? rows : [];
  if (tab === 'archived') return list.filter(isArchivedFn);
  return list.filter((r) => !isArchivedFn(r));
}

export function archiveCounts(rows, isArchivedFn) {
  const list = Array.isArray(rows) ? rows : [];
  let active = 0;
  let archived = 0;
  for (const r of list) {
    if (isArchivedFn(r)) archived += 1;
    else active += 1;
  }
  return { active, archived };
}

/** Communications / alertas: explicit archivado status */
export const isAlertaArchived = (a) => a?.estado === 'archivado';

/** Support + Maintenance: cerrada is the archive bucket */
export const isCerradaArchived = (r) => r?.estado === 'cerrada';

/** Member documents: verified/rejected leave the working queue */
export const isDocumentoSocioArchived = (d) =>
  d?.estado === 'verificado' || d?.estado === 'rechazado';

/** Legal documents: archivado or caducado */
export const isDocumentoLegalArchived = (d) =>
  d?.estado === 'archivado' || d?.estado === 'caducado';

/** Suppliers: suspended leave the live roster */
export const isProveedorArchived = (p) => p?.estado === 'suspendido';

/** Tenders: awarded or cancelled */
export const isLicitacionArchived = (l) =>
  l?.estado === 'adjudicada' || l?.estado === 'cancelada';

/** Contracts: closed / archived / terminal */
export const isContratoArchived = (c) =>
  ['cerrado', 'archivado', 'vencido', 'resuelto'].includes(c?.estado);

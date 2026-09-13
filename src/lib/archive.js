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

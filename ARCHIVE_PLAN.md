# Archivar — implementation status

## Done

### Wave 1 / Phase 0+1 (`411e614`)
- Shared `ArchiveTabs` + `src/lib/archive.js`
- Communications, Secretariat inbox, Support, Maintenance
- SQL: `supabase/archive_wave1_patch.sql` (alertas.`archivado`)

### Wave 2 / Phase 2 (`9a030f7`)
- Member documents + Legal documents (Documents tab + Jurídico)

### Wave 3 / Phase 3
- **Suppliers**: Active = candidato/homologado; Archived = suspendido (Archivar/Reactivar)
- **Tenders**: Active = abierta/en_evaluacion; Archived = adjudicada/cancelada (cancel = archive; restore cancelada → abierta)
- **Contracts**: Active = pipeline + suspendido; Archived = cerrado/archivado/vencido/resuelto (Archivar → archivado; Reactivar → activo)

## Next
- Phase 4 (optional): Developments / Urbanismo

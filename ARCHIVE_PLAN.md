# Archivar — implementation status

## Done

### Wave 1 / Phase 0+1 (`411e614`)
- Shared `ArchiveTabs` + `src/lib/archive.js`
- **Communications** (`alertas`): Active / Archived; status `archivado`; Restore → `en_gestion`
- **Secretariat inbox** (`consultas`): Active = not `cerrada`; Archive → `cerrada`; Restore → `en_gestion`
- **Support** (member view): same Active/Archived split on own inquiries
- **Maintenance** (`incidencias`): Active / Archived via `cerrada`
- SQL: `supabase/archive_wave1_patch.sql`

### Wave 2 / Phase 2 (Documents)
- **Member documents**: Active = `solicitado` + `subido`; Archived = `verificado` + `rechazado`
  - Staff can **Reactivar** rejected → `solicitado` (re-request upload)
  - Members can **Upload again** on rejected
- **Legal documents** (Documents tab + Jurídico page): Active = `activo`; Archived = `archivado` / `caducado`
  - Archivar → `archivado`; Reactivar → `activo`
- No new SQL (statuses already existed)

## Next
- Phase 3: Suppliers, Tenders, Contracts
- Phase 4: Developments / Urbanismo (optional)

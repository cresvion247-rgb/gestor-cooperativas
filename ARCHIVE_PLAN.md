# Archivar — implementation status

## Done (Wave 1 / Phase 0+1)
- Shared `ArchiveTabs` + `src/lib/archive.js`
- **Communications** (`alertas`): Active / Archived; status `archivado`; Restore → `en_gestion`
- **Secretariat inbox** (`consultas`): Active = not `cerrada`; Archive → `cerrada`; Restore → `en_gestion`
- **Support** (member view): same Active/Archived split on own inquiries
- **Maintenance** (`incidencias`): Active / Archived via `cerrada`

SQL: run `supabase/archive_wave1_patch.sql` once (adds `archivado` on `alertas`).

## Next waves
- Phase 2: Member + Legal documents
- Phase 3: Suppliers, Tenders, Contracts
- Phase 4: Developments / Urbanismo (optional)

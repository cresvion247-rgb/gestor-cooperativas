# Archivar — implementation status

## Done (all planned waves)

### Wave 1 — Phase 0+1 (`411e614`)
Communications, Secretariat inbox, Support, Maintenance  
SQL: `supabase/archive_wave1_patch.sql`

### Wave 2 — Phase 2 (`9a030f7`)
Member documents + Legal documents

### Wave 3 — Phase 3 (`3618bb7`)
Suppliers, Tenders, Contracts

### Wave 4 — Phase 4
- **Developments (Promociones)**: Active = all phases except `cerrado`; Archivar → `cerrado`; Reactivar → `garantia`
- **Construction**: same project archive split (cards)
- **Urbanismo**: Active working files; Archivar → `cerrado`; Reactivar → `en_tramite`; Archived also includes resuelto/denegado/archivado/caducado/favorable

## Notes
- No hard deletes; audit on archive/reactivate
- Shared UI: `ArchiveTabs` + `src/lib/archive.js`

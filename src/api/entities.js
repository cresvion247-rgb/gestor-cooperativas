/**
 * Public export of Supabase-backed entity APIs.
 * Pages still import `{ base44 }` from `@/api/base44Client` (compat object, not the SDK)
 * and call `base44.entities.*`. New code may import `entities` from here directly.
 */
export {
  createSupabaseEntities,
  createEntityApi,
  ENTITY_REGISTRY,
  mapSortKey,
  toUiRow,
  toDbPayload,
  applyFilters,
} from './entityFacade';

import { createSupabaseEntities } from './entityFacade';

/** Singleton entities map (same object on the `base44` compat client). */
export const entities = createSupabaseEntities();

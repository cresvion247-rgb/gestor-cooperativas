import { entities } from './entities';

/**
 * Compatibility object — NOT @base44/sdk.
 * Pages keep `import { base44 } from '@/api/base44Client'` and call
 * `base44.entities.*`. The live path is the Supabase façade in entities.js.
 * Do not reintroduce Core.Upload*, functions.invoke, or agents.* here.
 */
export const base44 = { entities };

/**
 * Phase 3 — Base44 entities → Supabase PostgREST façade.
 *
 * Pages keep calling base44.entities.X.list/filter/get/create/update/delete
 * with UI field names (created_date, updated_date). This module:
 *  - maps EntityName → public table
 *  - translates sort keys (-created_date → order created_at desc)
 *  - translates filter objects to .eq / .in / .or / .neq / …
 *  - aliases created_at/updated_at ↔ created_date/updated_date on the boundary
 *  - respects delete:false as soft-delete (status patch or refused hard delete)
 *
 * Auth, uploads, and notify stay on Supabase (Phases 2–4). No @base44/sdk at runtime.
 */

import { supabase } from './supabaseClient';

/** Base44 UI system fields → Postgres columns */
const TO_DB = {
  created_date: 'created_at',
  updated_date: 'updated_at',
};

const FROM_DB = {
  created_at: 'created_date',
  updated_at: 'updated_date',
};

/**
 * Entity registry — order by call-site frequency (Phase 0/3 discovery), then rest.
 * softDelete: Base44 delete:false — UI never hard-deletes; delete() refuses or patches.
 */
export const ENTITY_REGISTRY = {
  Cooperativa: { table: 'cooperativas', softDelete: false },
  Proyecto: { table: 'proyectos', softDelete: false },
  Socio: { table: 'socios', softDelete: false },
  Aportacion: { table: 'aportaciones', softDelete: true },
  Contrato: { table: 'contratos', softDelete: true },
  Alerta: { table: 'alertas', softDelete: false },
  Vivienda: { table: 'viviendas', softDelete: false },
  DocumentoSocio: { table: 'documentos_socio', softDelete: true },
  DocumentoLegal: { table: 'documentos_legales', softDelete: true },
  Adjudicacion: { table: 'adjudicaciones', softDelete: true },
  ContratoModificacion: { table: 'contrato_modificaciones', softDelete: true },
  Proveedor: { table: 'proveedores', softDelete: true },
  Consulta: { table: 'consultas', softDelete: false },
  Incidencia: { table: 'incidencias', softDelete: false },
  Licitacion: { table: 'licitaciones', softDelete: true },
  AuditLog: {
    table: 'audit_logs',
    softDelete: true,
    // audit_logs has no updated_at; valores_* are jsonb (Base44 sent JSON strings)
    transformWrite: auditWriteTransform,
    transformRead: auditReadTransform,
  },
  ExpedienteUrbanistico: { table: 'expedientes_urbanisticos', softDelete: true },
  Oferta: { table: 'ofertas', softDelete: true },
  User: {
    table: 'profiles',
    softDelete: true,
    softDeletePatch: { estado: 'inactivo' },
    transformRead: profileReadTransform,
  },
};

function auditWriteTransform(body) {
  const out = { ...body };
  for (const key of ['valores_anteriores', 'valores_nuevos']) {
    if (typeof out[key] === 'string') {
      try {
        out[key] = JSON.parse(out[key]);
      } catch {
        // keep string if not valid JSON — PostgREST may reject; prefer object
      }
    }
  }
  // Do not send created_at aliases; fecha is the audit timestamp column
  delete out.created_at;
  delete out.updated_at;
  return out;
}

function auditReadTransform(row) {
  return row;
}

function profileReadTransform(row) {
  // Match Base44 User shape used by UsersPanel / UserDialog
  if (!row) return row;
  return {
    ...row,
    // Base44 sometimes exposed full_name separately; keep as-is
  };
}

export function mapSortKey(sortKey) {
  if (!sortKey || typeof sortKey !== 'string') return null;
  const descending = sortKey.startsWith('-');
  const field = descending ? sortKey.slice(1) : sortKey;
  const column = TO_DB[field] || field;
  return { column, ascending: !descending };
}

export function toUiRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const [dbKey, uiKey] of Object.entries(FROM_DB)) {
    if (dbKey in out && out[uiKey] === undefined) {
      out[uiKey] = out[dbKey];
    }
  }
  return out;
}

export function toDbPayload(data, { forUpdate = false } = {}) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue;
    // Let DB / triggers own timestamps
    if (key === 'created_date' || key === 'created_at') continue;
    if (key === 'updated_date' || key === 'updated_at') continue;
    const dbKey = TO_DB[key] || key;
    out[dbKey] = value;
  }
  void forUpdate;
  return out;
}

/**
 * Apply Base44-style query object to a Supabase query builder.
 * Supports: plain eq, arrays → .in, {$in}, {$ne}, {$gt}, {$gte}, {$lt}, {$lte},
 * and top-level $or: [{ field: value }, …].
 */
export function applyFilters(query, filterObj) {
  if (!filterObj || typeof filterObj !== 'object') return query;
  let q = query;

  if (Array.isArray(filterObj.$or) && filterObj.$or.length) {
    const parts = [];
    for (const clause of filterObj.$or) {
      if (!clause || typeof clause !== 'object') continue;
      for (const [k, v] of Object.entries(clause)) {
        const col = TO_DB[k] || k;
        if (v === null) parts.push(`${col}.is.null`);
        else parts.push(`${col}.eq.${formatOrValue(v)}`);
      }
    }
    if (parts.length) q = q.or(parts.join(','));
  }

  for (const [key, value] of Object.entries(filterObj)) {
    if (key === '$or') continue;
    const col = TO_DB[key] || key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if ('$in' in value) q = q.in(col, value.$in);
      else if ('$ne' in value) q = q.neq(col, value.$ne);
      else if ('$gt' in value) q = q.gt(col, value.$gt);
      else if ('$gte' in value) q = q.gte(col, value.$gte);
      else if ('$lt' in value) q = q.lt(col, value.$lt);
      else if ('$lte' in value) q = q.lte(col, value.$lte);
      else if ('$ilike' in value) q = q.ilike(col, value.$ilike);
      continue;
    }

    if (Array.isArray(value)) {
      q = q.in(col, value);
      continue;
    }

    if (value === null) {
      q = q.is(col, null);
      continue;
    }

    q = q.eq(col, value);
  }

  return q;
}

function formatOrValue(v) {
  if (typeof v === 'string') {
    // Escape commas / reserved for PostgREST or() filter
    return `"${String(v).replace(/"/g, '\\"')}"`;
  }
  return String(v);
}

function throwIfError(error) {
  if (error) {
    const err = new Error(error.message || String(error));
    err.code = error.code;
    err.details = error.details;
    err.hint = error.hint;
    throw err;
  }
}

/**
 * Create one entity API matching Base44 SDK shape:
 *   list(sort?, limit?)
 *   filter(query, sort?, limit?)
 *   get(id)
 *   create(data)
 *   update(id, data)
 *   delete(id)
 */
export function createEntityApi(config) {
  const {
    table,
    softDelete = false,
    softDeletePatch = null,
    transformWrite = null,
    transformRead = null,
  } = config;

  const mapOut = (row) => {
    if (!row) return row;
    const r = transformRead ? transformRead(row) : row;
    return toUiRow(r);
  };

  const mapMany = (rows) => (rows || []).map(mapOut);

  function normalizeListArgs(sortOrLimit, maybeLimit) {
    // list() | list(500) | list('-created_date') | list('-created_date', 500)
    let sortKey = null;
    let limit = null;
    if (typeof sortOrLimit === 'number') {
      limit = sortOrLimit;
    } else if (typeof sortOrLimit === 'string') {
      sortKey = sortOrLimit;
      if (typeof maybeLimit === 'number') limit = maybeLimit;
    }
    return { sortKey, limit };
  }

  return {
    async list(sortOrLimit, maybeLimit) {
      const { sortKey, limit } = normalizeListArgs(sortOrLimit, maybeLimit);
      let q = supabase.from(table).select('*');
      const sort = mapSortKey(sortKey);
      if (sort) q = q.order(sort.column, { ascending: sort.ascending });
      if (limit != null) q = q.limit(limit);
      const { data, error } = await q;
      throwIfError(error);
      return mapMany(data);
    },

    async filter(queryObj = {}, sortOrLimit, maybeLimit) {
      const { sortKey, limit } = normalizeListArgs(sortOrLimit, maybeLimit);
      let q = supabase.from(table).select('*');
      q = applyFilters(q, queryObj);
      const sort = mapSortKey(sortKey);
      if (sort) q = q.order(sort.column, { ascending: sort.ascending });
      if (limit != null) q = q.limit(limit);
      const { data, error } = await q;
      throwIfError(error);
      return mapMany(data);
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      throwIfError(error);
      return mapOut(data);
    },

    async create(payload) {
      let body = toDbPayload(payload);
      if (transformWrite) body = transformWrite(body, 'create');
      const { data, error } = await supabase.from(table).insert(body).select('*').single();
      throwIfError(error);
      return mapOut(data);
    },

    async update(id, payload) {
      let body = toDbPayload(payload, { forUpdate: true });
      if (transformWrite) body = transformWrite(body, 'update');
      const { data, error } = await supabase
        .from(table)
        .update(body)
        .eq('id', id)
        .select('*')
        .single();
      throwIfError(error);
      return mapOut(data);
    },

    async delete(id) {
      if (softDelete) {
        if (softDeletePatch) {
          return this.update(id, softDeletePatch);
        }
        const err = new Error(
          `Hard delete is disabled for ${table} (Base44 delete:false). Use update/status instead.`
        );
        err.code = 'SOFT_DELETE_ONLY';
        throw err;
      }
      const { error } = await supabase.from(table).delete().eq('id', id);
      throwIfError(error);
      return { id };
    },
  };
}

/**
 * Build the full entities map (same keys as base44.entities.*).
 * No entity.subscribe usage in this app (only agent subscribe — Phase 4).
 */
export function createSupabaseEntities() {
  const entities = {};
  for (const [name, config] of Object.entries(ENTITY_REGISTRY)) {
    entities[name] = createEntityApi(config);
  }
  return entities;
}

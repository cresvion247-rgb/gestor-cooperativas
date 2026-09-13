# Phase 1 Field Mapping — Base44 → Postgres

Source: `base44/entities/*.jsonc` + call sites.  
Schema: `supabase/schema.sql`.

System mapping (all domain entities):

| Base44 | Postgres | Type |
|--------|----------|------|
| `id` | `id` | `uuid` PK |
| `created_date` | `created_at` | `timestamptz` |
| `updated_date` | `updated_at` | `timestamptz` |

`tenant_id` remains **text** (business slug; includes `urbalex-central`). It is **not** a FK to `cooperativas.id`.  
`*_id` FKs reference parent **uuid** PKs unless noted.

---

## User → `public.profiles` (+ `auth.users`)

| Base44 User.field | Postgres | Type | Notes |
|-------------------|----------|------|-------|
| (auth identity) | `auth.users.id` / `profiles.id` | `uuid` | PK/FK `on delete cascade` |
| `email` | `profiles.email` | `text` | Also on `auth.users.email` |
| (display name if present in meta) | `profiles.full_name` | `text` | Optional; not in User.jsonc but reserved for display |
| `role` | `profiles.role` | `text` CHECK `admin`\|`user` | Platform Super Admin = `admin` |
| `app_role` | `profiles.app_role` | `text` CHECK (10 ERP roles) | Exact enum from User.jsonc |
| `tenant_id` | `profiles.tenant_id` | `text` | Home cooperativa slug |
| `assigned_cooperativa_ids` | `profiles.assigned_cooperativa_ids` | `text[]` | Stores cooperativa **tenant_id** slugs |
| `interface_language` | `profiles.interface_language` | `text` CHECK `es`\|`en`\|`eu`\|`fr` | |
| `estado` | `profiles.estado` | `text` CHECK `activo`\|`inactivo` | |
| `created_date` | `profiles.created_at` | `timestamptz` | |
| `updated_date` | `profiles.updated_at` | `timestamptz` | |

---

## Cooperativa → `cooperativas`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` UNIQUE |
| `nombre` | `nombre` | `text` |
| `cif` | `cif` | `text` UNIQUE |
| `forma_juridica` | `forma_juridica` | `text` |
| `estado` | `estado` | `text` CHECK `pre_formacion`\|`activa`\|`inactiva`\|`cerrada` |
| `direccion` | `direccion` | `text` |
| `municipio` | `municipio` | `text` |
| `provincia` | `provincia` | `text` |
| `codigo_postal` | `codigo_postal` | `text` |
| `email` | `email` | `text` |
| `telefono` | `telefono` | `text` |
| `fecha_constitucion` | `fecha_constitucion` | `date` |
| `administrador_urbalex` | `administrador_urbalex` | `text` |
| `notas` | `notas` | `text` |

---

## Proyecto → `proyectos`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `nombre` | `nombre` | `text` |
| `codigo` | `codigo` | `text` |
| `estado` | `estado` | `text` CHECK `viabilidad`…`cerrado` (9 values) |
| `direccion` | `direccion` | `text` |
| `municipio` | `municipio` | `text` |
| `provincia` | `provincia` | `text` |
| `referencia_catastral` | `referencia_catastral` | `text` |
| `responsable` | `responsable` | `text` |
| `inicio_previsto` | `inicio_previsto` | `date` |
| `fin_previsto` | `fin_previsto` | `date` |
| `fin_estimado` | `fin_estimado` | `date` |
| `viviendas` | `viviendas` | `integer` |
| `presupuesto_total` | `presupuesto_total` | `numeric` |
| `coste_comprometido` | `coste_comprometido` | `numeric` |
| `coste_real` | `coste_real` | `numeric` |
| `riesgo` | `riesgo` | `text` CHECK `bajo`\|`medio`\|`alto`\|`critico` |
| `progreso_previsto` | `progreso_previsto` | `numeric` |
| `progreso_real` | `progreso_real` | `numeric` |
| `resumen` | `resumen` | `text` |

---

## Socio → `socios`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `nombre_completo` | `nombre_completo` | `text` |
| `dni_nie` | `dni_nie` | `text` |
| `email` | `email` | `text` |
| `telefono` | `telefono` | `text` |
| `direccion` | `direccion` | `text` |
| `estado` | `estado` | `text` CHECK `candidato`\|`activo`\|`lista_espera`\|`baja`\|`completado` |
| `fecha_admision` | `fecha_admision` | `date` |
| `vivienda_id` | `vivienda_id` | `uuid` → `viviendas(id)` |
| `referencia_pago` | `referencia_pago` | `text` |
| `preferencia_comunicacion` | `preferencia_comunicacion` | `text` |

---

## Vivienda → `viviendas`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `proyecto_id` | `proyecto_id` | `uuid` → `proyectos(id)` |
| `referencia` | `referencia` | `text` |
| `bloque` | `bloque` | `text` |
| `planta` | `planta` | `text` |
| `puerta` | `puerta` | `text` |
| `tipologia` | `tipologia` | `text` |
| `dormitorios` | `dormitorios` | `integer` |
| `metros_cuadrados` | `metros_cuadrados` | `numeric` |
| `estado` | `estado` | `text` CHECK `disponible`\|`reservada`\|`adjudicada`\|`entregada` |
| `socio_id` | `socio_id` | `uuid` → `socios(id)` |
| `coste_estimado` | `coste_estimado` | `numeric` |
| `coste_final` | `coste_final` | `numeric` |

---

## Adjudicacion → `adjudicaciones`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `proyecto_id` | `proyecto_id` | `uuid` → `proyectos(id)` |
| `socio_id` | `socio_id` | `uuid` → `socios(id)` |
| `vivienda_id` | `vivienda_id` | `uuid` → `viviendas(id)` |
| `fecha_adjudicacion` | `fecha_adjudicacion` | `date` |
| `estado` | `estado` | `text` CHECK `activa`\|`entregada`\|`cancelada` |
| `importe` | `importe` | `numeric` |
| `notas` | `notas` | `text` |

---

## Aportacion → `aportaciones`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `proyecto_id` | `proyecto_id` | `uuid` → `proyectos(id)` |
| `socio_id` | `socio_id` | `uuid` → `socios(id)` |
| `tipo` | `tipo` | `text` CHECK `entrada`\|`periodica`\|`extraordinaria`\|`ajuste`\|`devolucion`\|`liquidacion_final` |
| `fecha_vencimiento` | `fecha_vencimiento` | `date` |
| `importe_debido` | `importe_debido` | `numeric` |
| `importe_pagado` | `importe_pagado` | `numeric` |
| `importe_pendiente` | `importe_pendiente` | `numeric` |
| `estado` | `estado` | `text` CHECK `pendiente`\|`parcial`\|`pagada`\|`vencida`\|`cancelada` |
| `referencia` | `referencia` | `text` |

---

## Proveedor → `proveedores`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `nombre` | `nombre` | `text` |
| `cif_nif` | `cif_nif` | `text` |
| `categoria` | `categoria` | `text` |
| `contacto_nombre` | `contacto_nombre` | `text` |
| `email` | `email` | `text` |
| `telefono` | `telefono` | `text` |
| `direccion` | `direccion` | `text` |
| `valoracion` | `valoracion` | `text` CHECK `excelente`\|`buena`\|`regular`\|`baja` |
| `estado` | `estado` | `text` CHECK `candidato`\|`homologado`\|`suspendido` |
| `fecha_homologacion` | `fecha_homologacion` | `date` |
| `notas` | `notas` | `text` |

---

## Licitacion → `licitaciones`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `proyecto_id` | `proyecto_id` | `uuid` → `proyectos(id)` |
| `titulo` | `titulo` | `text` |
| `categoria` | `categoria` | `text` |
| `referencia` | `referencia` | `text` |
| `estado` | `estado` | `text` CHECK `abierta`\|`en_evaluacion`\|`adjudicada`\|`cancelada` |
| `fecha_apertura` | `fecha_apertura` | `date` |
| `fecha_limite` | `fecha_limite` | `date` |
| `presupuesto_base` | `presupuesto_base` | `numeric` |
| `requisitos` | `requisitos` | `text` |
| `proveedor_adjudicado_id` | `proveedor_adjudicado_id` | `uuid` → `proveedores(id)` |
| `notas` | `notas` | `text` |

---

## Oferta → `ofertas`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `licitacion_id` | `licitacion_id` | `uuid` → `licitaciones(id)` |
| `proveedor_id` | `proveedor_id` | `uuid` → `proveedores(id)` |
| `importe` | `importe` | `numeric` |
| `plazo_ejecucion` | `plazo_ejecucion` | `text` |
| `puntuacion` | `puntuacion` | `numeric` |
| `observaciones` | `observaciones` | `text` |
| `estado` | `estado` | `text` CHECK `presentada`\|`favorable`\|`descartada` |
| `fecha_presentacion` | `fecha_presentacion` | `date` |

---

## Contrato → `contratos`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `proyecto_id` | `proyecto_id` | `uuid` → `proyectos(id)` |
| `codigo` | `codigo` | `text` |
| `titulo` | `titulo` | `text` |
| `titulo_traducido` | `titulo_traducido` | `text` |
| `categoria` | `categoria` | `text` |
| `contraparte` | `contraparte` | `text` |
| `estado` | `estado` | `text` CHECK (12 values from Contrato.jsonc) |
| `responsable` | `responsable` | `text` |
| `fecha_firma` | `fecha_firma` | `date` |
| `fecha_vencimiento` | `fecha_vencimiento` | `date` |
| `importe_base` | `importe_base` | `numeric` |
| `iva` | `iva` | `numeric` |
| `importe_total` | `importe_total` | `numeric` |
| `moneda` | `moneda` | `text` default `EUR` |
| `riesgo` | `riesgo` | `text` CHECK `bajo`\|`medio`\|`alto`\|`critico` |
| `terminos_pago` | `terminos_pago` | `text` |
| `garantia_requerida` | `garantia_requerida` | `boolean` |
| `exige_modificacion` | `exige_modificacion` | `boolean` |
| `procedencia` | `procedencia` | `text` | Licitación id (string); not FK |

---

## ContratoModificacion → `contrato_modificaciones`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `contrato_id` | `contrato_id` | `uuid` → `contratos(id)` |
| `motivo` | `motivo` | `text` |
| `descripcion` | `descripcion` | `text` |
| `importe_total_anterior` | `importe_total_anterior` | `numeric` |
| `importe_total_nuevo` | `importe_total_nuevo` | `numeric` |
| `fecha_vencimiento_anterior` | `fecha_vencimiento_anterior` | `date` |
| `fecha_vencimiento_nueva` | `fecha_vencimiento_nueva` | `date` |
| `terminos_pago_nuevos` | `terminos_pago_nuevos` | `text` |
| `estado` | `estado` | `text` CHECK `pendiente_aprobacion`\|`aprobado`\|`aplicado`\|`rechazado` |
| `fecha_solicitud` | `fecha_solicitud` | `date` |
| `fecha_aplicacion` | `fecha_aplicacion` | `date` |
| `solicitado_por` | `solicitado_por` | `text` |
| `notas` | `notas` | `text` |

---

## Incidencia → `incidencias`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `proyecto_id` | `proyecto_id` | `uuid` → `proyectos(id)` |
| `socio_id` | `socio_id` | `uuid` → `socios(id)` |
| `titulo` | `titulo` | `text` |
| `descripcion` | `descripcion` | `text` |
| `categoria` | `categoria` | `text` CHECK `estructura`\|`areas_comunes`\|`instalaciones`\|`acabados`\|`otra` |
| `prioridad` | `prioridad` | `text` CHECK `baja`\|`media`\|`alta`\|`critica` |
| `estado` | `estado` | `text` CHECK `abierta`\|`en_gestion`\|`resuelta`\|`cerrada` |
| `foto_url` | `foto_url` | `text` | Public Storage URL |
| `asignado_a` | `asignado_a` | `text` |
| `resolucion` | `resolucion` | `text` |
| `fecha_resolucion` | `fecha_resolucion` | `date` |

---

## Alerta → `alertas`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `tipo` | `tipo` | `text` |
| `titulo` | `titulo` | `text` |
| `titulo_traducido` | `titulo_traducido` | `text` |
| `descripcion` | `descripcion` | `text` |
| `descripcion_traducida` | `descripcion_traducida` | `text` |
| `prioridad` | `prioridad` | `text` CHECK `baja`\|`media`\|`alta`\|`critica` |
| `fecha_limite` | `fecha_limite` | `date` |
| `estado` | `estado` | `text` CHECK `abierta`\|`en_gestion`\|`resuelta` |
| `entidad_tipo` | `entidad_tipo` | `text` |
| `entidad_id` | `entidad_id` | `text` |

---

## Consulta → `consultas`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `socio_id` | `socio_id` | `uuid` → `socios(id)` |
| `solicitante_email` | `solicitante_email` | `text` |
| `categoria` | `categoria` | `text` CHECK `juridica`\|`financiera`\|`construccion`\|`secretaria` |
| `asunto` | `asunto` | `text` |
| `mensaje` | `mensaje` | `text` |
| `origen` | `origen` | `text` CHECK `portal`\|`concierge`\|`secretaria` |
| `estado` | `estado` | `text` CHECK `abierta`\|`en_gestion`\|`resuelta`\|`cerrada` |
| `respuesta` | `respuesta` | `text` |
| `conversacion` | `conversacion` | `text` |

---

## DocumentoSocio → `documentos_socio`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `socio_id` | `socio_id` | `uuid` → `socios(id)` |
| `tipo` | `tipo` | `text` CHECK `dni_nie`\|`justificante_ingresos`\|`declaracion_jurada`\|`contrato_firmado`\|`otro` |
| `nombre` | `nombre` | `text` |
| `file_uri` | `file_uri` | `text` | Private Storage path/URI |
| `subido_por_email` | `subido_por_email` | `text` |
| `estado` | `estado` | `text` CHECK `subido`\|`verificado`\|`rechazado` |
| `fecha_revision` | `fecha_revision` | `date` |
| `motivo_rechazo` | `motivo_rechazo` | `text` |

---

## DocumentoLegal → `documentos_legales`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `cooperativa_id` | `cooperativa_id` | `uuid` → `cooperativas(id)` |
| `proyecto_id` | `proyecto_id` | `uuid` → `proyectos(id)` |
| `titulo` | `titulo` | `text` |
| `titulo_traducido` | `titulo_traducido` | `text` |
| `tipo` | `tipo` | `text` |
| `referencia` | `referencia` | `text` |
| `fecha_documento` | `fecha_documento` | `date` |
| `estado` | `estado` | `text` CHECK `activo`\|`archivado`\|`caducado` |
| `visibilidad` | `visibilidad` | `text` CHECK `consejo_rector`\|`interno`\|`todos` |
| `resumen` | `resumen` | `text` |
| `resumen_traducido` | `resumen_traducido` | `text` |

---

## ExpedienteUrbanistico → `expedientes_urbanisticos`

| Base44 | Postgres | Type |
|--------|----------|------|
| `tenant_id` | `tenant_id` | `text` |
| `proyecto_id` | `proyecto_id` | `uuid` → `proyectos(id)` |
| `tipo` | `tipo` | `text` |
| `administracion` | `administracion` | `text` |
| `referencia_oficial` | `referencia_oficial` | `text` |
| `estado` | `estado` | `text` | Free text in JSONC (no enum) |
| `fecha_presentacion` | `fecha_presentacion` | `date` |
| `fecha_limite` | `fecha_limite` | `date` |
| `responsable` | `responsable` | `text` |
| `riesgo` | `riesgo` | `text` CHECK `bajo`\|`medio`\|`alto`\|`critico` |
| `requisitos` | `requisitos` | `text` |
| `notas` | `notas` | `text` |

---

## AuditLog → `audit_logs`

| Base44 | Postgres | Type | Notes |
|--------|----------|------|-------|
| `tenant_id` | `tenant_id` | `text` | |
| `accion` | `accion` | `text` | |
| `entidad_tipo` | `entidad_tipo` | `text` | |
| `entidad_id` | `entidad_id` | `text` | |
| `usuario_id` | `usuario_id` | `uuid` → `profiles(id)` | |
| `usuario_email` | `usuario_email` | `text` | |
| `usuario_rol` | `usuario_rol` | `text` | |
| `valores_anteriores` | `valores_anteriores` | `jsonb` | Base44 stored JSON **string**; façade may `JSON.stringify`/`parse` |
| `valores_nuevos` | `valores_nuevos` | `jsonb` | Same |
| `ip_direccion` | `ip_direccion` | `text` | |
| `detalle` | `detalle` | `text` | |
| `fecha` | `fecha` | `timestamptz` | |
| (system) | `created_at` | `timestamptz` | No `updated_at` (immutable) |

---

## Storage buckets (not tables)

| Upload site | Bucket | Public? |
|-------------|--------|---------|
| `IntakeForm` → `DocumentoSocio.file_uri` | `documentos-socio-privados` | private |
| `IncidenciaDialog` → `Incidencia.foto_url` | `incidencias-fotos` | public |

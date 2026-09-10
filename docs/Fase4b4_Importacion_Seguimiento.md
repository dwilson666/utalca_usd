# Fase 4b.4 — Importación y seguimiento

Fecha: 2026-09-10 · Rama: `main`

## 1. Seguimiento del levantamiento (`/seguimiento`)

Módulo **separado del RAT** para la gestión del DPD: en qué punto va el contacto y
las reuniones con cada unidad.

- KPIs por etapa (No contactada · Contactada · Reunión agendada · Reunión realizada ·
  En seguimiento · Levantamiento completo); clic en un KPI filtra la tabla.
- Tabla de todas las unidades RAT: etapa (editable con `tracking.manage`), fechas de
  contacto/reunión, nº de contactos, nº de RAT.
- Fila «Detalle»: fechas, pendientes y notas de la unidad + **contactos** de la unidad
  (alta / edición / baja).
- Solo lectura para quien tiene `tracking.read.all` sin `tracking.manage`.
- Autorización: RLS de `unit_engagements` / `engagement_contacts`
  (`tracking.read.all` para ver, `tracking.manage` para escribir). Sin migración nueva.

`apps/web/src/lib/trackingApi.ts`, `apps/web/src/pages/Tracking.tsx`,
`ENGAGEMENT_STAGES` / `ENGAGEMENT_STAGE_LABEL` en `@rat/shared`.

## 2. Importación desde planilla (`/importacion`)

Flujo con **staging y curación manual** — **nunca publica un RAT**.

1. Tipo de datos: **Contactos de seguimiento** o **Actividades (a borrador)**.
2. Subir `.xlsx` / `.csv` → se parsea (SheetJS `xlsx`, cargado de forma perezosa; CSV
   se lee como texto UTF-8).
3. **Correspondencia de columnas** autodetectada y editable (columna de origen → campo).
4. **Resolución de unidad** por fila: se empareja el texto de la columna «unidad» con
   una unidad canónica (nombre corto / oficial / código, sin acentos); cada fila tiene
   un selector para corregirla.
5. Tabla de previsualización: incluir/excluir por fila, ver campos mapeados y la unidad
   resuelta (marcada en rojo si falta).
6. **Importar** → crea `import_batches` + `import_rows_staging` y llama a
   `app.import_commit(uuid)` (ya existente), que:
   - `classification='contact'` → inserta en `engagement_contacts`
   - `classification='activity_seed'` → inserta `processing_activities` en **BORRADOR**
   - nunca aprueba ni cierra nada; deja `validation='imported'`.

Cada borrador importado debe completarse y enviarse a revisión con el asistente RAT.

`apps/web/src/lib/importApi.ts`, `apps/web/src/pages/Import.tsx`.
Dependencia nueva: `xlsx@^0.18.5` (en un chunk aparte de ~140 KB gzip, solo se carga
al entrar en la importación).

## 3. Archivos

**Nuevos**: `apps/web/src/lib/{trackingApi,importApi}.ts`,
`apps/web/src/pages/{Tracking,Import}.tsx`, `docs/Fase4b4_Importacion_Seguimiento.md`
**Modificados**: `packages/shared/src/domain.ts` (etapas de engagement),
`apps/web/src/router.tsx` (`/seguimiento`, `/importacion`),
`apps/web/src/components/AppShell.tsx` (enlace «Importación» con `import.execute`),
`apps/web/package.json` + `pnpm-lock.yaml` (xlsx)

## 4. Migraciones

Ninguna. El staging de importación (`import_batches`, `import_rows_staging`,
`app.import_commit`) y las tablas de seguimiento ya existían desde Fase 4a.

## 5. Pruebas

- pgTAP sin cambios (no se tocó ninguna RLS/RPC): 49/49 en verde
  (`bash C:/Users/Public/rat/run_tests.sh`).
- `typecheck` + `build` OK; `xlsx` queda en un chunk separado.
- **Verificación funcional** (dev server sobre la BD en la nube):
  - `/seguimiento`: KPIs correctos desde el seed; cambio de etapa de una unidad →
    `POST unit_engagements` (upsert) 200.
  - `/importacion`: CSV de 3 contactos → 2 unidades resueltas (Bibliotecas, Contraloría),
    1 sin resolver descartada → `import_commit` → `{contacts_created: 2,
    activity_drafts_created: 0}`; contactos creados con `source_import_batch_id`.
    (datos de prueba eliminados después.)

## 6. Pendientes / a continuación

- Persistir la correspondencia de columnas por plantilla en `import_column_mappings`
  para no re-mapear en cada carga.
- Historial de lotes de importación.
- **4b.5 — Entregables**: exportación XLSX/PDF del RAT (institucional y por unidad
  según permisos), consola de auditoría (`audit_log`), diff de versiones
  (`diff_activity_versions` ya existe).

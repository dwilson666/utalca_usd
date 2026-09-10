# Fase 4b.5 — Entregables

Fecha: 2026-09-10 · Rama: `main`

## 1. Consola de auditoría (`/auditoria`)

- Tabla de `audit_log` (registro append-only con cadena de hash SHA-256): fecha,
  actor, acción, entidad, cambio (estado o campos), resultado.
- Filtros por acción, tipo de entidad y ventana temporal (7 / 30 / 90 días / todo);
  se muestran hasta 200 registros por consulta.
- Botón **Verificar integridad** → RPC `verify_audit_chain` (recorre la cadena y
  confirma que ningún registro fue alterado; señala el `#id` roto si lo hubiera).
- Autorización: RLS `audit_sel` (`audit.read`, o `audit.read.own_unit` acotado a
  la unidad). Ruta `RequirePermission perm="audit.read"`.
- `apps/web/src/lib/auditApi.ts`, `apps/web/src/pages/Audit.tsx`.

## 2. Reporte / exportación del RAT (`/reporte`)

- Selector de **alcance**: «Todas las unidades (institucional)» para quien tiene
  `institutional.view`, o una de sus unidades para el resto. El backend (RLS)
  filtra igualmente por alcance.
- **Descargar Excel** — genera un `.xlsx` (SheetJS, chunk perezoso) con una fila por
  actividad y 22 columnas con los campos de la Ley 21.719 (finalidad, categorías de
  datos/titulares, bases de licitud, destinatarios, transferencias, conservación,
  medidas de seguridad, decisiones automatizadas, etc.).
- **Imprimir / Guardar PDF** — `window.print()` sobre una vista documental
  (`.printable`) con encabezado institucional (responsable del tratamiento, RUT) y
  un bloque por actividad. Reglas `@media print` ocultan la barra lateral, la barra
  superior y los botones.
- Autorización: `RequirePermission perm="export.execute"`.
- `apps/web/src/lib/exportApi.ts`, `apps/web/src/pages/RatReport.tsx`.

## 3. Historial y comparación de versiones

- En `ActivityDetail`, la tarjeta **Versiones** ahora lista cada versión con su
  motivo (envío / aprobación / manual / restauración) y fecha, y ofrece **comparar
  con la versión anterior** (`↔ vN`).
- La comparación usa el RPC `diff_activity_versions` (que ya existía) y calcula del
  lado del cliente qué campos escalares cambiaron y cómo variaron los tamaños de las
  colecciones hijas (bases de licitud, categorías, destinatarios, etc.).
- `fetchVersionDiff` en `apps/web/src/lib/queries.ts`.

## 4. Archivos

**Nuevos**: `apps/web/src/lib/{auditApi,exportApi}.ts`,
`apps/web/src/pages/{Audit,RatReport}.tsx`, `docs/Fase4b5_Entregables.md`
**Modificados**: `apps/web/src/lib/queries.ts` (`fetchVersionDiff`),
`apps/web/src/pages/ActivityDetail.tsx` (`VersionHistory`),
`apps/web/src/router.tsx` (`/auditoria`, `/reporte`; se retira `SimplePage`),
`apps/web/src/pages/Misc.tsx` (se elimina `SimplePage`),
`apps/web/src/components/AppShell.tsx` (enlace «Reporte / Exportar»),
`apps/web/src/styles.css` (`@media print`)

## 5. Migraciones

Ninguna. `audit_log`, `verify_audit_chain` y `diff_activity_versions` ya existían
desde la Fase 4a.

## 6. Pruebas

- pgTAP **49/49** sin cambios (no se tocó esquema/RLS/RPC).
- `typecheck` + `build` OK; `xlsx` permanece en su chunk aparte.
- **Verificación funcional** (dev server sobre la BD en la nube):
  - `/auditoria`: lista el rastro de las pruebas anteriores (importación, asignación
    de roles, transiciones de estado); «Verificar integridad» → «Cadena de auditoría
    íntegra».
  - `/reporte`: alcance institucional → 11 actividades con detalle completo; las filas
    de exportación se arman con las 22 columnas de la Ley 21.719; el botón Excel
    ejecuta la generación sin errores.
  - Versiones de `RAT-000024`: `v1 ↔ v2` → «Sin cambios en los campos comparados»
    (correcto: la corrección solo resolvió una observación).

## 7. Estado de la Fase 4b

| Iteración | Estado |
|---|---|
| 4b.0 Estabilización (Cloudflare, roles) | ✅ |
| 4b.1 Asistente RAT (9 pasos) | ✅ |
| 4b.2 Revisión y estados (DPD) | ✅ |
| 4b.3 Administración (permisos `unit_role`, consolas) | ✅ |
| 4b.4 Importación y seguimiento | ✅ |
| 4b.5 Entregables (export, auditoría, versiones) | ✅ |
| Responsivo (cajón móvil) | ✅ |

### Pendientes menores (no bloquean)
- Notificaciones por correo (observar/aprobar) — requiere clave Resend.
- Persistir la correspondencia de columnas de importación (`import_column_mappings`)
  e historial de lotes.
- Reasignación de unidad padre en `/admin/unidades`.
- El asistente RAT aún no gestiona adjuntos ni unidades intervinientes (falta decidir
  Storage / R2).
- MFA sigue desactivado por flag (reactivar antes de datos reales).
- Rotar las credenciales que se compartieron por chat.

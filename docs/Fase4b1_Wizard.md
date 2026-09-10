# Fase 4b.1 — Asistente RAT (9 pasos)

Fecha: 2026-09-10 · Rama: `main`

## Qué se implementó

Registro de una actividad de tratamiento de principio a fin, sobre el núcleo de
autorización de 4a (RLS + RBAC + alcance por unidad), sin reemplazarlo.

- **Listado** con botón «+ Nueva actividad» (visible solo con `activity.create`).
- **Asistente de 9 pasos** (`WIZARD_STEPS` de `@rat/shared`):
  1. Identificación · 2. Finalidad · 3. Titulares y datos · 4. Base jurídica ·
  5. Destinatarios y transferencias · 6. Conservación · 7. Automatización ·
  8. Seguridad · 9. Revisión (resumen + envío).
- **Guardar como borrador en cualquier momento** (botón global) y **al avanzar**
  cada paso se persiste solo lo que ese paso toca (menos tráfico, guardado incremental).
- **Validación por paso con Zod** (`wizardStepSchemas`) — no bloquea la navegación
  (se puede ir y volver), pero marca cada paso como completo/incompleto y muestra
  los mensajes de error de forma comprensible.
- **Campos obligatorios vs opcionales** señalados con `*` / «(opcional)».
- **Porcentaje de completitud** tomado del servidor (`completeness_pct`, recalculado
  por trigger) más un indicador de pasos completos.
- **Envío a revisión** (`makeActivitySubmitSchema`): valida el borrador completo,
  incluidas reglas de la Ley 21.719 que el backend también exige (dato sensible ⇒
  base reforzada; transferencia ⇒ garantía). Si falta algo, no envía y señala los
  pasos. Si todo está, guarda y llama a `set_activity_status(..., 'EN_REVISION')`.
- **Resiliencia**: respaldo del borrador en `localStorage` en cada cambio; al reabrir
  ofrece restaurar si el respaldo es más nuevo que lo confirmado en el servidor;
  aviso `beforeunload` con cambios sin guardar.
- **Bloqueo por estado**: si la actividad no está en un estado editable
  (BORRADOR / EN_COMPLETADO / OBSERVADO / CORREGIDO) el asistente no permite editar
  y remite al detalle.

## Archivos

**Nuevos (frontend)**
- `apps/web/src/pages/ActivityWizard.tsx` — shell del asistente
- `apps/web/src/pages/wizard/steps.tsx` — los 9 pasos
- `apps/web/src/pages/wizard/fields.tsx` — componentes de formulario reutilizables
- `apps/web/src/lib/activityApi.ts` — crear / cargar / guardar por paso / enviar
- `apps/web/src/lib/catalogs.ts` — carga y caché de catálogos (solo `status='active'`)
- `apps/web/src/lib/units.ts` — unidades y filtro de unidades seleccionables
- `apps/web/src/lib/wizardLocal.ts` — respaldo local del borrador

**Modificados (frontend)**
- `apps/web/src/router.tsx` — rutas `/actividades/nueva` (perm `activity.create`) y
  `/actividades/:id/editar` (perm `activity.update.own_unit`); se retira `WizardStub`
- `apps/web/src/pages/ActivitiesList.tsx` — botón «Nueva actividad»
- `apps/web/src/pages/Misc.tsx` — se elimina `WizardStub`
- `packages/shared/src/domain.ts` — `WizardStepKey`, `WIZARD_DATA_STEPS`, `RETENTION_UNITS`
- `packages/shared/src/schemas.ts` — `wizardDraftSchema`, `wizardStepSchemas`,
  `makeActivitySubmitSchema`

**Base de datos**
- `supabase/migrations/20260909120118_activity_create_institutional.sql`
  — `pa_ins`: quien tiene `activity.update.all` (rol institucional) puede crear en
  cualquier unidad. Jefe/colaborador siguen restringidos a su unidad. Se mantiene
  MFA + `activity.create` + deny-by-default. Análisis en el propio archivo.
- `supabase/migrations/20260909120119_completeness_trigger_definer.sql`
  — `trg_touch_completeness` y `trg_pa_self_completeness` pasan a `SECURITY DEFINER`
  para que el INSERT/UPDATE de una actividad por un usuario final no falle al llamar
  a `recompute_completeness` (que sigue revocada como RPC). No relaja ninguna RLS.

**Pruebas**
- `supabase/tests/authz_wizard_test.sql` — 9 casos nuevos (creación por unidad,
  aislamiento entre unidades, edición de hijas, rol institucional, auditor sin crear).

## Migraciones ejecutadas en la nube

`20260909120118` y `20260909120119` aplicadas y registradas en
`supabase_migrations.schema_migrations`.

## Pruebas ejecutadas

Local (PostgreSQL portátil + shim + pgTAP 1.3.3):

```
authz_matrix_test.sql .... 15/15 ok   (sin regresiones)
authz_wizard_test.sql ....  9/9  ok
```

En CI se re-ejecutan ambos con `supabase test db` en cada push a `main`.

Verificación funcional en `rat-utalca.pages.dev` (dev server sobre la BD en la nube):
alta de `RAT-000024` como superadmin, 9 pasos, guardado incremental, envío a
revisión → estado `EN_REVISION`, versión `v1` generada, detalle correcto, y el
asistente bloquea la reedición mientras está en revisión.

## Problemas encontrados y resueltos

- **`permission denied for function recompute_completeness`** al crear la primera
  actividad desde la UI (usuario `authenticated`). Causa: los triggers de
  completitud corrían como INVOKER y la función está (bien) revocada como RPC.
  Solución: migración `…119` (triggers a SECURITY DEFINER).
- **El superadmin no podía crear actividades** (no tiene asignaciones de unidad y
  `pa_ins` exigía unidad propia). Solución: migración `…118`.
- **Shim local**: al recrear el esquema `public` en un PostgreSQL vanilla se perdía
  el `GRANT USAGE ... TO authenticated`; se añadió al `scripts/local_pg_shim.sql`.

## Pendientes / a continuación

- **4b.2 — Revisión y estados**: bandeja del DPD, observaciones, aprobar/observar,
  ciclo corregir→reenviar, estado de la unidad, historial de versiones navegable.
- El asistente aún no gestiona **adjuntos** (`activity_attachments`) ni **unidades
  intervinientes** (`activity_intervening_units`); se añadirán como pasos/secciones
  opcionales cuando se defina el almacenamiento (Supabase Storage / R2).
- **4b.3** abordará el hallazgo de permisos diferenciados (`unit_role='consulta'` ⇒
  solo lectura de RAT) descrito en `Fase4b_Estabilizacion.md` §3.

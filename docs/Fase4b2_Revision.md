# Fase 4b.2 — Revisión y estados (ciclo del DPD)

Fecha: 2026-09-10 · Rama: `main`

## Qué se implementó

El circuito de calidad completo: enviar → revisar → observar/aprobar → corregir → reenviar.

- **Bandeja de revisión** (`/revision`) — cola de actividades `EN_REVISION` visibles
  para el usuario (RLS filtra), ordenadas por antigüedad. Solo con `activity.review`.
- **Ficha de revisión** (`/revision/:id`):
  - Vista de solo lectura del RAT completo (`RatReadView`).
  - **Observaciones**: alta con paso/campo + severidad (obligatoria / sugerida) + texto;
    listado con estado; marcar resuelta / reabrir.
  - **Decisión**: *Aprobar* (bloqueada si hay observaciones obligatorias sin resolver)
    o *Devolver con observaciones* (exige ≥1 observación obligatoria). Ambas atómicas.
- **Corrección en el asistente** — al abrir el wizard sobre una actividad `OBSERVADO`
  o `CORREGIDO`:
  - Panel «Observaciones del DPD» arriba, con botón *marcar resuelta*.
  - El botón final pasa a **«Reenviar a revisión»**, deshabilitado mientras queden
    observaciones sin resolver.
  - Transición encadenada: `OBSERVADO → CORREGIDO → EN_REVISION` (o `CORREGIDO → EN_REVISION`).
- **Ficha de la actividad** (`ActivityDetail`) — panel de observaciones con severidad y
  estado; botón «Corregir y reenviar» cuando corresponde; historial de versiones
  (v1 submit, v2 submit, …) generado por trigger en cada envío/aprobación.
- **Estado de la unidad** — sin cambios: `UnitDashboard` ya permite al jefe (o a quien
  tenga `unit.status.manage`) mover el estado de SU unidad con comentario.

## Archivos

**Nuevos (frontend)**
- `apps/web/src/pages/ReviewInbox.tsx`, `apps/web/src/pages/ReviewDetail.tsx`
- `apps/web/src/lib/reviewApi.ts` — cola, observaciones y RPCs de revisión
- `apps/web/src/components/RatReadView.tsx` — vista de solo lectura del RAT
- `apps/web/src/components/Observations.tsx` — ítem de observación reutilizable

**Modificados (frontend)**
- `apps/web/src/router.tsx` — `/revision` y `/revision/:id` (perm `activity.review`)
- `apps/web/src/pages/ActivityWizard.tsx` — panel de observaciones + reenvío tras corrección
  + guarda anti-doble-envío
- `apps/web/src/pages/ActivityDetail.tsx` — observaciones con severidad/estado + «Corregir y reenviar»

**Base de datos**
- `supabase/migrations/20260909120120_review_rpcs.sql` — RPCs atómicas:
  `review_add_observation`, `review_resolve_observation`, `review_decide`
  (+ helper interno `app.review_ensure_open`, revocado como RPC). Cada una verifica
  su autorización (visibilidad → 404; `activity.review` para observar/decidir;
  editor de unidad o revisor para resolver). `review_decide` delega la transición en
  `app.set_activity_status` (valida workflow + guardas) y además impide aprobar con
  observaciones obligatorias abiertas.

**Pruebas**
- `supabase/tests/authz_review_test.sql` — 10 casos.

## Migraciones ejecutadas en la nube

`20260909120120_review_rpcs` aplicada y registrada.

## Pruebas ejecutadas

Local (PostgreSQL portátil + shim + pgTAP 1.3.3):

```
authz_matrix_test.sql .... 15/15 ok
authz_wizard_test.sql ....  9/9  ok
authz_review_test.sql ....  10/10 ok
                          ───────────
                            34/34 ok
```

CI re-ejecuta las tres con `supabase test db` en cada push a `main`.

**Verificación funcional** en dev server sobre la BD en la nube:
1. `RAT-000024` (EN_REVISION) → se agrega una observación obligatoria → *Aprobar* queda
   deshabilitado → *Devolver con observaciones* → estado `OBSERVADO`.
2. `Corregir y reenviar` → el asistente muestra la observación → *marcar resuelta* →
   *Reenviar a revisión* → `OBSERVADO → CORREGIDO → EN_REVISION`, versión `v2` creada,
   vuelve a la bandeja.

## Problemas encontrados y resueltos

- **Doble envío** desde el asistente (clic/red lenta) generaba llamadas repetidas a
  `set_activity_status`. Mitigado con guarda `opRef` en el wizard; en el backend el
  `SELECT ... FOR UPDATE` de `review_ensure_open`/`set_activity_status` serializa y la
  transición repetida se rechaza sin efecto.

## Pendientes / a continuación

- **4b.3 — Administración**: consola de usuarios/roles/asignaciones, jefaturas,
  **permisos de edición de RAT diferenciados** (`unit_role='consulta'` ⇒ solo lectura,
  hoy no aplicado en RLS — ver `Fase4b_Estabilizacion.md` §3), unidades y catálogos.
- Notificaciones por correo al observar/aprobar (cuando se habilite Resend / pg_net).
- Vista de *diff* entre versiones (el RPC `diff_activity_versions` ya existe).

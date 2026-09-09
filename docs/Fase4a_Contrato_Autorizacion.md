# Fase 4a — Contrato de autorización y segregación por unidad

> Requisito previo a la implementación de cualquier módulo. Reconcilia las reglas de segregación entregadas por la Unidad de Seguridad Digital con la arquitectura de la [Fase 2](../../Fase2_Arquitectura_RAT_UTalca.md) y el diseño de la [Fase 3](../../Fase3_UX_UI_RAT_UTalca.md).
>
> **Regla de oro (evaluar en cada decisión técnica):** *¿Puede una unidad acceder, directa o indirectamente, a información que pertenece a otra unidad?* Si la respuesta es «sí», la implementación es incorrecta.

Fecha: 2026-09-09 · Estado: **fuente de verdad para la Fase 4**. Ante contradicción con Fases 2–3, prevalece este documento (y se registra el cambio abajo).

---

## 1. Decisiones nuevas / cambios respecto de las Fases 2–3

| # | Decisión | Reemplaza / precisa |
|---|---|---|
| **D8 · Unidad = espacio de trabajo aislado** | RLS *deny-by-default*. No existe ninguna política que permita acceso entre unidades salvo rol de **alcance institucional**. Un `SELECT/UPDATE/DELETE` sobre una actividad de otra unidad devuelve *cero filas* / error, aunque se conozca el UUID o se llame la API directamente. Un recurso fuera de alcance responde **404**, no 403 (no se confirma su existencia). | Refuerza D2/§6.3 de Fase 2 y §5.6 de Fase 3. |
| **D9 · `unit_role` con jefe explícito** | `user_unit_assignments.unit_role ∈ {'jefe','colaborador','consulta'}`. Una unidad puede tener ≥ 1 jefe. **Solo `jefe`** (o rol institucional con `unit.status.manage`) transiciona el **estado de la unidad**. `colaborador` edita actividades de su unidad; `consulta` solo lee. | Precisa el `unit_role` de Fase 2 (`responsable/colaborador/consulta` → `jefe/colaborador/consulta`). El rol RBAC «Responsable de Unidad» = `unit_manager` se otorga al jefe. |
| **D10 · Dos máquinas de estado independientes** | **Estado de actividad** (`BORRADOR…CERRADA`) y **estado de unidad** (`PENDIENTE…CERRADA`) son columnas y tablas separadas, con transiciones y guardas propias. Una unidad tiene N actividades en distintos estados; el estado de la unidad describe su avance global. | Nuevo. El módulo `unit_engagements` (seguimiento del proyecto, gestionado por el DPD: `no_contactada…levantamiento_completo`) permanece **separado**: es la mirada de gestión de proyecto, no el autorreporte de la unidad. |
| **D11 · Endpoints con autorización explícita; sin dashboard genérico** | No existe `GET /dashboard` que devuelva consolidado y luego filtre en el cliente. Se separa: `GET /institutional/*` (exige `institutional.view`) y `GET /units/{unitId}/*` (exige membresía en `unitId`). Los dashboards se sirven por **RPC `SECURITY DEFINER`** que verifican permiso y lanzan `insufficient_privilege`. | Nuevo (operacionaliza §4/§6 del documento de reglas). |
| **D12 · El rol nunca proviene del cliente** | Roles y asignaciones viven **solo** en `user_roles` y `user_unit_assignments`, gestionadas con permiso `user.manage`. **Prohibido** derivar rol/alcance de `auth.users.raw_user_meta_data` o `raw_app_meta_data` (escribibles por el propio usuario vía `supabase.auth.updateUser`), de headers, o de *claims* que el cliente pueda alterar. Si se usan *custom claims*, los emite un **Auth Hook del lado servidor** desde esas tablas y se **re-verifican** en cada operación sensible. | Nuevo (operacionaliza §9 y Caso 10). |
| **D13 · Selector de rol solo en demo** | El prototipo Fase 3 tenía un selector de Rol. En **producción se elimina**. Se permite un `demo_mode` (feature flag, **off** en prod, sin datos reales) para QA. La vista y los permisos se determinan del usuario autenticado. | Cambia el prototipo de Fase 3. |
| **D14 · Indicadores segregados** | La vista/materialización institucional **no** es accesible por RLS a usuarios de unidad. Se sirve solo por RPC institucional. Los KPIs de unidad se sirven por RPC con verificación de membresía; la caché `unit_kpi_cache` lleva RLS por unidad. Ningún número institucional (`avance institucional: 67%`, comparativas entre unidades) llega a un usuario de unidad. | Precisa §5.4 de Fase 2 y §5.2 de Fase 3. |

---

## 2. Modelo de autorización: ROL + ALCANCE

```text
autorización(usuario, acción, objeto) =
      permiso_del_rol(usuario, acción)          -- QUÉ puede hacer  (tabla user_roles → role_permissions)
  ∧   alcance(usuario) cubre unidad(objeto)     -- SOBRE QUÉ unidades (tabla user_unit_assignments + cierre)
  ∧   (acción de nivel-unidad ⇒ unit_role adecuado)   -- jefe / colaborador / consulta
  ∧   sesión con MFA (aal2)
```

| Rol RBAC (`roles.code`) | Alcance (`user_roles.scope`) | `institutional.view` | Resumen |
|---|---|:--:|---|
| `superadmin` | `global` | ✅ | Todo, incluida gestión de usuarios/roles/unidades y configuración. |
| `dpd_admin` | `global` | ✅ | Ve y gestiona todas las unidades y actividades; revisa; aprueba/observa; `unit.status.manage`; auditoría (lectura); exporta. No gestiona usuarios/roles. |
| `auditor` | `global` | ✅ (solo lectura) | Lectura de todo lo autorizado + auditoría + reportes. Sin escritura. |
| `unit_manager` (jefe) | `unit` | ❌ | Gestiona actividades de su(s) unidad(es); envía a revisión; **transiciona el estado de su unidad**. No ve otras unidades ni el consolidado. |
| `collaborator` | `unit` | ❌ | Edita actividades de su(s) unidad(es) en estado editable. No envía a revisión ni cambia el estado de la unidad. |

`unit_manager` y `collaborator` **nunca** tienen `scope='global'`. El alcance efectivo son las filas de `user_unit_assignments` (más descendientes si `includes_descendants`).

Verificación en **tres capas** (la tercera es la crítica):

| Capa | Mecanismo | Qué garantiza |
|---|---|---|
| 1 · Frontend | Rutas y componentes condicionados a permisos resueltos del backend | UX — nunca seguridad |
| 2 · API / Edge Functions | RPC `SECURITY DEFINER` que verifican permiso y lanzan `42501`; endpoints `/institutional/*` vs `/units/{id}/*` | Autorización de operaciones multi-paso, dashboards, import/export, gestión de usuarios |
| 3 · **PostgreSQL RLS** | Políticas `USING` / `WITH CHECK` en **todas** las tablas de negocio + `FORCE ROW LEVEL SECURITY` | Aislamiento efectivo aunque se llame PostgREST directo con un JWT válido de otra unidad |

> `service_role` de Supabase tiene `BYPASSRLS`. Solo lo usan las Edge Functions y **siempre** tras una verificación explícita de autorización en código. El cliente **nunca** recibe la `service_role key`.

---

## 3. Funciones auxiliares de autorización (esquema `app`)

Definidas en [`supabase/migrations/20260909120108_auth_helpers.sql`](../supabase/migrations/20260909120108_auth_helpers.sql). Todas `STABLE`; las que consultan tablas, `SECURITY DEFINER` con `search_path` fijo.

| Función | Devuelve | Uso |
|---|---|---|
| `app.uid()` | `uuid` | `auth.uid()` de la sesión. |
| `app.is_mfa()` | `boolean` | El *claim* `aal` del JWT es `aal2`. Toda política y RPC lo exige. |
| `app.has_perm(text)` | `boolean` | El usuario tiene el permiso por alguno de sus roles vigentes. |
| `app.is_institutional()` | `boolean` | Tiene un rol vigente con `scope='global'` en (`superadmin`,`dpd_admin`,`auditor`). |
| `app.user_unit_ids()` | `setof uuid` | Unidades asignadas ∪ descendientes (si `includes_descendants`), vía `organizational_unit_closure`. |
| `app.can_see_unit(uuid)` | `boolean` | `is_institutional()` OR la unidad ∈ `user_unit_ids()`. |
| `app.is_jefe_of(uuid)` | `boolean` | Tiene asignación `unit_role='jefe'` sobre esa unidad (o un ancestro con `includes_descendants`). |

---

## 4. Catálogo de políticas RLS (resumen)

Detalle ejecutable en [`supabase/migrations/20260909120109_rls_policies.sql`](../supabase/migrations/20260909120109_rls_policies.sql) y explicación tabla por tabla en [`RLS_POLICIES.md`](RLS_POLICIES.md).

| Tabla | SELECT | INSERT | UPDATE | DELETE | Caso(s) que defiende |
|---|---|---|---|---|---|
| `processing_activities` | `activity.read.all` **o** `responsible_unit_id ∈ user_unit_ids()` | `activity.create` **y** unidad ∈ `user_unit_ids()` | `activity.update.all` **o** (unidad ∈ `user_unit_ids()` **y** `activity.update.own_unit` **y** estado editable) | — (borrado lógico vía RPC institucional) | 1, 2, 8, 9 |
| `activity_*` (hijas) | la actividad padre es visible | idem padre + estado editable | idem | — | 1, 2, 8, 9 |
| `activity_status_transitions` | actividad visible | — (solo trigger/RPC) | — | — | trazabilidad |
| `activity_versions` | actividad visible | — (solo trigger) | — | — | integridad |
| `activity_reviews`, `review_observations` | actividad visible; crear requiere `activity.review` (institucional) | `activity.review` | `activity.review` (autor) o corrección por el jefe/colaborador de la unidad | — | 1, 2 |
| `organizational_units` | autenticado con MFA (solo lectura del árbol) — **sin** `rat_status`/KPIs para no institucionales salvo la propia | `unit.manage` | `unit.manage`; `rat_status` **solo** vía `app.set_unit_rat_status()` | — | 3, 4, 5 |
| `unit_rat_status_transitions` | `is_institutional()` **o** unidad ∈ `user_unit_ids()` | — (solo RPC) | — | — | 3, 4, 5 |
| `unit_engagements`, `engagement_contacts` | `tracking.read.all` **o** unidad ∈ `user_unit_ids()` | `tracking.manage` | `tracking.manage` | — | segregación seguimiento |
| `user_roles`, `user_unit_assignments` | fila propia **o** `user.read` | `user.manage` | `user.manage` (+ trigger anti-autoelevación) | `user.manage` | **10** |
| `profiles` | fila propia **o** `user.read` | `user.manage` | fila propia (solo `full_name`, `locale`) **o** `user.manage` | `user.manage` | 10 |
| `audit_log` | `audit.read` (institucional) **o** `audit.read.own_unit` filtrado a `unit_id ∈ user_unit_ids()` | — (solo `app.write_audit()` `SECURITY DEFINER`) | — (revocado) | — (revocado) | inmutabilidad |
| catálogos (`legal_bases`, …) | autenticado con MFA | `config.manage` | `config.manage` | — | — |
| `import_batches`, `import_rows_staging` | `import.execute` (institucional) | `import.execute` | `import.execute` | `import.execute` | segregación import |
| `mv_*` / `unit_kpi_cache` | `unit_kpi_cache`: unidad ∈ `user_unit_ids()`; institucional: **solo RPC** | — | — | — | **4, 6, 7**, D14 |

Patrón aplicado a todas: `ENABLE ROW LEVEL SECURITY` **y** `FORCE ROW LEVEL SECURITY`. Sin política ⇒ acceso denegado.

---

## 5. Endpoints (contrato)

| Método · Ruta | Autorización (capa 2) | RLS (capa 3) | Notas |
|---|---|---|---|
| `GET /rest/v1/processing_activities` | JWT aal2 | filtra por unidad/permiso | PostgREST; nunca devuelve otra unidad. |
| `POST /rest/v1/processing_activities` | JWT aal2 | `WITH CHECK` unidad propia | `responsible_unit_id` forzado a unidad del usuario si no es institucional (trigger). |
| `POST /functions/v1/activity-transition` | `activity.submit` / `activity.review` según transición; re-verifica unidad | trigger de guarda | Comentario obligatorio al observar/reabrir. |
| `POST /functions/v1/unit-status` → `app.set_unit_rat_status()` | `app.is_jefe_of(unit)` **o** `unit.status.manage` | — | **Casos 3, 4, 5.** |
| `GET /functions/v1/institutional-dashboard` → `app.institutional_dashboard()` | `institutional.view` | — | **Casos 6, 7.** Lanza `42501` si no. |
| `GET /functions/v1/unit-dashboard?unit=` → `app.unit_dashboard(uuid)` | `app.can_see_unit(unit)` | — | **Casos 1, 8.** |
| `GET /rest/v1/audit_log` | `audit.read` o `audit.read.own_unit` | filtra `unit_id` | Institucional ve todo; jefe ve su unidad. |
| `POST /functions/v1/users-invite`, `PATCH roles` | `user.manage` + trigger anti-autoelevación | RLS `user.manage` | **Caso 10.** |
| `GET /functions/v1/institutional-export` | `export.execute` + `institutional.view` | — | Export consolidado solo institucional. |
| `GET /functions/v1/unit-export?unit=` | `export.execute` + `can_see_unit` | — | Export de una unidad. |

**No se implementa** ningún endpoint que devuelva datos de varias unidades a un usuario sin `institutional.view`.

---

## 6. Checklist por módulo del incremento 4a

Antes de dar por hecho un módulo, marcar las cuatro casillas:

| Módulo | ¿RLS deny-by-default? | ¿Verificación en RPC/Edge? | ¿Test de la matriz cubre el módulo? | ¿UI oculta lo no permitido (sin ser la frontera)? |
|---|:--:|:--:|:--:|:--:|
| Migraciones + seed | ☐ | n/a | ☐ | n/a |
| Auth + MFA (aal2 obligatorio) | ☐ | ☐ | Caso 6/7 base | ☐ |
| RBAC (`user_roles`, sin rol desde cliente) | ☐ | ☐ | Caso 10 | ☐ |
| RLS (todas las tablas) | ☐ | n/a | Casos 1–2, 8–9 | n/a |
| CRUD actividades + wizard | ☐ | ☐ | Casos 1, 2, 8, 9 | ☐ |
| Estado de actividad | ☐ | ☐ | — | ☐ |
| Estado de unidad | ☐ | ☐ | Casos 3, 4, 5 | ☐ |
| Auditoría + versionado | ☐ (inmutable) | ☐ | — | ☐ |
| Dashboard de unidad | ☐ | ☐ | Casos 1, 8 | ☐ |
| Dashboard institucional | ☐ | ☐ | Casos 6, 7 | ☐ |
| Exportación | ☐ | ☐ | Casos 6, 7 | ☐ |

---

## 7. Matriz de pruebas de autorización (criterio de aceptación)

Implementada como suite ejecutable en [`supabase/tests/authz_matrix_test.sql`](../supabase/tests/authz_matrix_test.sql) (pgTAP; corre con `supabase test db` y en CI). La Fase 4 **no se cierra** hasta que los 10 casos pasen en verde.

| # | Escenario | Esperado | Mecanismo que lo hace cumplir |
|---|---|---|---|
| 1 | Usuario de Unidad A hace `SELECT` de una actividad de Unidad B | **DENEGADO** (0 filas) | RLS `pa_sel` |
| 2 | Usuario de Unidad A hace `UPDATE` de una actividad de Unidad B | **DENEGADO** | RLS `pa_upd` (`USING` + `WITH CHECK`) |
| 3 | Colaborador cambia el estado general de su unidad | **DENEGADO** (`42501`) | `app.set_unit_rat_status()` exige `is_jefe_of` o `unit.status.manage` |
| 4 | Jefe de Unidad A cambia el estado de Unidad A | **PERMITIDO** | `app.is_jefe_of(A) = true` + transición válida |
| 5 | Jefe de Unidad A cambia el estado de Unidad B | **DENEGADO** (`42501`) | `app.is_jefe_of(B) = false` |
| 6 | Usuario de unidad llama `institutional_dashboard()` | **DENEGADO** (`42501`) | RPC exige `institutional.view` |
| 7 | Administrador institucional llama `institutional_dashboard()` | **PERMITIDO** | tiene `institutional.view` |
| 8 | Usuario manipula el UUID de una actividad de otra unidad (GET por id) | **DENEGADO** (404 / 0 filas) | RLS `pa_sel` — el id no ayuda |
| 9 | Usuario consulta por API PostgREST registros de otra unidad (filtros a mano) | **DENEGADO por RLS** | `FORCE ROW LEVEL SECURITY` |
| 10 | Usuario intenta modificar su propio rol por petición directa a `user_roles` | **DENEGADO** | RLS `user.manage` + trigger `app.guard_no_self_role_escalation()` |

Casos adicionales incluidos en la suite: sesión sin MFA (aal1) → denegado en todo; `service_role` sin verificación previa → prohibido por convención (test de revisión de código); jefe de A intenta invitar usuario a B → denegado.

---

## 8. Organización conceptual resultante

```text
                 ┌──────────────────────────────────────┐
                 │  ROLES INSTITUCIONALES               │
                 │  superadmin · dpd_admin · auditor    │
                 │  institutional.view = ✅             │
                 └───────────────┬──────────────────────┘
                                 │  visión consolidada (RPC institucional)
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
   ┌─────────┐              ┌─────────┐              ┌─────────┐
   │ UNIDAD A │              │ UNIDAD B │              │ UNIDAD … │   ← aisladas entre sí (RLS)
   ├─────────┤              ├─────────┤              ├─────────┤
   │ jefe(s) │ estado unidad│ jefe(s) │ estado unidad│ jefe(s) │
   │ colab.  │ actividades  │ colab.  │ actividades  │ colab.  │
   │ consulta│ avance propio│ consulta│ avance propio│ consulta│
   └─────────┘              └─────────┘              └─────────┘
   El jefe de A administra el estado de A — nunca el de B.
   Un colaborador de A gestiona actividades de A — nunca cambia el estado de A.
```

---

## 9. Registro de cambios sobre diseño previo

1. **Fase 3 · selector de Rol** → eliminado de producción (D13). El mockup se conserva como referencia visual; el build de producción resuelve rol y vista del usuario autenticado.
2. **Fase 2 · `unit_role`** `responsable/colaborador/consulta` → `jefe/colaborador/consulta` (D9).
3. **Fase 2 · estado de unidad** implícito en `unit_engagements.stage` → se añade `organizational_units.rat_status` + `unit_rat_status_transitions` como máquina de estado propia controlada por el jefe (D10). `unit_engagements` se mantiene para gestión de proyecto del DPD.
4. **Fase 2 · `mv_institutional_kpis` legible por RLS** → ya **no** legible por usuarios de unidad; solo por RPC institucional (D14).
5. **Fase 2 · endpoints** → se formaliza la separación `/institutional/*` vs `/units/{id}/*` y se prohíbe el dashboard genérico (D11).

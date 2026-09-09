# Políticas RLS — referencia tabla por tabla

Implementación: [`supabase/migrations/0009_rls_policies.sql`](../supabase/migrations/0009_rls_policies.sql) (+ `0010`, `0011` para las tablas creadas ahí).
Principio: **toda** tabla de negocio con `ENABLE ROW LEVEL SECURITY` **y** `FORCE ROW LEVEL SECURITY`. **Sin política ⇒ acceso denegado.**

`service_role` (Supabase) tiene `BYPASSRLS`: lo usan solo las Edge Functions y **siempre** tras verificación explícita de autorización en el código de la función.

Funciones de autorización usadas (definidas en `0008`): `app.uid()`, `app.is_mfa()`, `app.has_perm(text)`, `app.is_institutional()`, `app.user_unit_ids()`, `app.can_see_unit(uuid)`, `app.is_jefe_of(uuid)`.

---

## Identidad y RBAC

### `profiles`
| Op | Política | Regla |
|---|---|---|
| SELECT | `profiles_sel` | fila propia **o** `user.read` |
| UPDATE | `profiles_upd_self` | fila propia (la UI solo permite `full_name`, `locale`) |
| ALL | `profiles_mgmt` | `user.manage` |

El rol y las unidades **no** están en `profiles` (D12): ninguna vía de escritura del cliente puede tocarlos.

### `roles`, `permissions`, `role_permissions`
| Op | Regla |
|---|---|
| SELECT | cualquier usuario autenticado (la UI necesita el catálogo de permisos) |
| ALL | `role.manage` (solo `superadmin`) |

### `user_roles` — **Caso 10**
| Op | Política | Regla |
|---|---|---|
| SELECT | `ur_sel` | filas propias **o** `user.read` |
| INSERT | `ur_ins` | `user.manage` |
| UPDATE | `ur_upd` | `user.manage` |
| DELETE | `ur_del` | `user.manage` |

**Trigger `trg_ur_no_self` → `app.guard_no_self_role_escalation()`**: nadie modifica sus propios roles, ni siquiera con `user.manage` (defensa ante cuenta admin comprometida). Excepción: `set app.bootstrap = 'on'` (solo migraciones/seed).

### `user_unit_assignments` — **Caso 10 + Extra 2**
Idéntico a `user_roles`: SELECT propias o `user.read`; escritura `user.manage`; trigger anti-autoelevación. Un jefe de unidad **no** tiene `user.manage` ⇒ no puede asignar usuarios (ni a su unidad ni a otras).

---

## Configuración institucional

| Tabla | SELECT | Escritura |
|---|---|---|
| `institutional_controller` | autenticado | `config.manage` |
| `data_protection_officer` | autenticado | `config.manage` |
| `feature_flags` | autenticado | `config.manage` |
| `app_settings` | `is_institutional()` | `config.manage` |

---

## Unidades

### `organizational_units`
| Op | Política | Regla |
|---|---|---|
| SELECT | `ou_sel` | autenticado **con MFA** (`app.is_mfa()`). Devuelve el árbol para navegar y para el asistente de importación. |
| ALL | `ou_mgmt` | `unit.manage` (solo `superadmin`) |

**El campo `rat_status` NO se cambia por UPDATE directo.** Trigger `trg_ou_status_guard → app.guard_unit_status_direct()` bloquea cualquier cambio de `rat_status` que no venga de `app.set_unit_rat_status()` (que marca `app.unit_status_rpc = 'on'`).

> El **estado** y los **KPIs de otras unidades** no se exponen por esta tabla a usuarios de unidad: se obtienen por `app.unit_dashboard(uuid)` / `app.institutional_dashboard()`, que verifican autorización. La fila de la unidad es visible (nombre, tipo, jerarquía) pero eso no revela avance ni actividades de otras unidades.

### `organizational_unit_aliases`, `organizational_unit_closure`, `unit_workflow_transitions`
SELECT para autenticado; escritura de alias con `unit.manage`. El cierre lo mantiene `app.rebuild_unit_closure()` (trigger de jerarquía).

### `unit_rat_status_transitions` — **Casos 3, 4, 5**
| Op | Regla |
|---|---|
| SELECT | `is_institutional()` **o** unidad ∈ `user_unit_ids()` |
| INSERT | ninguna política → solo `app.set_unit_rat_status()` |

`app.set_unit_rat_status(unit, to, comment)` exige: MFA + (`app.is_jefe_of(unit)` **o** `unit.status.manage`) + transición válida en `unit_workflow_transitions`.
- Colaborador → no es jefe, no tiene `unit.status.manage` ⇒ **42501** (Caso 3).
- Jefe de A sobre A ⇒ **permitido** (Caso 4).
- Jefe de A sobre B ⇒ `is_jefe_of(B)=false` ⇒ **42501** (Caso 5).

### Seguimiento del proyecto (`unit_engagements`, `engagement_contacts`, `project_phases`)
| Op | Regla |
|---|---|
| SELECT | `tracking.read.all` **o** unidad ∈ `user_unit_ids()` |
| Escritura | `tracking.manage` (institucional) |

Módulo **separado** del RAT: es la gestión de proyecto del DPD, no el autorreporte de la unidad.

---

## Catálogos
`legal_bases`, `data_categories`, `subject_categories`, `recipient_types`, `security_measures`, `transfer_guarantee_types`, `retention_criteria`, `campuses`:
SELECT con `app.is_mfa()`; escritura `config.manage`.

---

## Actividades de tratamiento — **Casos 1, 2, 8, 9**

### `processing_activities`
| Op | Política | Regla |
|---|---|---|
| SELECT | `pa_sel` | `is_mfa()` **y** ( `activity.read.all` **o** `responsible_unit_id ∈ user_unit_ids()` ) |
| INSERT | `pa_ins` | `is_mfa()` **y** `activity.create` **y** `responsible_unit_id ∈ user_unit_ids()` — solo en su unidad |
| UPDATE | `pa_upd` | `is_mfa()` **y** ( `activity.update.all` **o** (unidad propia **y** `activity.update.own_unit` **y** estado editable) ); `WITH CHECK` impide moverla a otra unidad |
| DELETE | — | sin política → nadie por API (borrado lógico vía RPC institucional) |

- Caso 1: usuario de A hace `SELECT id = <actividad de B>` ⇒ `pa_sel` no matchea ⇒ **0 filas**.
- Caso 2: `UPDATE ... where id = <B>` ⇒ `pa_upd USING` no matchea ⇒ **0 filas afectadas** (no error).
- Caso 8: conocer el UUID no ayuda — la política se evalúa por fila.
- Caso 9: `where responsible_unit_id = <B>` ⇒ `FORCE RLS` filtra igual ⇒ **0 filas**.

### Colecciones hijas
`activity_intervening_units`, `activity_legal_bases`, `activity_data_categories`, `activity_subject_categories`, `activity_recipients`, `activity_transfers`, `activity_security_measures`, `activity_automated_decisions`, `activity_attachments`:

| Op | Regla |
|---|---|
| SELECT | `app.parent_activity_visible(activity_id)` — la actividad padre es visible para mí |
| INSERT/UPDATE/DELETE | `app.parent_activity_editable(activity_id)` — padre en mi unidad, permiso `activity.update.*`, estado editable |

### Workflow / revisión
| Tabla | SELECT | Escritura |
|---|---|---|
| `workflow_transitions` | autenticado | — (config por migración) |
| `activity_status_transitions` | actividad visible | — (solo `app.set_activity_status()`) |
| `activity_reviews` | actividad visible | `activity.review` (institucional) |
| `review_observations` | actividad visible | INSERT `activity.review`; UPDATE `activity.review` **o** el responsable de la unidad (para marcarla resuelta) |
| `activity_versions` | actividad visible | — (solo funciones de versionado) |

---

## Auditoría

### `audit_log`
| Op | Política | Regla |
|---|---|---|
| SELECT | `audit_sel` | `audit.read` (institucional) **o** ( `audit.read.own_unit` **y** `unit_id ∈ user_unit_ids()` ) |
| INSERT/UPDATE/DELETE | — | ninguna política; además `REVOKE UPDATE, DELETE, TRUNCATE` a nivel de `GRANT`. Escritura exclusiva de `app.write_audit()` (`SECURITY DEFINER`). |

Cadena de hash `prev_hash → row_hash`; `app.verify_audit_chain()` (permiso `audit.read`) detecta rupturas.

---

## Importación

`import_batches`, `import_column_mappings`, `import_rows_staging`:
ALL con `import.execute` (institucional). `app.import_commit()` crea contactos de seguimiento y **borradores** — nunca publica ni aprueba actividades.

---

## Indicadores

| Tabla / RPC | Regla |
|---|---|
| `unit_kpi_cache` | SELECT: `is_institutional()` **o** unidad ∈ `user_unit_ids()` |
| `app.unit_dashboard(uuid)` | MFA + `app.can_see_unit(uuid)` — si no, **404** (`no_data_found`) — Casos 1, 8 |
| `app.institutional_dashboard()` | MFA + `institutional.view` — si no, **42501** — Casos 6, 7 |

Ninguna vista materializada institucional es legible por RLS para usuarios de unidad (D14).

---

## Mapa de la matriz de pruebas → mecanismo

| Caso | Mecanismo |
|---|---|
| 1 | `pa_sel` |
| 2 | `pa_upd` (`USING` + `WITH CHECK`) |
| 3 | `app.set_unit_rat_status()` — falla `is_jefe_of` / `unit.status.manage` |
| 4 | `app.set_unit_rat_status()` — `is_jefe_of(A)` verdadero |
| 5 | `app.set_unit_rat_status()` — `is_jefe_of(B)` falso |
| 6 | `app.institutional_dashboard()` — falta `institutional.view` |
| 7 | `app.institutional_dashboard()` — tiene `institutional.view` |
| 8 | `app.unit_dashboard()` / `pa_sel` — el UUID no ayuda |
| 9 | `FORCE ROW LEVEL SECURITY` + `pa_sel` |
| 10 | `ur_ins`/`ur_upd` (requiere `user.manage`) + trigger `guard_no_self_role_escalation` |
| Extra: sin MFA | `app.is_mfa()` en toda política de lectura |
| Extra: jefe A asigna a B | `uua_ins` requiere `user.manage` |

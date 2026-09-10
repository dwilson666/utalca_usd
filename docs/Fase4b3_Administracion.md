# Fase 4b.3 — Administración

Fecha: 2026-09-10 · Rama: `main`

## 1. Permisos de edición de RAT diferenciados (lo central del encargo §5)

**Antes**: editar un RAT se autorizaba por el permiso de rol global
(`activity.update.own_unit`) + pertenencia a la unidad. `user_unit_assignments.unit_role`
solo se consultaba para el estado de la unidad. No se podía tener un miembro de solo
lectura si su rol global permitía editar.

**Ahora** (`supabase/migrations/20260909120121_unit_role_edit_rights.sql`):

```
editar RAT de la unidad U  =
   rol institucional con activity.update.all
   Ó ( permiso activity.update.own_unit (del rol)
       Y asignación a U con unit_role ∈ {jefe, colaborador} )
```

| `unit_role`   | ver RAT | crear/editar RAT | enviar a revisión | estado de la unidad |
|---------------|:-------:|:----------------:|:-----------------:|:-------------------:|
| jefe          |   ✓     |        ✓         |        ✓          |         ✓           |
| colaborador   |   ✓     |        ✓         |        ✓          |         ✗           |
| consulta      |   ✓     |        ✗         |        ✗          |         ✗           |

- `pa_sel` (ver) **no cambia**: cualquier miembro —incluida `consulta`— sigue viendo
  los RAT de su unidad. Solo se restringe la escritura.
- Nuevas funciones `app.editor_unit_ids()` y `app.can_edit_unit_activities(uuid)`
  (SECURITY DEFINER, invocadas por RLS; no expuestas como RPC).
- Reescritas: políticas `pa_ins` / `pa_upd`, `app.parent_activity_editable`,
  `app.set_activity_status` (las transiciones de edición exigen poder editar),
  y `public.review_resolve_observation` (resolver = acción de edición).
- Se mantiene: deny-by-default, FORCE RLS, aislamiento entre unidades, y que el
  estado de la unidad solo lo mueve el jefe/autorizado.

**Resultado**: un administrador puede dar a alguien el rol **Colaborador** + una
unidad con `unit_role` **Colaborador** → esa persona crea y edita los RAT de esa
unidad **sin ser Superadministrador**.

## 2. Consolas de administración (frontend)

Todas bajo `RequirePermission` y respaldadas por RLS (`user.manage` / `unit.manage`
/ `config.manage`).

- **`/admin/usuarios`** (`pages/admin/Users.tsx`) — por persona: rol global
  (un rol por persona; revoca/reactiva), y lista de asignaciones a unidades
  (unidad + `unit_role` + «incluye subunidades»), con alta/edición/baja. La fila
  del propio usuario tiene los controles deshabilitados (anti-autoelevación, que
  además el trigger `trg_ur_no_self` / `trg_uua_no_self` y la RLS refuerzan).
- **`/admin/catalogos`** (`pages/admin/Catalogs.tsx`) — 7 catálogos en pestañas;
  edición de etiqueta/descripción, alta de valores, **desactivación lógica**
  (`status` active/deprecated — nunca se borran los que están en uso), y toggles
  de banderas (reforzada / sensible / grupo protegido / encargado).
- **`/admin/unidades`** (`pages/admin/Units.tsx`) — árbol organizacional; renombrar
  (`name_short` / `name_official`), crear subunidad, y confirmar los nodos marcados
  «por revisar» (`status='needs_review'` → `active`). La reasignación de unidad
  padre queda fuera de alcance por ahora (afecta al cierre transitivo).

`apps/web/src/lib/adminApi.ts` concentra el acceso a datos.

## 3. Archivos

**Nuevos**: `supabase/migrations/20260909120121_unit_role_edit_rights.sql`,
`supabase/tests/authz_permisos_test.sql`, `apps/web/src/lib/adminApi.ts`,
`apps/web/src/pages/admin/{Users,Catalogs,Units}.tsx`, `docs/Fase4b3_Administracion.md`
**Modificados**: `apps/web/src/router.tsx` (rutas admin reales en vez de stubs)

## 4. Migración ejecutada en la nube

`20260909120121_unit_role_edit_rights` aplicada y registrada.

## 5. Pruebas

Local (PostgreSQL portátil + shim + pgTAP 1.3.3):

```
authz_matrix_test.sql ...... 15/15 ok   (sin regresiones)
authz_wizard_test.sql ......  9/9  ok
authz_review_test.sql ......  10/10 ok
authz_permisos_test.sql ....  15/15 ok   ← nuevo
                            ────────────
                              49/49 ok
```

`authz_permisos_test.sql` cubre §13 del encargo: consulta NO crea/edita/agrega
hijas/cambia estado ❌ pero SÍ ve ✓ · colaborador crea y edita ✓ y marca
EN_COMPLETADO ✓ · jefe cambia estado de unidad ✓ / colaborador no ❌ · un usuario
no cambia su propio unit_role ❌ · superadmin edita cualquier RAT ✓.

**Verificación funcional** (dev server sobre la BD en la nube): desde
`/admin/usuarios` se asignó a `edvasquez@utalca.cl` el rol Colaborador y la unidad
Bibliotecas con `unit_role` Colaborador → ahora puede editar los RAT de Bibliotecas
sin privilegios de Superadmin. Catálogos y árbol de unidades cargan y editan.

## 6. Pendientes / a continuación

- **4b.4 — Importación y seguimiento**: staging + curación manual + importación de
  actividades a staging (nunca publica RAT directo) + contactos + engagements + etapas.
- Reasignación de unidad padre en `/admin/unidades` (requiere `app.rebuild_unit_closure`).
- Alta de cuentas nuevas: hoy `edvasquez` ya existía; para nuevas cuentas está el
  enlace de auto-registro. Desplegar `users-invite` cuando haya token `sbp_`.
- **4b.5 — Entregables**: exportación XLSX/PDF, consola de auditoría, diff de versiones.

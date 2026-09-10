# Fase 4b.0 — Estabilización (revisión Cloudflare + rutas + autorización)

Fecha: 2026-09-10 · Rama: `main` · Despliegue: `rat-utalca.pages.dev`

## 1. Infraestructura Cloudflare Pages

| Punto revisado | Resultado |
|---|---|
| SPA fallback (`apps/web/public/_redirects` → `/* /index.html 200`) | ✅ presente y efectivo en producción |
| Refresh directo de `/institucional`, `/actividades`, `/actividades/:id`, `/unidad/:id`, `/admin/*` | ✅ 200, la app hidrata y enruta correctamente |
| Rutas protegidas tras refresh **sin sesión** | ✅ redirigen a `/login` (probado con `localStorage` limpio) |
| Persistencia de sesión entre navegaciones directas | ✅ (Supabase usa `localStorage` + PKCE; Cloudflare no toca cookies) |
| CORS frontend → Supabase (`kvscbbwpvunggwfzsbqq.supabase.co`) | ✅ sin errores; `apikey` embebida es la **anon** (pública por diseño) |
| Secretos en el bundle JS (`sb_secret_`, `service_role`, `RESEND`, `SUPABASE_SERVICE`, `sbp_`, cadenas `postgres://`) | ✅ ninguno; solo aparece 1× el JWT anónimo y funciones de la librería (`resend()`, `regenerateClientSecret`), no valores |
| Errores 400 observados en consola | Provienen de navegar manualmente a `/actividades/<código>` (no UUID) → PostgREST 400. Las llamadas reales de la app responden 200 |
| `deploy.yml` (build con `vars.VITE_*` + `VITE_APP_COMMIT`, deploy `wrangler@3`) | ✅ funcional (el despliegue de branding llegó a producción) |

**Conclusión:** la incorporación de Cloudflare **no rompió** rutas ni autenticación. No se requiere reemplazar ni reconfigurar la infraestructura.

### Hallazgos menores (no bloquean)
- `ActivityDetail` con `id` inválido/inexistente muestra "Error al cargar" genérico en vez de "no encontrado".
- Botón **Editar** en `ActivityDetail` usa `<a href>` (recarga completa) en vez de navegación SPA.
- Copy de `WizardStub` menciona "incremento 4a.2" — se reemplaza por el asistente real en 4b.1.

## 2. Usuarios y autorización

Estado en la base (nube) tras 4b.0:

| Correo | Rol (global) | Unidad | Notas |
|---|---|---|---|
| `david.wilson@utalca.cl` | `superadmin` | — | Unidad de Seguridad Digital |
| `alejandro.olea@utalca.cl` | `superadmin` | — | **antes `dpd_admin`**; se le otorgó `superadmin` y se revocó `dpd_admin` |
| `edvasquez@utalca.cl` | — | — | cuenta creada (profile existe); lista para asignación desde la consola 4b.3 |

- La asignación se hizo con `scripts/bootstrap_roles.sql` (idempotente) sobre la tabla canónica `user_roles` — **el mismo INSERT que hará la consola de Administración / `users-invite`** tras verificar `user.manage`. No se tocó el frontend ni se expusieron credenciales.
- Verificado en producción: Alejandro inicia sesión y obtiene "Superadministrador" con acceso institucional completo (Usuarios, Unidades, Catálogos, Auditoría).
- MFA sigue desactivado por `app_settings['auth.require_mfa'] = false` (desviación documentada en `Fase4a_Contrato_Autorizacion.md` §8bis para la fase de revisión). Debe reactivarse antes de datos reales.

## 3. Hallazgo arquitectónico para 4b.3 — permisos de edición diferenciados

**Situación actual:** la edición de una actividad RAT se autoriza en RLS
(`processing_activities` políticas `pa_ins` / `pa_upd`) por **permiso de rol global**
(`activity.update.own_unit` / `activity.update.all`) **+** pertenencia a la unidad
(`responsible_unit_id in (select app.user_unit_ids())`).

El campo por-asignación `user_unit_assignments.unit_role ∈ {jefe, colaborador, consulta}`
**solo** se consulta hoy para el estado de la unidad (`app.is_jefe_of`), **no** para editar actividades.

**Consecuencia:** no es posible tener un miembro de solo lectura (`consulta`) en una unidad
si su rol global incluye `activity.update.own_unit`.

**Plan (4b.3):** las políticas de escritura de actividades pasarán a exigir además que la
asignación del usuario a esa unidad sea `unit_role in ('jefe','colaborador')`, de modo que:

| `unit_role` | leer RAT | crear/editar RAT | enviar a revisión | estado de la unidad |
|---|---|---|---|---|
| `jefe` | ✅ | ✅ | ✅ | ✅ |
| `colaborador` | ✅ | ✅ | ✅ | ❌ |
| `consulta` | ✅ | ❌ | ❌ | ❌ |

Se hará vía nuevo helper `app.can_edit_unit_activities(unit)` + migración, manteniendo
deny-by-default, con nuevas pruebas pgTAP (requisito §13 del encargo).

## 4. Pruebas

- No se modificaron políticas RLS, RPCs de autorización ni el esquema de seguridad en 4b.0.
- Único cambio de backend previo (branding): `public.auth_policy()` ahora también devuelve
  `ui_default_theme` (aditivo, no relacionado con seguridad). Migración `20260909120117_ui_theme.sql`, ya aplicada en la nube.
- La suite `supabase test db` (15/15) se re-ejecuta en CI en cada push a `main`.

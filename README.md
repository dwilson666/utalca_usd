# Plataforma RAT · Universidad de Talca

Plataforma institucional para el **Registro de Actividades de Tratamiento (RAT)** de datos personales, bajo la Ley 21.719. Multiusuario, con **aislamiento efectivo entre unidades** y visión institucional consolidada solo para administradores autorizados.

Stack (capa gratuita): **Supabase** (PostgreSQL + Auth + RLS + Storage + Edge Functions) · frontend **React + TypeScript** en **Cloudflare Pages** · adjuntos en **Cloudflare R2**.

## Estado — Fase 4a (incremento en curso)

| Componente | Estado |
|---|---|
| Contrato de autorización y segregación | ✅ [`docs/Fase4a_Contrato_Autorizacion.md`](docs/Fase4a_Contrato_Autorizacion.md) |
| Migraciones PostgreSQL (esquema + RLS + funciones + triggers) | ✅ aplican sin error en PostgreSQL 16 — las 13 migraciones de `supabase/migrations/` |
| Seed (permisos, roles, catálogos, 106 unidades) | ✅ `supabase/seed.sql` + `supabase/seed/{units,engagements}.sql` |
| Suite de autorización — **15/15 pruebas en verde** (10 casos del contrato + 5 extras) | ✅ `supabase/tests/authz_matrix_test.sql` |
| Frontend `apps/web` (auth+MFA, shell, tableros, lista/detalle de actividad, transiciones) | ✅ `pnpm typecheck` + `vite build` OK |
| `packages/shared` (permisos, enums, Zod, helpers de authz) | ✅ typecheck OK |
| Edge Function `users-invite` | 🟡 escrita, sin `deno check` local |
| CI (GitHub Actions: db test + typecheck + build) | ✅ `.github/workflows/ci.yml` |
| Wizard de 9 pasos · importación · exportación · consola de auditoría · admin UI | ⏳ pendiente |

> Verificado en un **PostgreSQL 16 vanilla** con el shim `scripts/local_pg_shim.sql`
> (recrea el esquema `auth` de Supabase). No necesita Docker. Falta aplicar las
> migraciones al proyecto Supabase real y desplegar. Ver [`docs/PUESTA_EN_MARCHA.md`](docs/PUESTA_EN_MARCHA.md).

Documentos de fases previas (fuente de verdad), en [`docs/`](docs/): análisis (Fase 1), arquitectura (Fase 2), UX/UI (Fase 3) + `mockup_rat_utalca.html`, contrato de autorización (Fase 4a), políticas RLS, y puesta en marcha.

## Estructura

```
apps/web/            React + TS + Vite  (frontend, → Cloudflare Pages)
packages/shared/     tipos, enums, esquemas Zod, helpers de autorización (capa 1)
supabase/
  migrations/        13 archivos (timestamp_nombre.sql)  (esquema + RLS + RPC)
  functions/         Edge Functions (Deno)
  seed.sql           datos maestros
  tests/             pgTAP — matriz de autorización
scripts/             generadores (seed de unidades)
docs/                fases 1–4a + guías
```

## Requisitos

- Node ≥ 20 + pnpm (frontend). Portables instalados en `%USERPROFILE%\dev-tools`.
- [Supabase CLI](https://supabase.com/docs/guides/cli) (aplicar migraciones / desplegar).
- Docker **solo** si se quiere el stack local completo; alternativa sin Docker: `scripts/local_pg_shim.sql` + PostgreSQL vanilla.

## Puesta en marcha

Ver [`docs/PUESTA_EN_MARCHA.md`](docs/PUESTA_EN_MARCHA.md). Resumen:

```bash
pnpm install
pnpm typecheck && pnpm --filter @rat/web build   # frontend
# BD con Docker:
supabase start && supabase db reset && supabase test db
# BD sin Docker (PostgreSQL vanilla en PGHOST/PGPORT/…):
#   psql -f scripts/local_pg_shim.sql  →  migraciones  →  seed.sql  →  pgtap.sql  →  tests/authz_matrix_test.sql
```

Regenerar el seed de unidades tras editar el catálogo:

```bash
pnpm gen:units     # seed-data/organizational_units.v0.1.json → supabase/seed/units.sql
```

## Migraciones (`supabase/migrations/` — `<timestamp>_<nombre>.sql`, en orden)

| # | Nombre | Contenido |
|---|---|---|
| 01 | `foundation` | extensiones, esquema `app`, enums, identidad (`profiles`), RBAC (`roles`/`permissions`/`user_roles`/`user_unit_assignments`), config institucional |
| 02 | `org_units` | árbol de unidades + cierre transitivo + alias + **estado global de unidad** + seguimiento del proyecto |
| 03 | `catalogs` | vocabularios controlados |
| 04 | `processing_activities` | actividad de tratamiento + colecciones hijas + reglas de integridad |
| 05 | `workflow_activity` | máquina de estado de la **actividad** + completitud + `app.set_activity_status()` |
| 06 | `audit` | bitácora append-only + cadena de hash + `app.write_audit()` |
| 07 | `versioning` | snapshots inmutables + diff + restaurar |
| 08 | `auth_helpers` | **funciones de autorización** (`app.has_perm`, `app.is_institutional`, `app.user_unit_ids`, `app.is_jefe_of`, `app.can_see_unit`, `app.is_mfa`) |
| 09 | `rls_policies` | **CAPA 3** — RLS deny-by-default + `FORCE` en toda tabla + anti-autoelevación |
| 10 | `dashboards_rpc` | `app.set_unit_rat_status()`, `app.unit_dashboard()`, `app.institutional_dashboard()` (autorización explícita) |
| 11 | `import` | staging de importación (nunca publica actividades) |
| 12 | `grants` | normalización de privilegios (mínimo privilegio) |
| 13 | `public_api` | wrappers en `public` para exponer las RPC vía PostgREST |

## Principio rector

> Antes de cada decisión técnica: **¿puede una unidad acceder, directa o indirectamente, a información de otra unidad?** Si la respuesta es «sí», la implementación es incorrecta.

Autorización en tres capas — frontend (UX), Edge Functions / RPC (operaciones), **RLS en PostgreSQL (crítica)**. Ver el contrato.

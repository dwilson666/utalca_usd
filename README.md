# Plataforma RAT · Universidad de Talca

Plataforma institucional para el **Registro de Actividades de Tratamiento (RAT)** de datos personales, bajo la Ley 21.719. Multiusuario, con **aislamiento efectivo entre unidades** y visión institucional consolidada solo para administradores autorizados.

Stack (capa gratuita): **Supabase** (PostgreSQL + Auth + RLS + Storage + Edge Functions) · frontend **React + TypeScript** en **Cloudflare Pages** · adjuntos en **Cloudflare R2**.

## Estado — Fase 4a (incremento en curso)

| Componente | Estado |
|---|---|
| Contrato de autorización y segregación | ✅ [`docs/Fase4a_Contrato_Autorizacion.md`](docs/Fase4a_Contrato_Autorizacion.md) |
| Migraciones PostgreSQL (esquema + RLS + funciones + triggers) | ✅ aplican sin error en PostgreSQL 16 — `supabase/migrations/0001`–`0013` |
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
  migrations/        0001–0013  (esquema + RLS + RPC)
  functions/         Edge Functions (Deno)
  seed.sql           datos maestros
  tests/             pgTAP — matriz de autorización
scripts/             generadores (seed de unidades)
docs/                fases 1–4a + guías
```

## Requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 1.200
- Docker (para el stack local)
- Node ≥ 20 + pnpm (para el frontend, cuando exista)

## Puesta en marcha (local)

```bash
supabase start                # levanta Postgres + Auth + Studio local
supabase db reset             # aplica migrations 0001–0012 + seed.sql
supabase test db              # corre supabase/tests/*.sql (pgTAP) → deben pasar los 10 casos
```

Regenerar el seed de unidades tras editar el catálogo:

```bash
python scripts/gen_units_seed.py     # seed-data/organizational_units.v0.1.json → supabase/seed/units.sql
```

## Orden de las migraciones

| # | Archivo | Contenido |
|---|---|---|
| 0001 | `foundation.sql` | extensiones, esquema `app`, enums, identidad (`profiles`), RBAC (`roles`/`permissions`/`user_roles`/`user_unit_assignments`), config institucional |
| 0002 | `org_units.sql` | árbol de unidades + cierre transitivo + alias + **estado global de unidad** + seguimiento del proyecto |
| 0003 | `catalogs.sql` | vocabularios controlados |
| 0004 | `processing_activities.sql` | actividad de tratamiento + colecciones hijas + reglas de integridad |
| 0005 | `workflow_activity.sql` | máquina de estado de la **actividad** + completitud + `app.set_activity_status()` |
| 0006 | `audit.sql` | bitácora append-only + cadena de hash + `app.write_audit()` |
| 0007 | `versioning.sql` | snapshots inmutables + diff + restaurar |
| 0008 | `auth_helpers.sql` | **funciones de autorización** (`app.has_perm`, `app.is_institutional`, `app.user_unit_ids`, `app.is_jefe_of`, `app.can_see_unit`, `app.is_mfa`) |
| 0009 | `rls_policies.sql` | **CAPA 3** — RLS deny-by-default + `FORCE` en toda tabla + anti-autoelevación |
| 0010 | `dashboards_rpc.sql` | `app.set_unit_rat_status()`, `app.unit_dashboard()`, `app.institutional_dashboard()` (autorización explícita) |
| 0011 | `import.sql` | staging de importación (nunca publica actividades) |
| 0012 | `grants.sql` | normalización de privilegios (mínimo privilegio) |

## Principio rector

> Antes de cada decisión técnica: **¿puede una unidad acceder, directa o indirectamente, a información de otra unidad?** Si la respuesta es «sí», la implementación es incorrecta.

Autorización en tres capas — frontend (UX), Edge Functions / RPC (operaciones), **RLS en PostgreSQL (crítica)**. Ver el contrato.

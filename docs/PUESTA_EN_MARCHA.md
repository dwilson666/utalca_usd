# Puesta en marcha

El código de la Fase 4a **no se pudo compilar ni probar en la máquina donde se generó** (sin Node, Docker, Supabase CLI ni psql). Hay dos caminos para validarlo y correrlo.

---

## Camino A — Entorno local (Windows)

### 1. Instalar herramientas

```powershell
winget install OpenJS.NodeJS.LTS          # Node 20
winget install Docker.DockerDesktop        # necesario para el stack local de Supabase
winget install Supabase.CLI                # o: scoop install supabase
corepack enable                            # habilita pnpm
```

Reiniciar la terminal. Verificar: `node -v`, `docker -v`, `supabase -v`, `pnpm -v`.

### 2. Base de datos

```powershell
cd rat_institucional
supabase start            # levanta Postgres + Auth + Studio (Docker)
supabase db reset         # aplica migrations 0001–0013 + seed.sql
supabase test db          # ► corre supabase/tests/authz_matrix_test.sql (10 casos)
```

`supabase status` muestra las claves locales. Copiar en `apps/web/.env`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key de "supabase status">
```

### 3. Frontend

```powershell
pnpm install
pnpm -r typecheck
pnpm dev                  # http://localhost:5173
```

> Con `enable_signup = false` no hay auto-registro. Para probar, crear un usuario
> desde Supabase Studio (Auth → Add user) y asignarle rol/unidad con SQL:
> ```sql
> insert into user_roles (user_id, role_id, scope)
>   select '<uuid>', id, 'unit' from roles where code = 'unit_manager';
> insert into user_unit_assignments (user_id, unit_id, unit_role)
>   select '<uuid>', id, 'jefe' from organizational_units where code = 'VRA';
> ```

### 4. Edge Functions

```powershell
supabase functions serve users-invite --env-file supabase/functions/.env
```

---

## Camino B — Sin instalar nada localmente (GitHub + nube)

### 1. Repositorio

```powershell
cd rat_institucional
git init && git add -A && git commit -m "Fase 4a: DB + RLS + authz suite + web scaffold"
git branch -M main
git remote add origin https://github.com/<org>/rat-institucional.git
git push -u origin main
```

Al hacer push, **GitHub Actions** (`.github/workflows/ci.yml`) ejecuta:
- `database`: `supabase db reset` + **`supabase test db`** → los 10 casos de autorización.
- `web`: `pnpm typecheck` + `vite build`.
- `functions`: `deno check`.

Esto valida todo **sin instalar nada en tu equipo**.

### 2. Proyecto Supabase (capa gratuita)

1. Crear proyecto en [supabase.com](https://supabase.com) (región `South America (São Paulo)` — la más cercana; ver nota de residencia de datos en el contrato §D7).
2. En el repo: `supabase link --project-ref <ref>` y `supabase db push` (necesita la CLI una vez; o pegar las migraciones en el **SQL Editor** del dashboard en orden 0001→0013, luego `seed.sql`).
3. Dashboard → Authentication → Providers: deshabilitar "Enable email signup"; Authentication → MFA: habilitar TOTP.
4. Copiar `URL` y `anon key` del proyecto.

### 3. Frontend en Cloudflare Pages (capa gratuita)

- Conectar el repo en Cloudflare Pages.
- Build command: `pnpm --filter @rat/web build` · Output: `apps/web/dist` · Root: `/`
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### 4. Edge Functions

```powershell
supabase functions deploy users-invite
supabase secrets set --env-file supabase/functions/.env   # service_role, etc.
```

---

## Qué debe verse cuando funcione

1. `supabase test db` → **14 checks en verde** (10 casos del contrato + 4 extras).
2. Login → challenge MFA → según el rol:
   - institucional → `/institucional` (tablero consolidado).
   - jefe/colaborador → `/unidad/<id>` (solo su unidad).
3. Un usuario de la Unidad A que fuerce `/unidad/<id-de-B>` o `/actividades/<uuid-de-B>` → "No encontrado" (y el backend devuelve 0 filas / 404, no 403).
4. Solo el jefe ve el control "Cambiar estado de la unidad".

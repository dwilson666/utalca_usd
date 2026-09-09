-- ════════════════════════════════════════════════════════════════════════════
-- local_pg_shim.sql — SOLO para probar sin Docker contra un PostgreSQL vanilla.
--   Recrea los objetos que Supabase provee (esquema auth, roles, extensions).
--   NUNCA ejecutar contra un proyecto Supabase real: allí ya existen.
--   Uso:  psql -v ON_ERROR_STOP=1 -f scripts/local_pg_shim.sql
--         luego migrations 0001..0013, luego supabase/seed.sql,
--         luego (opcional) pgtap.sql + supabase/tests/authz_matrix_test.sql
-- ════════════════════════════════════════════════════════════════════════════

create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls; end if;
end $$;
grant anon, authenticated, service_role to postgres;
grant usage on schema extensions to anon, authenticated, service_role;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}',
  raw_app_meta_data  jsonb not null default '{}',
  aud                text default 'authenticated',
  role               text default 'authenticated',
  created_at         timestamptz not null default now()
);

-- Equivalentes a las funciones de Supabase (leen el claim inyectado por PostgREST).
create or replace function auth.uid() returns uuid
language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon')
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
$$;

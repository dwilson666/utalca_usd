-- ════════════════════════════════════════════════════════════════════════════
-- 0001_foundation.sql — extensiones, esquema app, enums, identidad y RBAC
-- Plataforma RAT · Universidad de Talca · Fase 4a
-- ════════════════════════════════════════════════════════════════════════════

-- pgcrypto (digest/sha256 para la cadena de auditoría y hashes de versión).
-- En Supabase vive en el esquema `extensions`; las funciones que usan digest()
-- llevan `extensions` en su search_path.
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
comment on schema app is 'Funciones de autorización, workflow y utilidades del dominio RAT.';

-- ── timestamps utilitario ───────────────────────────────────────────────────
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  begin
    new.updated_by := auth.uid();
  exception when others then
    -- columna updated_by no existe en esta tabla: ignorar
    null;
  end;
  return new;
end $$;

-- ════════════════════════  ENUMS  ═══════════════════════════════════════════
create type unit_type as enum (
  'consejo','rectoria','contraloria','secretaria_general','vicerrectoria',
  'direccion_general','direccion','departamento','unidad','oficina','programa',
  'academia','sede','facultad','instituto','escuela','otro');

create type unit_status as enum ('active','inactive','merged');

-- Estado GLOBAL de la unidad dentro del proceso RAT (lo mueve el jefe / institucional)
create type unit_rat_status as enum (
  'PENDIENTE','EN_LEVANTAMIENTO','EN_REVISION','CON_OBSERVACIONES','COMPLETADA','CERRADA');

-- Estado de una ACTIVIDAD de tratamiento (lo mueve el responsable / DPD)
create type activity_status as enum (
  'BORRADOR','EN_COMPLETADO','EN_REVISION','OBSERVADO','CORREGIDO','APROBADO','CERRADO');

-- Rol del usuario DENTRO de una unidad
create type unit_role as enum ('jefe','colaborador','consulta');

create type role_scope as enum ('global','unit');

create type audit_action as enum (
  'login','login_failed','logout','mfa_enrolled',
  'create','update','delete','state_change','unit_state_change',
  'review','import','export','permission_grant','permission_revoke',
  'config_change','access_denied');

create type audit_result as enum ('success','denied','error');

create type import_batch_status as enum (
  'uploaded','parsed','mapped','validated','previewed','committed','failed');

create type import_row_class as enum ('activity_seed','contact','note','empty');
create type import_row_validation as enum ('valid','warning','error','discarded','imported');

-- ════════════════════════  IDENTIDAD  ══════════════════════════════════════
-- Espejo de auth.users. NUNCA guarda rol ni alcance (ver D12 del contrato).
create table profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  email        text not null,
  locale       text not null default 'es-CL',
  status       text not null default 'invited' check (status in ('invited','active','suspended')),
  mfa_enrolled boolean not null default false,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table profiles is 'Perfil de aplicación. El rol y las unidades del usuario NO viven aquí (ver user_roles / user_unit_assignments).';

create trigger trg_profiles_touch before update on profiles
  for each row execute function app.touch_updated_at();

-- Al crearse un usuario en auth.users, crear su profile vacío (sin rol).
create or replace function app.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- ════════════════════════  RBAC  ═══════════════════════════════════════════
create table roles (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,     -- superadmin | dpd_admin | auditor | unit_manager | collaborator
  name        text not null,
  description text,
  is_system   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,     -- p.ej. activity.review, unit.status.manage
  category    text not null,
  description text
);

create table role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Asignación de rol RBAC. scope='global' solo para roles institucionales.
create table user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role_id    uuid not null references roles(id) on delete restrict,
  scope      role_scope not null default 'unit',
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, role_id)
);
create index on user_roles(user_id) where revoked_at is null;

-- Pertenencia a unidad + rol dentro de la unidad (jefe / colaborador / consulta)
create table user_unit_assignments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  unit_id             uuid not null,   -- FK añadida en 0002 (org_units aún no existe)
  unit_role           unit_role not null default 'colaborador',
  includes_descendants boolean not null default false,
  granted_by          uuid references auth.users(id),
  valid_from          timestamptz not null default now(),
  valid_to            timestamptz,
  created_at          timestamptz not null default now(),
  unique (user_id, unit_id)
);
create index on user_unit_assignments(user_id) where valid_to is null;
create index on user_unit_assignments(unit_id);

-- ── config institucional ────────────────────────────────────────────────────
create table institutional_controller (
  id                 int primary key default 1 check (id = 1),
  legal_name         text not null default 'Universidad de Talca',
  rut                text,
  address            text,
  legal_representative text,
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);

create table data_protection_officer (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  unit_label  text,
  email       citext,
  address     text,
  valid_from  date not null default now(),
  valid_to    date
);

create table feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- ════════════════════════════════════════════════════════════════════════════
-- 0008_auth_helpers.sql — funciones de autorización (esquema app)
--   Base de las 3 capas. La capa 3 (RLS, 0009) las usa en cada política.
--   El rol y el alcance SIEMPRE se derivan de tablas del servidor
--   (user_roles / user_unit_assignments), NUNCA del cliente (ver D12).
-- ════════════════════════════════════════════════════════════════════════════

-- id del usuario autenticado
create or replace function app.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

-- ¿la sesión superó el segundo factor?  (claim aal = 'aal2')
create or replace function app.is_mfa() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
    'aal1'
  ) = 'aal2'
$$;

-- ¿tiene el permiso p por alguno de sus roles vigentes?
create or replace function app.has_perm(p text) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions pe on pe.id = rp.permission_id
    where ur.user_id = auth.uid()
      and ur.revoked_at is null
      and pe.code = p
  )
$$;

-- ¿rol de alcance INSTITUCIONAL vigente?
create or replace function app.is_institutional() returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.revoked_at is null
      and ur.scope = 'global'
      and r.code in ('superadmin','dpd_admin','auditor')
  )
$$;

-- unidades a las que el usuario tiene alcance (directas ∪ descendientes)
create or replace function app.user_unit_ids() returns setof uuid
language sql stable security definer set search_path = app, public as $$
  with direct as (
    select uua.unit_id, uua.includes_descendants
    from user_unit_assignments uua
    where uua.user_id = auth.uid()
      and (uua.valid_to is null or uua.valid_to > now())
  )
  select unit_id from direct
  union
  select c.descendant_id
  from direct d
  join organizational_unit_closure c on c.ancestor_id = d.unit_id
  where d.includes_descendants
$$;

-- ¿el usuario puede VER esta unidad?  (institucional o miembro)
create or replace function app.can_see_unit(u uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select app.is_institutional() or u in (select app.user_unit_ids())
$$;

-- ¿el usuario es JEFE de esta unidad (directo o vía ancestro con includes_descendants)?
create or replace function app.is_jefe_of(u uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1
    from user_unit_assignments uua
    where uua.user_id = auth.uid()
      and uua.unit_role = 'jefe'
      and (uua.valid_to is null or uua.valid_to > now())
      and (
        uua.unit_id = u
        or (uua.includes_descendants and exists (
              select 1 from organizational_unit_closure c
              where c.ancestor_id = uua.unit_id and c.descendant_id = u))
      )
  )
$$;

-- Vista de permisos efectivos del usuario actual (la usa el frontend para
-- pintar/ocultar — capa 1, nunca frontera de seguridad).
create or replace function app.my_authz() returns jsonb
language sql stable security definer set search_path = app, public as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'mfa', app.is_mfa(),
    'institutional', app.is_institutional(),
    'permissions', coalesce((
      select jsonb_agg(distinct pe.code)
      from user_roles ur
      join role_permissions rp on rp.role_id = ur.role_id
      join permissions pe on pe.id = rp.permission_id
      where ur.user_id = auth.uid() and ur.revoked_at is null), '[]'),
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'unit_id', uua.unit_id, 'code', ou.code, 'name', ou.name_short,
        'unit_role', uua.unit_role, 'includes_descendants', uua.includes_descendants))
      from user_unit_assignments uua
      join organizational_units ou on ou.id = uua.unit_id
      where uua.user_id = auth.uid()
        and (uua.valid_to is null or uua.valid_to > now())), '[]')
  )
$$;

-- ── permisos de ejecución ──────────────────────────────────────────────────
-- La normalización definitiva de GRANT/REVOKE sobre app.* está en
-- 0012_grants.sql (se ejecuta después de crear TODAS las funciones).
grant usage on schema app to authenticated;

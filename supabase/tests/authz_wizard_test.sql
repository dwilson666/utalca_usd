-- ════════════════════════════════════════════════════════════════════════════
-- authz_wizard_test.sql — Fase 4b.1 · autorización de creación/edición de RAT
--   Complementa authz_matrix_test.sql. Corre con:  supabase test db
--   Cubre §13 del encargo 4b (creación por unidad, aislamiento, rol institucional).
-- ════════════════════════════════════════════════════════════════════════════
begin;
create schema if not exists tests;
select plan(9);

create or replace function tests.act_as(p_user uuid, p_aal text default 'aal2')
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;
create or replace function tests.act_as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end $$;
grant usage on schema tests to public;
grant execute on all functions in schema tests to public;

select tests.act_as_postgres();
update app_settings set value = 'true'::jsonb where key = 'auth.require_mfa';

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('4b100000-0000-4000-a000-000000000001','wiz.colab.a@utalca.cl','authenticated','authenticated','{}'),
  ('4b100000-0000-4000-a000-000000000002','wiz.jefe.b@utalca.cl','authenticated','authenticated','{}'),
  ('4b100000-0000-4000-a000-000000000003','wiz.super@utalca.cl','authenticated','authenticated','{}'),
  ('4b100000-0000-4000-a000-000000000004','wiz.auditor@utalca.cl','authenticated','authenticated','{}')
on conflict (id) do nothing;

-- t_wiz solo se usa en el SETUP (rol postgres); igual se concede por si acaso.
create temporary table t_wiz as
select
  (select id from organizational_units where code = 'VRA')  as unit_a,
  (select id from organizational_units where code = 'VGEA') as unit_b;
grant select on t_wiz to public;

insert into user_roles (user_id, role_id, scope) values
  ('4b100000-0000-4000-a000-000000000001',(select id from roles where code='collaborator'),'unit'),
  ('4b100000-0000-4000-a000-000000000002',(select id from roles where code='unit_manager'),'unit'),
  ('4b100000-0000-4000-a000-000000000003',(select id from roles where code='superadmin'),'global'),
  ('4b100000-0000-4000-a000-000000000004',(select id from roles where code='auditor'),'global');

insert into user_unit_assignments (user_id, unit_id, unit_role) values
  ('4b100000-0000-4000-a000-000000000001',(select id from organizational_units where code='VRA'),'colaborador'),
  ('4b100000-0000-4000-a000-000000000002',(select id from organizational_units where code='VGEA'),'jefe');

-- ── Colaborador de A ──────────────────────────────────────────────────────
select tests.act_as('4b100000-0000-4000-a000-000000000001');

-- 1 · crea una actividad en SU unidad → permitido
select lives_ok(
  $$ insert into processing_activities (id, responsible_unit_id, title, status)
     values ('4b1a0000-0000-4000-a000-000000000001',
             (select id from organizational_units where code='VRA'), 'RAT creado por colaborador A', 'BORRADOR') $$,
  '4b.1: colaborador de A crea una actividad en su unidad');

-- 2 · crea una actividad en la unidad B → denegado (RLS WITH CHECK)
select throws_ok(
  $$ insert into processing_activities (id, responsible_unit_id, title, status)
     values ('4b1a0000-0000-4000-a000-000000000002',
             (select id from organizational_units where code='VGEA'), 'RAT intruso en B', 'BORRADOR') $$,
  '42501', null, '4b.1: colaborador de A NO crea actividades en la unidad B');

-- 3 · edita su borrador → permitido
select lives_ok(
  $$ update processing_activities set purpose = 'Finalidad declarada'
     where id = '4b1a0000-0000-4000-a000-000000000001' $$,
  '4b.1: colaborador de A edita su propio borrador');

-- 4 · añade una colección hija a su borrador → permitido
select lives_ok(
  $$ insert into activity_data_categories (activity_id, data_category_id, is_sensitive)
     select '4b1a0000-0000-4000-a000-000000000001', id, false
     from data_categories where code = 'identificativos' $$,
  '4b.1: colaborador de A agrega colección hija a su borrador');

-- ── Jefe de B no toca lo de A ─────────────────────────────────────────────
select tests.act_as('4b100000-0000-4000-a000-000000000002');
select is(
  (select count(*)::int from processing_activities
   where id = '4b1a0000-0000-4000-a000-000000000001'),
  0, '4b.1: jefe de B NO ve el borrador de A');

select lives_ok(
  $$ update processing_activities set title = 'secuestrado'
     where id = '4b1a0000-0000-4000-a000-000000000001' $$,
  '4b.1: UPDATE de B sobre el borrador de A no afecta filas (RLS)');
select tests.act_as_postgres();
select is(
  (select title from processing_activities where id = '4b1a0000-0000-4000-a000-000000000001'),
  'RAT creado por colaborador A', '4b.1: el borrador de A quedó intacto');

-- ── Rol institucional (superadmin) crea en cualquier unidad ───────────────
select tests.act_as('4b100000-0000-4000-a000-000000000003');
select lives_ok(
  $$ insert into processing_activities (id, responsible_unit_id, title, status)
     values ('4b1a0000-0000-4000-a000-000000000003',
             (select id from organizational_units where code='VGEA'), 'RAT registrado por el DPD', 'BORRADOR') $$,
  '4b.1: superadmin (activity.update.all) crea una actividad en la unidad B');

-- ── Auditor (solo lectura) no crea ───────────────────────────────────────
select tests.act_as('4b100000-0000-4000-a000-000000000004');
select throws_ok(
  $$ insert into processing_activities (id, responsible_unit_id, title, status)
     values ('4b1a0000-0000-4000-a000-000000000004',
             (select id from organizational_units where code='VRA'), 'RAT de auditor', 'BORRADOR') $$,
  '42501', null, '4b.1: el auditor (sin activity.create) NO crea actividades');

select * from finish();
rollback;

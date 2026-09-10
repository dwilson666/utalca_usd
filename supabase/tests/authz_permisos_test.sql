-- ════════════════════════════════════════════════════════════════════════════
-- authz_permisos_test.sql — Fase 4b.3 · permisos de edición de RAT por unit_role
--   Corre con:  supabase test db
--   Regla: editar RAT de U  =  activity.update.all  Ó
--          ( activity.update.own_unit  Y  unit_role∈{jefe,colaborador} en U )
-- ════════════════════════════════════════════════════════════════════════════
begin;
create schema if not exists tests;
select plan(15);

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
  ('4b300000-0000-4000-a000-000000000001','p.colab.a@utalca.cl','authenticated','authenticated','{}'),
  ('4b300000-0000-4000-a000-000000000002','p.consulta.a@utalca.cl','authenticated','authenticated','{}'),
  ('4b300000-0000-4000-a000-000000000003','p.jefe.a@utalca.cl','authenticated','authenticated','{}'),
  ('4b300000-0000-4000-a000-000000000004','p.super@utalca.cl','authenticated','authenticated','{}')
on conflict (id) do nothing;

-- todos con rol que otorga activity.update.own_unit (collaborator); el jefe con unit_manager
insert into user_roles (user_id, role_id, scope) values
  ('4b300000-0000-4000-a000-000000000001',(select id from roles where code='collaborator'),'unit'),
  ('4b300000-0000-4000-a000-000000000002',(select id from roles where code='collaborator'),'unit'),
  ('4b300000-0000-4000-a000-000000000003',(select id from roles where code='unit_manager'),'unit'),
  ('4b300000-0000-4000-a000-000000000004',(select id from roles where code='superadmin'),'global');

insert into user_unit_assignments (user_id, unit_id, unit_role) values
  ('4b300000-0000-4000-a000-000000000001',(select id from organizational_units where code='VRA'),'colaborador'),
  ('4b300000-0000-4000-a000-000000000002',(select id from organizational_units where code='VRA'),'consulta'),
  ('4b300000-0000-4000-a000-000000000003',(select id from organizational_units where code='VRA'),'jefe');

insert into processing_activities (id, responsible_unit_id, title, status) values
  ('4b3a0000-0000-4000-a000-0000000000a1',(select id from organizational_units where code='VRA'),'RAT base de la unidad A','BORRADOR');

-- ── consulta: NO crea ni edita, pero SÍ ve ───────────────────────────────
select tests.act_as('4b300000-0000-4000-a000-000000000002');

select throws_ok(
  $$ insert into processing_activities (id, responsible_unit_id, title, status)
     values ('4b3a0000-0000-4000-a000-0000000000c1',
             (select id from organizational_units where code='VRA'), 'RAT de consulta', 'BORRADOR') $$,
  '42501', null, '4b.3: unit_role=consulta NO crea RAT (aunque el rol dé activity.update.own_unit)');

select is(
  (select count(*)::int from processing_activities where id = '4b3a0000-0000-4000-a000-0000000000a1'),
  1, '4b.3: unit_role=consulta SÍ ve los RAT de su unidad');

select lives_ok(
  $$ update processing_activities set purpose = 'editado por consulta'
     where id = '4b3a0000-0000-4000-a000-0000000000a1' $$,
  '4b.3: UPDATE de consulta no afecta filas (RLS filtra en USING)');
select tests.act_as_postgres();
select is(
  (select purpose from processing_activities where id = '4b3a0000-0000-4000-a000-0000000000a1'),
  null, '4b.3: el RAT quedó sin cambios tras el intento de consulta');

select tests.act_as('4b300000-0000-4000-a000-000000000002');
select throws_ok(
  $$ insert into activity_data_categories (activity_id, data_category_id, is_sensitive)
     select '4b3a0000-0000-4000-a000-0000000000a1', id, false
     from data_categories where code = 'identificativos' $$,
  '42501', null, '4b.3: unit_role=consulta NO agrega colecciones hijas');

select throws_ok(
  $$ select app.set_activity_status('4b3a0000-0000-4000-a000-0000000000a1', 'EN_COMPLETADO', null) $$,
  '42501', null, '4b.3: unit_role=consulta NO cambia el estado de la actividad');

-- ── colaborador: crea y edita ───────────────────────────────────────────
select tests.act_as('4b300000-0000-4000-a000-000000000001');
select lives_ok(
  $$ insert into processing_activities (id, responsible_unit_id, title, status)
     values ('4b3a0000-0000-4000-a000-0000000000b1',
             (select id from organizational_units where code='VRA'), 'RAT de colaborador', 'BORRADOR') $$,
  '4b.3: unit_role=colaborador crea RAT en su unidad');

select lives_ok(
  $$ update processing_activities set purpose = 'editado por colaborador'
     where id = '4b3a0000-0000-4000-a000-0000000000a1' $$,
  '4b.3: unit_role=colaborador edita el RAT de su unidad');
select tests.act_as_postgres();
select is(
  (select purpose from processing_activities where id = '4b3a0000-0000-4000-a000-0000000000a1'),
  'editado por colaborador', '4b.3: el cambio del colaborador sí quedó');

select tests.act_as('4b300000-0000-4000-a000-000000000001');
select is(
  (select app.set_activity_status('4b3a0000-0000-4000-a000-0000000000a1', 'EN_COMPLETADO', null))::text,
  'EN_COMPLETADO', '4b.3: unit_role=colaborador marca la actividad EN_COMPLETADO');

-- ── jefe: cambia el estado de su unidad; colaborador no ─────────────────
select tests.act_as('4b300000-0000-4000-a000-000000000003');
select lives_ok(
  $$ select app.set_unit_rat_status(
       (select id from organizational_units where code='VRA'), 'EN_LEVANTAMIENTO', 'inicio') $$,
  '4b.3: unit_role=jefe cambia el estado de su unidad');

select tests.act_as('4b300000-0000-4000-a000-000000000001');
select throws_ok(
  $$ select app.set_unit_rat_status(
       (select id from organizational_units where code='VRA'), 'EN_REVISION', null) $$,
  '42501', null, '4b.3: unit_role=colaborador NO cambia el estado de la unidad');

-- ── §13 administración: un usuario común no se autoeleva ────────────────
--   Sin `user.manage`, la RLS filtra la fila (0 cambios); con `user.manage`,
--   el trigger trg_uua_no_self lo bloquea igual (ver authz_matrix_test Extra 4).
select tests.act_as('4b300000-0000-4000-a000-000000000002');
select lives_ok(
  $$ update user_unit_assignments set unit_role = 'colaborador'
     where user_id = '4b300000-0000-4000-a000-000000000002' $$,
  '4b.3: el UPDATE del propio unit_role no afecta filas (RLS user.manage)');
select tests.act_as_postgres();
select is(
  (select unit_role::text from user_unit_assignments
   where user_id = '4b300000-0000-4000-a000-000000000002'),
  'consulta', '4b.3: el unit_role del usuario siguió siendo consulta');

-- ── superadmin: edita cualquier RAT ────────────────────────────────────
select tests.act_as('4b300000-0000-4000-a000-000000000004');
select lives_ok(
  $$ update processing_activities set description = 'revisado por el DPD'
     where id = '4b3a0000-0000-4000-a000-0000000000a1' $$,
  '4b.3: superadmin (activity.update.all) edita el RAT de cualquier unidad');

select * from finish();
rollback;

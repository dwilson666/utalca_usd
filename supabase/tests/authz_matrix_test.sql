-- ════════════════════════════════════════════════════════════════════════════
-- authz_matrix_test.sql — CRITERIO DE ACEPTACIÓN de la Fase 4 (§7 del contrato)
--   Corre con:  supabase test db      (pgTAP; stack local de Supabase)
--   La Fase 4 NO se cierra hasta que los 10 casos + extras pasen en verde.
--   Requiere que el seed (roles, permisos, unidades VRA/VGEA) esté aplicado.
-- ════════════════════════════════════════════════════════════════════════════
begin;
create schema if not exists tests;
select plan(16);

-- ── helper de identidad ───────────────────────────────────────────────────
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

-- ── fixtures ──────────────────────────────────────────────────────────────
-- ids fijos
--   unidad A = Vicerrectoría Académica (VRA) · unidad B = VGEA
select tests.act_as_postgres();

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1','jefe.a@utalca.cl','authenticated','authenticated','{"full_name":"Jefe A"}'),
  ('00000000-0000-0000-0000-0000000000a2','colab.a@utalca.cl','authenticated','authenticated','{"full_name":"Colaborador A"}'),
  ('00000000-0000-0000-0000-0000000000b1','jefe.b@utalca.cl','authenticated','authenticated','{"full_name":"Jefe B"}'),
  ('00000000-0000-0000-0000-0000000000d1','dpd@utalca.cl','authenticated','authenticated','{"full_name":"DPD"}')
on conflict (id) do nothing;

-- unidades A y B (deben existir por el seed)
create temporary table t_ids as
select
  (select id from organizational_units where code = 'VRA')  as unit_a,
  (select id from organizational_units where code = 'VGEA') as unit_b,
  (select id from roles where code = 'unit_manager') as role_jefe,
  (select id from roles where code = 'collaborator') as role_colab,
  (select id from roles where code = 'dpd_admin')    as role_dpd,
  (select id from roles where code = 'superadmin')   as role_super;

-- asignaciones (como postgres, bypassrls; auth.uid() es null → self-guard no aplica)
insert into user_roles (user_id, role_id, scope) values
  ('00000000-0000-0000-0000-0000000000a1',(select role_jefe  from t_ids),'unit'),
  ('00000000-0000-0000-0000-0000000000a2',(select role_colab from t_ids),'unit'),
  ('00000000-0000-0000-0000-0000000000b1',(select role_jefe  from t_ids),'unit'),
  ('00000000-0000-0000-0000-0000000000d1',(select role_dpd   from t_ids),'global');

insert into user_unit_assignments (user_id, unit_id, unit_role) values
  ('00000000-0000-0000-0000-0000000000a1',(select unit_a from t_ids),'jefe'),
  ('00000000-0000-0000-0000-0000000000a2',(select unit_a from t_ids),'colaborador'),
  ('00000000-0000-0000-0000-0000000000b1',(select unit_b from t_ids),'jefe');

-- actividades: una en A, una en B
insert into processing_activities (id, responsible_unit_id, title, status)
values
  ('00000000-0000-0000-0000-00000000ac0a',(select unit_a from t_ids),'Actividad de Unidad A','BORRADOR'),
  ('00000000-0000-0000-0000-00000000ac0b',(select unit_b from t_ids),'Actividad de Unidad B','BORRADOR');

-- ══════════════════════  CASOS  ══════════════════════════════════════════

-- Caso 1 — Usuario de A hace SELECT de una actividad de B → 0 filas
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select is(
  (select count(*)::int from processing_activities where id = '00000000-0000-0000-0000-00000000ac0b'),
  0, 'Caso 1: colaborador de A NO ve la actividad de B');

-- Caso 2 — Usuario de A hace UPDATE de una actividad de B → 0 filas afectadas
select is(
  (with u as (update processing_activities set title = 'HACKEADO'
              where id = '00000000-0000-0000-0000-00000000ac0b' returning 1)
   select count(*)::int from u),
  0, 'Caso 2: UPDATE de A sobre actividad de B no afecta filas');
select tests.act_as_postgres();
select is(
  (select title from processing_activities where id = '00000000-0000-0000-0000-00000000ac0b'),
  'Actividad de Unidad B', 'Caso 2b: el título de la actividad de B quedó intacto');

-- Caso 3 — Colaborador cambia el estado general de su unidad → DENEGADO (42501)
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$ select app.set_unit_rat_status(
       (select id from organizational_units where code='VRA'), 'EN_LEVANTAMIENTO', null) $$,
  '42501', null, 'Caso 3: colaborador NO cambia el estado de su unidad');

-- Caso 4 — Jefe de A cambia el estado de A → PERMITIDO
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ select app.set_unit_rat_status(
       (select id from organizational_units where code='VRA'), 'EN_LEVANTAMIENTO', 'inicio') $$,
  'Caso 4: jefe de A cambia el estado de A');

-- Caso 5 — Jefe de A cambia el estado de B → DENEGADO (42501)
select throws_ok(
  $$ select app.set_unit_rat_status(
       (select id from organizational_units where code='VGEA'), 'EN_LEVANTAMIENTO', null) $$,
  '42501', null, 'Caso 5: jefe de A NO cambia el estado de B');

-- Caso 6 — Usuario de unidad llama institutional_dashboard() → DENEGADO
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$ select app.institutional_dashboard() $$,
  '42501', null, 'Caso 6: colaborador NO accede al dashboard institucional');

-- Caso 7 — Administrador institucional llama institutional_dashboard() → PERMITIDO
select tests.act_as('00000000-0000-0000-0000-0000000000d1');
select lives_ok(
  $$ select app.institutional_dashboard() $$,
  'Caso 7: el DPD accede al dashboard institucional');

-- Caso 8 — Manipular el UUID de una actividad de otra unidad (dashboard de unidad)
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$ select app.unit_dashboard((select id from organizational_units where code='VGEA')) $$,
  'P0002', null, 'Caso 8: conocer el UUID de B no da acceso a su dashboard');

-- Caso 9 — Consulta directa por API (filtro a mano) a registros de otra unidad → 0 filas
select is(
  (select count(*)::int from processing_activities
   where responsible_unit_id = (select id from organizational_units where code='VGEA')),
  0, 'Caso 9: filtrar por la unidad B no devuelve filas (RLS)');

-- Caso 10 — Usuario intenta modificar su propio rol por petición directa → DENEGADO
select throws_ok(
  $$ insert into user_roles (user_id, role_id, scope)
     values ('00000000-0000-0000-0000-0000000000a2',
             (select id from roles where code='superadmin'), 'global') $$,
  null, null, 'Caso 10: colaborador NO puede auto-otorgarse un rol');

-- ══════════════════════  EXTRAS  ═════════════════════════════════════════

-- Extra 1 — sesión sin MFA (aal1) no ve NADA de actividades
select tests.act_as('00000000-0000-0000-0000-0000000000a2', 'aal1');
select is(
  (select count(*)::int from processing_activities),
  0, 'Extra: sin MFA (aal1) no se ven actividades');

-- Extra 2 — jefe de A intenta invitar/asignar usuario a la unidad B → DENEGADO
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into user_unit_assignments (user_id, unit_id, unit_role)
     values ('00000000-0000-0000-0000-0000000000b1',
             (select id from organizational_units where code='VGEA'), 'colaborador') $$,
  null, null, 'Extra: jefe de A NO gestiona asignaciones (no tiene user.manage)');

-- Extra 3 — colaborador de A SÍ ve la actividad de A
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select is(
  (select count(*)::int from processing_activities where id = '00000000-0000-0000-0000-00000000ac0a'),
  1, 'Extra: colaborador de A SÍ ve la actividad de A');

-- Extra 4 — un superadmin tampoco puede modificar SUS PROPIOS roles (self-guard)
select tests.act_as_postgres();
insert into auth.users (id,email,aud,role) values
  ('00000000-0000-0000-0000-0000000000s1','super@utalca.cl','authenticated','authenticated')
  on conflict do nothing;
insert into user_roles (user_id, role_id, scope)
  values ('00000000-0000-0000-0000-0000000000s1',(select id from roles where code='superadmin'),'global');
select tests.act_as('00000000-0000-0000-0000-0000000000s1');
select throws_ok(
  $$ update user_roles set scope='global'
     where user_id='00000000-0000-0000-0000-0000000000s1' $$,
  '42501', null, 'Extra: ni un superadmin edita sus propios roles (anti-autoelevación)');

select * from finish();
rollback;

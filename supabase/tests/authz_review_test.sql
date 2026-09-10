-- ════════════════════════════════════════════════════════════════════════════
-- authz_review_test.sql — Fase 4b.2 · ciclo de revisión del DPD
--   Corre con:  supabase test db
-- ════════════════════════════════════════════════════════════════════════════
begin;
create schema if not exists tests;
select plan(10);

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
  ('4b200000-0000-4000-a000-000000000001','rev.dpd@utalca.cl','authenticated','authenticated','{}'),
  ('4b200000-0000-4000-a000-000000000002','rev.colab.a@utalca.cl','authenticated','authenticated','{}'),
  ('4b200000-0000-4000-a000-000000000003','rev.jefe.b@utalca.cl','authenticated','authenticated','{}')
on conflict (id) do nothing;

insert into user_roles (user_id, role_id, scope) values
  ('4b200000-0000-4000-a000-000000000001',(select id from roles where code='dpd_admin'),'global'),
  ('4b200000-0000-4000-a000-000000000002',(select id from roles where code='collaborator'),'unit'),
  ('4b200000-0000-4000-a000-000000000003',(select id from roles where code='unit_manager'),'unit');

insert into user_unit_assignments (user_id, unit_id, unit_role) values
  ('4b200000-0000-4000-a000-000000000002',(select id from organizational_units where code='VRA'),'colaborador'),
  ('4b200000-0000-4000-a000-000000000003',(select id from organizational_units where code='VGEA'),'jefe');

-- actividad A en revisión (con completitud suficiente vía columnas mínimas),
-- actividad B en revisión, actividad A en borrador
insert into processing_activities (id, responsible_unit_id, title, status) values
  ('4b2a0000-0000-4000-a000-0000000000a1',(select id from organizational_units where code='VRA'),'RAT A en revisión','EN_REVISION'),
  ('4b2a0000-0000-4000-a000-0000000000b1',(select id from organizational_units where code='VGEA'),'RAT B en revisión','EN_REVISION'),
  ('4b2a0000-0000-4000-a000-0000000000a2',(select id from organizational_units where code='VRA'),'RAT A borrador','BORRADOR');

-- ── 1 · colaborador (sin activity.review) no puede observar ───────────────
select tests.act_as('4b200000-0000-4000-a000-000000000002');
select throws_ok(
  $$ select public.review_add_observation(
       '4b2a0000-0000-4000-a000-0000000000a1', 'titulares', 'obligatoria', 'Falta base de licitud reforzada') $$,
  '42501', null, '4b.2: colaborador NO agrega observaciones (sin activity.review)');

-- ── 2 · el DPD agrega una observación obligatoria ────────────────────────
select tests.act_as('4b200000-0000-4000-a000-000000000001');
select lives_ok(
  $$ select public.review_add_observation(
       '4b2a0000-0000-4000-a000-0000000000a1', 'base_juridica', 'obligatoria', 'Declarar consentimiento explícito') $$,
  '4b.2: el DPD agrega una observación obligatoria');

-- ── 3 · no se puede observar una actividad que no está EN_REVISION ───────
select throws_ok(
  $$ select public.review_add_observation(
       '4b2a0000-0000-4000-a000-0000000000a2', 'general', 'sugerida', 'nota') $$,
  '22000', null, '4b.2: no se agregan observaciones a un borrador');

-- ── 4 · aprobar con observación obligatoria abierta → denegado ───────────
select throws_ok(
  $$ select public.review_decide('4b2a0000-0000-4000-a000-0000000000a1', 'approved', null) $$,
  '23514', null, '4b.2: no se aprueba con observaciones obligatorias sin resolver');

-- ── 5 · el editor de la unidad resuelve la observación ──────────────────
select tests.act_as('4b200000-0000-4000-a000-000000000002');
select lives_ok(
  $$ select public.review_resolve_observation(
       (select id from review_observations
        where activity_id = '4b2a0000-0000-4000-a000-0000000000a1' limit 1), true) $$,
  '4b.2: el colaborador de la unidad resuelve la observación de su RAT');

-- ── 6 · ahora el DPD aprueba ────────────────────────────────────────────
select tests.act_as('4b200000-0000-4000-a000-000000000001');
select is(
  (select public.review_decide('4b2a0000-0000-4000-a000-0000000000a1', 'approved', 'Todo en orden'))::text,
  'APROBADO', '4b.2: el DPD aprueba tras resolverse las observaciones');

-- ── 7 · observar la actividad B (con observación obligatoria) ───────────
select public.review_add_observation(
  '4b2a0000-0000-4000-a000-0000000000b1', 'seguridad', 'obligatoria', 'Faltan medidas de cifrado');
select is(
  (select public.review_decide('4b2a0000-0000-4000-a000-0000000000b1', 'observed', 'Corregir seguridad'))::text,
  'OBSERVADO', '4b.2: el DPD observa la actividad B');

-- ── 8 · jefe de B (sin activity.review) no decide — se rechaza antes del estado ─
select tests.act_as('4b200000-0000-4000-a000-000000000003');
select throws_ok(
  $$ select public.review_decide('4b2a0000-0000-4000-a000-0000000000b1', 'approved', null) $$,
  '42501', null, '4b.2: el jefe de unidad NO decide revisiones (sin activity.review)');

-- ── 9 · jefe de B no resuelve observaciones de la unidad A ─────────────
select throws_ok(
  $$ select public.review_resolve_observation(
       (select id from review_observations
        where activity_id = '4b2a0000-0000-4000-a000-0000000000a1' limit 1), false) $$,
  'P0002', null, '4b.2: el jefe de B NO toca observaciones de la unidad A');

-- ── 10 · el colaborador de A no ve la actividad B ni sus observaciones ──
select tests.act_as('4b200000-0000-4000-a000-000000000002');
select is(
  (select count(*)::int from review_observations
   where activity_id = '4b2a0000-0000-4000-a000-0000000000b1'),
  0, '4b.2: el colaborador de A no ve observaciones de la unidad B (RLS)');

select * from finish();
rollback;

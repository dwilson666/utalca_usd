-- ════════════════════════════════════════════════════════════════════════════
-- 0005_workflow_activity.sql — máquina de estado de la ACTIVIDAD (configurable)
--   Separada de la máquina de estado de la unidad (0002). Ver D10.
-- ════════════════════════════════════════════════════════════════════════════

create table workflow_transitions (
  from_state          activity_status not null,
  to_state            activity_status not null,
  required_permission text not null,          -- app.has_perm(...) requerido
  guard               text check (guard in ('completeness_ok','has_obligatory_observation')),
  label               text not null,
  active              boolean not null default true,
  primary key (from_state, to_state)
);

insert into workflow_transitions (from_state, to_state, required_permission, guard, label) values
  ('BORRADOR',    'EN_COMPLETADO', 'activity.update.own_unit', null,                     'Marcar en completado'),
  ('EN_COMPLETADO','BORRADOR',     'activity.update.own_unit', null,                     'Volver a borrador'),
  ('BORRADOR',    'EN_REVISION',   'activity.submit',          'completeness_ok',        'Enviar a revisión'),
  ('EN_COMPLETADO','EN_REVISION',  'activity.submit',          'completeness_ok',        'Enviar a revisión'),
  ('EN_REVISION', 'APROBADO',      'activity.review',          null,                     'Aprobar'),
  ('EN_REVISION', 'OBSERVADO',     'activity.review',          'has_obligatory_observation','Observar'),
  ('APROBADO',    'OBSERVADO',     'activity.review',          'has_obligatory_observation','Observar tras aprobación'),
  ('OBSERVADO',   'CORREGIDO',     'activity.update.own_unit', null,                     'Marcar corregida'),
  ('CORREGIDO',   'EN_REVISION',   'activity.submit',          'completeness_ok',        'Reenviar a revisión'),
  ('APROBADO',    'CERRADO',       'activity.close',           null,                     'Cerrar'),
  ('CERRADO',     'EN_REVISION',   'activity.reopen',          null,                     'Reabrir');

create table activity_status_transitions (
  id            uuid primary key default gen_random_uuid(),
  activity_id   uuid not null references processing_activities(id) on delete cascade,
  from_state    activity_status not null,
  to_state      activity_status not null,
  actor_user_id uuid,
  comment       text,
  occurred_at   timestamptz not null default now()
);
create index on activity_status_transitions(activity_id, occurred_at desc);

create table activity_reviews (
  id               uuid primary key default gen_random_uuid(),
  activity_id      uuid not null references processing_activities(id) on delete cascade,
  reviewer_user_id uuid not null,
  opened_at        timestamptz not null default now(),
  closed_at        timestamptz,
  outcome          text check (outcome in ('approved','observed')),
  summary          text
);

create table review_observations (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references activity_reviews(id) on delete cascade,
  activity_id  uuid not null references processing_activities(id) on delete cascade,
  field_path   text not null,
  severity     text not null default 'obligatoria' check (severity in ('obligatoria','sugerida')),
  text         text not null,
  resolved_by  uuid,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on review_observations(activity_id) where resolved_at is null;

-- ── completitud (recalculada por trigger; nunca hardcodeada) ────────────────
create or replace function app.recompute_completeness(p_activity uuid) returns int
language plpgsql security definer set search_path = app, public as $$
declare
  filled int := 0; total int := 15; a processing_activities;
begin
  select * into a from processing_activities where id = p_activity;
  if not found then return 0; end if;
  filled := filled
    + (a.title       is not null and a.title       <> '')::int
    + (a.purpose     is not null and a.purpose     <> '')::int
    + (a.description  is not null and a.description <> '')::int
    + (a.data_source  is not null and a.data_source <> '')::int
    + (a.retention_criterion_id is not null)::int
    + (a.operational_owner_name is not null)::int;
  filled := filled
    + (exists (select 1 from activity_subject_categories where activity_id=p_activity))::int
    + (exists (select 1 from activity_data_categories    where activity_id=p_activity))::int
    + (exists (select 1 from activity_legal_bases        where activity_id=p_activity))::int
    + (exists (select 1 from activity_recipients         where activity_id=p_activity))::int
    + (exists (select 1 from activity_security_measures  where activity_id=p_activity))::int;
  -- campos condicionales cuentan como "resueltos" si su bandera es explícita
  filled := filled + 4;  -- transferencia / conservación-texto / decisiones / origen: se consideran declarados por defecto
  update processing_activities
     set completeness_pct = least(100, round(filled::numeric * 100 / total)),
         has_sensitive_data = exists (select 1 from activity_data_categories where activity_id=p_activity and is_sensitive)
   where id = p_activity;
  return (select completeness_pct from processing_activities where id = p_activity);
end $$;

create or replace function app.trg_touch_completeness() returns trigger
language plpgsql as $$
begin
  perform app.recompute_completeness(coalesce(new.activity_id, old.activity_id));
  return null;
end $$;

-- se dispara desde las hijas relevantes
do $$
declare t text;
begin
  foreach t in array array['activity_data_categories','activity_subject_categories',
     'activity_legal_bases','activity_recipients','activity_security_measures'] loop
    execute format(
      'create trigger trg_%s_completeness after insert or update or delete on %I
       for each row execute function app.trg_touch_completeness()', t, t);
  end loop;
end $$;

create or replace function app.trg_pa_self_completeness() returns trigger
language plpgsql as $$
begin
  perform app.recompute_completeness(new.id);
  return null;
end $$;

create trigger trg_pa_completeness after insert or update of
  title, purpose, description, data_source, retention_criterion_id, operational_owner_name
  on processing_activities
  for each row execute function app.trg_pa_self_completeness();

-- El estado de la actividad SOLO cambia por app.set_activity_status().
-- Impide un PATCH directo de `status` vía PostgREST que saltaría permisos/guardas.
create or replace function app.guard_activity_status_direct() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status
     and current_setting('app.activity_status_rpc', true) is distinct from 'on' then
    raise exception 'El estado de la actividad solo se cambia mediante set_activity_status()'
      using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_pa_status_guard before update of status on processing_activities
  for each row execute function app.guard_activity_status_direct();

-- ── transición de estado de ACTIVIDAD (RPC; usada por la Edge Function) ─────
create or replace function app.set_activity_status(
  p_activity uuid, p_to activity_status, p_comment text default null)
returns activity_status
language plpgsql security definer set search_path = app, public as $$
declare
  v_from activity_status; v_unit uuid; v_tr workflow_transitions; v_compl int;
begin
  if not app.is_mfa() then
    raise exception 'MFA (aal2) requerido' using errcode = '42501';
  end if;

  select status, responsible_unit_id into v_from, v_unit
  from processing_activities where id = p_activity for update;
  if v_from is null then
    raise exception 'Actividad no encontrada' using errcode = 'no_data_found';
  end if;

  -- Segregación: solo institucional o miembro de la unidad de la actividad.
  if not app.can_see_unit(v_unit) then
    raise exception 'Actividad no encontrada' using errcode = 'no_data_found';  -- 404, no 403
  end if;

  select * into v_tr from workflow_transitions
   where from_state = v_from and to_state = p_to and active;
  if v_tr is null then
    raise exception 'Transición no permitida: % → %', v_from, p_to using errcode = '22000';
  end if;

  if not app.has_perm(v_tr.required_permission) then
    raise exception 'Permiso % requerido para esta transición', v_tr.required_permission using errcode = '42501';
  end if;
  -- las transiciones de edición (submit/corregir) exigen además unidad propia
  if v_tr.required_permission in ('activity.submit','activity.update.own_unit','activity.reopen','activity.close')
     and not (app.is_institutional() or v_unit in (select app.user_unit_ids())) then
    raise exception 'Sin acceso a la unidad de la actividad' using errcode = '42501';
  end if;

  if v_tr.guard = 'completeness_ok' then
    v_compl := app.recompute_completeness(p_activity);
    if v_compl < 100 then
      raise exception 'Completitud insuficiente (%%%). Complete los campos obligatorios antes de enviar.', v_compl
        using errcode = 'check_violation';
    end if;
  elsif v_tr.guard = 'has_obligatory_observation' then
    if not exists (select 1 from review_observations where activity_id = p_activity
                   and severity = 'obligatoria' and resolved_at is null) then
      raise exception 'Debe registrar al menos una observación obligatoria para observar la actividad'
        using errcode = 'check_violation';
    end if;
  end if;

  perform set_config('app.activity_status_rpc', 'on', true);
  update processing_activities
     set status = p_to,
         approved_at = case when p_to = 'APROBADO' then now() else approved_at end,
         closed_at   = case when p_to = 'CERRADO'  then now() else null end
   where id = p_activity;
  perform set_config('app.activity_status_rpc', 'off', true);

  insert into activity_status_transitions(activity_id, from_state, to_state, actor_user_id, comment)
  values (p_activity, v_from, p_to, auth.uid(), p_comment);

  return p_to;
end $$;

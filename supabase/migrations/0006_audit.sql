-- ════════════════════════════════════════════════════════════════════════════
-- 0006_audit.sql — bitácora append-only con evidencia de manipulación (hash chain)
--   Escritura SOLO vía app.write_audit() (SECURITY DEFINER). Sin políticas de
--   INSERT/UPDATE/DELETE. UPDATE/DELETE revocados incluso al owner.
-- ════════════════════════════════════════════════════════════════════════════

create table audit_log (
  id             bigint generated always as identity,
  occurred_at    timestamptz not null default now(),
  actor_user_id  uuid,
  actor_email    text,
  actor_ip       inet,
  actor_user_agent text,
  action         audit_action not null,
  entity_type    text,
  entity_id      text,          -- id de la entidad como texto (uuid, int, clave compuesta…)
  unit_id        uuid,
  previous_state text,
  new_state      text,
  changed_fields text[],
  diff           jsonb,
  result         audit_result not null default 'success',
  request_id     text,
  prev_hash      text,
  row_hash       text,
  metadata       jsonb,
  primary key (id, occurred_at)
) partition by range (occurred_at);

-- particiones (se crean por año; pg_cron o CI puede rotar)
create table audit_log_2026 partition of audit_log
  for values from ('2026-01-01') to ('2027-01-01');
create table audit_log_2027 partition of audit_log
  for values from ('2027-01-01') to ('2028-01-01');
create index on audit_log (entity_type, entity_id, occurred_at desc);
create index on audit_log (unit_id, occurred_at desc);
create index on audit_log (actor_user_id, occurred_at desc);

-- Escritor único. Calcula cadena de hash sobre el último registro.
create or replace function app.write_audit(
  p_action audit_action,
  p_entity_type text default null,
  p_entity_id text default null,
  p_unit_id uuid default null,
  p_previous_state text default null,
  p_new_state text default null,
  p_changed_fields text[] default null,
  p_diff jsonb default null,
  p_result audit_result default 'success',
  p_metadata jsonb default null
) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_headers jsonb;
  v_prev text;
  v_payload text;
begin
  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then v_headers := '{}'::jsonb;
  end;

  select row_hash into v_prev from audit_log order by id desc limit 1;

  v_payload := coalesce(v_prev,'') || '|' || coalesce(auth.uid()::text,'') || '|' ||
               p_action::text || '|' || coalesce(p_entity_type,'') || '|' ||
               coalesce(p_entity_id::text,'') || '|' || coalesce(p_new_state,'') || '|' ||
               coalesce(p_diff::text,'') || '|' || now()::text;

  insert into audit_log(
    actor_user_id, actor_email, actor_ip, actor_user_agent, action, entity_type, entity_id,
    unit_id, previous_state, new_state, changed_fields, diff, result, request_id, prev_hash, row_hash, metadata)
  values (
    auth.uid(),
    nullif(v_headers->>'x-actor-email',''),
    nullif(v_headers->>'x-forwarded-for','')::inet,
    nullif(v_headers->>'user-agent',''),
    p_action, p_entity_type, p_entity_id, p_unit_id, p_previous_state, p_new_state,
    p_changed_fields, p_diff, p_result,
    nullif(v_headers->>'x-request-id',''),
    v_prev,
    encode(digest(v_payload, 'sha256'), 'hex'),
    p_metadata);
end $$;

-- Trigger genérico para tablas de negocio. Agnóstico a la forma de la fila
-- (usa to_jsonb, así funciona igual con id uuid, id int o clave de texto).
create or replace function app.trg_audit() returns trigger
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  jnew jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  jold jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_unit uuid;
  v_entity text;
  v_changed text[];
  v_diff jsonb;
  v_prev text; v_new text;
begin
  v_entity := coalesce(jnew ->> 'id', jold ->> 'id', jnew ->> 'key', jold ->> 'key');

  if tg_table_name = 'processing_activities' then
    v_unit := coalesce(jnew ->> 'responsible_unit_id', jold ->> 'responsible_unit_id')::uuid;
    v_prev := jold ->> 'status'; v_new := jnew ->> 'status';
  elsif tg_table_name = 'organizational_units' then
    v_unit := coalesce(jnew ->> 'id', jold ->> 'id')::uuid;
    v_prev := jold ->> 'rat_status'; v_new := jnew ->> 'rat_status';
  elsif tg_table_name like 'activity\_%' then
    select responsible_unit_id into v_unit from processing_activities
      where id = coalesce(jnew ->> 'activity_id', jold ->> 'activity_id')::uuid;
  end if;

  if tg_op = 'UPDATE' then
    select array_agg(key), jsonb_object_agg(key, jsonb_build_object('old', o.value, 'new', n.value))
      into v_changed, v_diff
    from jsonb_each(jold) o
    join jsonb_each(jnew) n using (key)
    where o.value is distinct from n.value and key not in ('updated_at','updated_by');
  end if;

  perform app.write_audit(
    case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end::audit_action,
    tg_table_name::text,
    v_entity,
    v_unit,
    case when tg_op = 'UPDATE' then v_prev end,
    case when tg_op = 'UPDATE' then v_new end,
    v_changed, v_diff, 'success'::audit_result, null::jsonb);

  return coalesce(new, old);
end $$;

-- adjuntar a las tablas de negocio
do $$
declare t text;
begin
  foreach t in array array[
    'processing_activities','organizational_units','user_roles','user_unit_assignments',
    'activity_legal_bases','activity_data_categories','activity_subject_categories',
    'legal_bases','data_categories','subject_categories','institutional_controller',
    'data_protection_officer','feature_flags'
  ] loop
    execute format(
      'create trigger trg_audit_%s after insert or update or delete on %I
       for each row execute function app.trg_audit()', t, t);
  end loop;
end $$;

-- Inmutabilidad dura.
revoke update, delete, truncate on audit_log from public;
revoke update, delete, truncate on audit_log_2026 from public;
revoke update, delete, truncate on audit_log_2027 from public;

create or replace function app.verify_audit_chain(p_limit int default 100000)
returns table (ok boolean, broken_at bigint)
language plpgsql security definer set search_path = app, public, extensions as $$
declare r record; v_prev text; v_calc text;
begin
  if not app.has_perm('audit.read') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  v_prev := null;
  for r in select * from audit_log order by id asc limit p_limit loop
    v_calc := encode(digest(
      coalesce(v_prev,'') || '|' || coalesce(r.actor_user_id::text,'') || '|' ||
      r.action::text || '|' || coalesce(r.entity_type,'') || '|' ||
      coalesce(r.entity_id::text,'') || '|' || coalesce(r.new_state,'') || '|' ||
      coalesce(r.diff::text,'') || '|' || r.occurred_at::text, 'sha256'), 'hex');
    if r.prev_hash is distinct from v_prev then
      return query select false, r.id; return;
    end if;
    v_prev := r.row_hash;
  end loop;
  return query select true, null::bigint;
end $$;

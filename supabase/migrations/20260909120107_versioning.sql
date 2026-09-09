-- ════════════════════════════════════════════════════════════════════════════
-- 0007_versioning.sql — snapshots inmutables de la actividad
--   Se crea versión en: envío a revisión, aprobación, restauración, "guardar
--   versión" manual. NO en cada edición del borrador (evita explosión).
-- ════════════════════════════════════════════════════════════════════════════

create table activity_versions (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references processing_activities(id) on delete cascade,
  version_no   int not null,
  reason       text not null check (reason in ('submit','approve','manual','restore')),
  snapshot     jsonb not null,
  content_hash text not null,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  unique (activity_id, version_no)
);
create index on activity_versions(activity_id, version_no desc);

revoke update, delete, truncate on activity_versions from public;

-- Arma el snapshot denormalizado (actividad + colecciones hijas).
create or replace function app.build_activity_snapshot(p_activity uuid) returns jsonb
language sql stable security definer set search_path = app, public as $$
  select jsonb_build_object(
    'activity', to_jsonb(a) - 'created_at' - 'updated_at',
    'intervening_units',   coalesce((select jsonb_agg(to_jsonb(x)) from activity_intervening_units   x where x.activity_id=p_activity), '[]'),
    'legal_bases',         coalesce((select jsonb_agg(to_jsonb(x)) from activity_legal_bases         x where x.activity_id=p_activity), '[]'),
    'data_categories',     coalesce((select jsonb_agg(to_jsonb(x)) from activity_data_categories     x where x.activity_id=p_activity), '[]'),
    'subject_categories',  coalesce((select jsonb_agg(to_jsonb(x)) from activity_subject_categories  x where x.activity_id=p_activity), '[]'),
    'recipients',          coalesce((select jsonb_agg(to_jsonb(x)) from activity_recipients          x where x.activity_id=p_activity), '[]'),
    'transfers',           coalesce((select jsonb_agg(to_jsonb(x)) from activity_transfers           x where x.activity_id=p_activity), '[]'),
    'security_measures',   coalesce((select jsonb_agg(to_jsonb(x)) from activity_security_measures   x where x.activity_id=p_activity), '[]'),
    'automated_decisions', coalesce((select jsonb_agg(to_jsonb(x)) from activity_automated_decisions x where x.activity_id=p_activity), '[]')
  )
  from processing_activities a where a.id = p_activity
$$;

create or replace function app.create_activity_version(p_activity uuid, p_reason text) returns int
language plpgsql security definer set search_path = app, public, extensions as $$
declare v_no int; v_snap jsonb;
begin
  v_snap := app.build_activity_snapshot(p_activity);
  select coalesce(max(version_no), 0) + 1 into v_no from activity_versions where activity_id = p_activity;
  insert into activity_versions(activity_id, version_no, reason, snapshot, content_hash, created_by)
  values (p_activity, v_no, p_reason,
          v_snap, encode(digest(v_snap::text, 'sha256'), 'hex'), auth.uid());
  update processing_activities set current_version_no = v_no where id = p_activity;
  return v_no;
end $$;

-- Enganche: crear versión al entrar a EN_REVISION o APROBADO.
create or replace function app.trg_version_on_status() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if new.status is distinct from old.status and new.status in ('EN_REVISION','APROBADO') then
    perform app.create_activity_version(new.id,
      case when new.status = 'EN_REVISION' then 'submit' else 'approve' end);
  end if;
  return new;
end $$;

create trigger trg_pa_version after update of status on processing_activities
  for each row execute function app.trg_version_on_status();

-- Restaurar = nueva versión a partir de un snapshot previo (nunca sobrescribe).
create or replace function app.restore_activity_version(p_activity uuid, p_version int) returns int
language plpgsql security definer set search_path = app, public as $$
declare v_snap jsonb; v_unit uuid; a jsonb; t text;
begin
  if not app.is_mfa() then raise exception 'MFA requerido' using errcode='42501'; end if;
  select responsible_unit_id into v_unit from processing_activities where id = p_activity;
  if v_unit is null or not app.can_see_unit(v_unit) then
    raise exception 'Actividad no encontrada' using errcode='no_data_found';
  end if;
  if not (app.has_perm('activity.update.all')
          or (v_unit in (select app.user_unit_ids()) and app.has_perm('activity.update.own_unit'))) then
    raise exception 'Sin permiso para restaurar' using errcode='42501';
  end if;

  select snapshot into v_snap from activity_versions where activity_id = p_activity and version_no = p_version;
  if v_snap is null then raise exception 'Versión inexistente' using errcode='no_data_found'; end if;

  a := v_snap->'activity';
  update processing_activities set
     title = a->>'title', description = a->>'description', purpose = a->>'purpose',
     data_source = a->>'data_source', operational_owner_name = a->>'operational_owner_name',
     retention_value = nullif(a->>'retention_value','')::int,
     retention_unit = a->>'retention_unit', retention_text = a->>'retention_text',
     retention_criterion_id = nullif(a->>'retention_criterion_id','')::uuid
   where id = p_activity;

  -- reemplazar colecciones hijas desde el snapshot
  foreach t in array app.activity_child_tables() loop
    execute format('delete from %I where activity_id = $1', t) using p_activity;
    execute format(
      'insert into %I select * from jsonb_populate_recordset(null::%I, $1)', t, t)
      using v_snap->(replace(t,'activity_',''));
  end loop;

  return app.create_activity_version(p_activity, 'restore');
end $$;

-- Comparación de dos versiones (para la UI de diff).
create or replace function app.diff_activity_versions(p_activity uuid, p_a int, p_b int)
returns jsonb
language plpgsql stable security definer set search_path = app, public as $$
declare sa jsonb; sb jsonb; v_unit uuid;
begin
  select responsible_unit_id into v_unit from processing_activities where id = p_activity;
  if not app.can_see_unit(v_unit) then
    raise exception 'Actividad no encontrada' using errcode='no_data_found';
  end if;
  select snapshot into sa from activity_versions where activity_id=p_activity and version_no=p_a;
  select snapshot into sb from activity_versions where activity_id=p_activity and version_no=p_b;
  return jsonb_build_object('a', sa, 'b', sb);
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 0010_dashboards_rpc.sql — indicadores y estado de unidad
--   NO hay dashboard genérico. Autorización EXPLÍCITA en cada RPC (capa 2).
--   Ningún número institucional llega a un usuario de unidad (D14).
--   Casos 3, 4, 5, 6, 7.
-- ════════════════════════════════════════════════════════════════════════════

-- ── cambio de estado de la UNIDAD (solo jefe de esa unidad o institucional) ──
create or replace function app.set_unit_rat_status(
  p_unit uuid, p_to unit_rat_status, p_comment text default null)
returns unit_rat_status
language plpgsql security definer set search_path = app, public as $$
declare v_from unit_rat_status;
begin
  if not app.is_mfa() then
    raise exception 'MFA (aal2) requerido' using errcode = '42501';
  end if;

  -- AUTORIZACIÓN:  jefe de ESTA unidad  O  rol institucional con unit.status.manage
  if not (app.is_jefe_of(p_unit) or app.has_perm('unit.status.manage')) then
    raise exception 'Solo el jefe de la unidad o un administrador institucional puede cambiar su estado'
      using errcode = '42501';   -- Casos 3 (colaborador) y 5 (jefe de otra unidad)
  end if;

  select rat_status into v_from from organizational_units where id = p_unit for update;
  if v_from is null then
    raise exception 'Unidad no encontrada' using errcode = 'no_data_found';
  end if;

  if not exists (select 1 from unit_workflow_transitions
                 where from_state = v_from and to_state = p_to and active) then
    raise exception 'Transición de estado de unidad no permitida: % → %', v_from, p_to
      using errcode = '22000';
  end if;

  perform set_config('app.unit_status_rpc', 'on', true);   -- habilita el UPDATE del campo
  update organizational_units set rat_status = p_to where id = p_unit;
  perform set_config('app.unit_status_rpc', 'off', true);

  insert into unit_rat_status_transitions(unit_id, from_state, to_state, actor_user_id, comment)
  values (p_unit, v_from, p_to, auth.uid(), p_comment);

  perform app.write_audit('unit_state_change', 'organizational_units', p_unit::text, p_unit,
    v_from::text, p_to::text, array['rat_status'], null::jsonb, 'success'::audit_result,
    jsonb_build_object('comment', p_comment));

  return p_to;
end $$;

-- ── dashboard de UNA unidad (miembro o institucional) ──  Casos 1, 8
create or replace function app.unit_dashboard(p_unit uuid)
returns jsonb
language plpgsql stable security definer set search_path = app, public as $$
declare v jsonb;
begin
  if not app.is_mfa() then
    raise exception 'MFA (aal2) requerido' using errcode = '42501';
  end if;
  if not app.can_see_unit(p_unit) then
    raise exception 'Unidad no encontrada' using errcode = 'no_data_found';  -- 404, no 403
  end if;

  select jsonb_build_object(
    'unit', jsonb_build_object(
       'id', u.id, 'code', u.code, 'name', u.name_official, 'short', u.name_short,
       'rat_status', u.rat_status),
    'activities_total',  count(a.*),
    'by_status', jsonb_build_object(
       'BORRADOR',    count(a.*) filter (where a.status = 'BORRADOR'),
       'EN_COMPLETADO',count(a.*) filter (where a.status = 'EN_COMPLETADO'),
       'EN_REVISION',  count(a.*) filter (where a.status = 'EN_REVISION'),
       'OBSERVADO',    count(a.*) filter (where a.status = 'OBSERVADO'),
       'CORREGIDO',    count(a.*) filter (where a.status = 'CORREGIDO'),
       'APROBADO',     count(a.*) filter (where a.status = 'APROBADO'),
       'CERRADO',      count(a.*) filter (where a.status = 'CERRADO')),
    'completeness_avg', coalesce(round(avg(a.completeness_pct)), 0),
    'pending_activities', count(a.*) filter (where a.completeness_pct < 100 and a.status <> 'CERRADO'),
    'open_observations', (
       select count(*) from review_observations ro
       join processing_activities pa on pa.id = ro.activity_id
       where pa.responsible_unit_id = p_unit and ro.resolved_at is null)
  ) into v
  from organizational_units u
  left join processing_activities a on a.responsible_unit_id = u.id
  where u.id = p_unit
  group by u.id;

  return v;
end $$;

-- ── dashboard INSTITUCIONAL (solo institutional.view) ──  Casos 6, 7
create or replace function app.institutional_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = app, public as $$
declare v jsonb;
begin
  if not app.is_mfa() then
    raise exception 'MFA (aal2) requerido' using errcode = '42501';
  end if;
  if not app.has_perm('institutional.view') then
    raise exception 'Acceso a información institucional consolidada no autorizado'
      using errcode = '42501';   -- Caso 6
  end if;

  select jsonb_build_object(
    'unidades_total',            (select count(*) from organizational_units where status = 'active' and is_rat_unit and not deferred),
    'unidades_con_actividades',  (select count(distinct responsible_unit_id) from processing_activities),
    'actividades_total',         (select count(*) from processing_activities),
    'por_estado', (select coalesce(jsonb_object_agg(st, n), '{}'::jsonb) from (
       select status::text as st, count(*) n from processing_activities group by status) s),
    'responsables_identificados',(select count(*) from engagement_contacts),
    'completitud_promedio',      (select coalesce(round(avg(completeness_pct)),0) from processing_activities),
    'avance_institucional_pct', (
       select case when count(*) = 0 then 0
              else round(count(*) filter (where exists (
                     select 1 from processing_activities pa where pa.responsible_unit_id = ou.id))::numeric
                   * 100 / count(*)) end
       from organizational_units ou
       where ou.status = 'active' and ou.is_rat_unit and not ou.deferred),
    'por_unidad', (
       select coalesce(jsonb_agg(jsonb_build_object(
                'unit_id', ou.id, 'code', ou.code, 'name', ou.name_short,
                'rat_status', ou.rat_status,
                'activities', (select count(*) from processing_activities pa where pa.responsible_unit_id = ou.id),
                'completeness_avg', (select coalesce(round(avg(completeness_pct)),0) from processing_activities pa where pa.responsible_unit_id = ou.id),
                'contacts', (select count(*) from engagement_contacts ec where ec.unit_id = ou.id))
              order by ou.sort_order), '[]')
       from organizational_units ou
       where ou.status = 'active' and ou.is_rat_unit and not ou.deferred and ou.parent_id is not null)
  ) into v;

  return v;
end $$;

-- ── caché de KPIs por unidad (para listas; RLS por unidad) ──────────────────
create table unit_kpi_cache (
  unit_id          uuid primary key references organizational_units(id) on delete cascade,
  activities_total int not null default 0,
  completeness_avg int not null default 0,
  pending          int not null default 0,
  refreshed_at     timestamptz not null default now()
);
alter table unit_kpi_cache enable row level security;
alter table unit_kpi_cache force row level security;
create policy ukc_sel on unit_kpi_cache for select
  using (app.is_institutional() or unit_id in (select app.user_unit_ids()));

create or replace function app.refresh_unit_kpi_cache() returns void
language sql security definer set search_path = app, public as $$
  insert into unit_kpi_cache (unit_id, activities_total, completeness_avg, pending, refreshed_at)
  select ou.id,
         count(a.*),
         coalesce(round(avg(a.completeness_pct)), 0),
         count(a.*) filter (where a.completeness_pct < 100 and a.status <> 'CERRADO'),
         now()
  from organizational_units ou
  left join processing_activities a on a.responsible_unit_id = ou.id
  group by ou.id
  on conflict (unit_id) do update set
    activities_total = excluded.activities_total,
    completeness_avg = excluded.completeness_avg,
    pending = excluded.pending,
    refreshed_at = excluded.refreshed_at;
$$;
revoke execute on function app.refresh_unit_kpi_cache() from authenticated;

-- pg_cron (si está disponible): refresco periódico + keep-alive del proyecto free.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('refresh_unit_kpi', '*/10 * * * *', $c$select app.refresh_unit_kpi_cache()$c$);
    perform cron.schedule('keep_alive', '23 */6 * * *', $c$select 1$c$);
  end if;
end $$;

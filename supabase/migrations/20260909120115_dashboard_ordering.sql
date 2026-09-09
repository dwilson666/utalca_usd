-- ════════════════════════════════════════════════════════════════════════════
-- 20260909120115_dashboard_ordering.sql
--   institutional_dashboard(): en "por_unidad", primero las unidades con
--   actividad/contactos/estado avanzado, luego el resto por orden orgánico.
--   Además marca las unidades de nivel superior (dependen de Rectoría).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function app.institutional_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = app, public as $$
declare v jsonb; v_rect uuid;
begin
  if not app.is_mfa() then
    raise exception 'MFA (aal2) requerido' using errcode = '42501';
  end if;
  if not app.has_perm('institutional.view') then
    raise exception 'Acceso a información institucional consolidada no autorizado'
      using errcode = '42501';
  end if;

  select id into v_rect from organizational_units where code = 'RECT';

  -- "unidad institucional" = unidad de primer nivel (depende de Rectoría o del
  -- Consejo Superior). El avance se mide sobre estas, no sobre cada sub-unidad.
  select jsonb_build_object(
    'unidades_total', (
       select count(*) from organizational_units ou
       where ou.status = 'active' and not ou.deferred
         and (ou.parent_id = v_rect or ou.parent_id is null and ou.type = 'contraloria')),
    'unidades_con_actividades', (
       select count(distinct c.ancestor_id)
       from organizational_unit_closure c
       join processing_activities pa on pa.responsible_unit_id = c.descendant_id
       join organizational_units ou on ou.id = c.ancestor_id
       where ou.parent_id = v_rect or (ou.parent_id is null and ou.type = 'contraloria')),
    'actividades_total',         (select count(*) from processing_activities),
    'por_estado', (select coalesce(jsonb_object_agg(st, n), '{}'::jsonb) from (
       select status::text as st, count(*) n from processing_activities group by status) s),
    'responsables_identificados',(select count(*) from engagement_contacts),
    'completitud_promedio',      (select coalesce(round(avg(completeness_pct)),0) from processing_activities),
    'avance_institucional_pct', (
       select case when t.total = 0 then 0 else round(t.con * 100.0 / t.total) end
       from (
         select count(*) total,
           count(*) filter (where exists (
             select 1 from organizational_unit_closure c
             join processing_activities pa on pa.responsible_unit_id = c.descendant_id
             where c.ancestor_id = ou.id)) con
         from organizational_units ou
         where ou.status = 'active' and not ou.deferred
           and (ou.parent_id = v_rect or (ou.parent_id is null and ou.type = 'contraloria'))
       ) t),
    -- solo unidades "en juego": con actividades, con contactos levantados o
    -- con estado avanzado. Las ~90 unidades aún sin nada no llenan el tablero.
    'por_unidad', (
       select coalesce(jsonb_agg(obj order by activities desc, completeness_avg desc, name), '[]')
       from (
         select
           jsonb_build_object(
             'unit_id', ou.id, 'code', ou.code, 'name', ou.name_short,
             'top_level', (ou.parent_id = v_rect),
             'rat_status', ou.rat_status,
             'activities', act.n,
             'completeness_avg', act.avg_c,
             'contacts', c.n
           ) as obj,
           act.n as activities, act.avg_c as completeness_avg, ou.name_short as name
         from organizational_units ou
         left join lateral (
           select count(*) n, coalesce(round(avg(completeness_pct)),0) avg_c
           from processing_activities pa where pa.responsible_unit_id = ou.id
         ) act on true
         left join lateral (
           select count(*) n from engagement_contacts ec where ec.unit_id = ou.id
         ) c on true
         where ou.status = 'active' and ou.is_rat_unit and not ou.deferred and ou.parent_id is not null
           and (act.n > 0 or c.n > 0 or ou.rat_status <> 'PENDIENTE')
       ) q)
  ) into v;

  return v;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 20260909120121_unit_role_edit_rights.sql — Fase 4b.3 · permisos de edición
--   de RAT diferenciados por (usuario, unidad).
--
--   PROBLEMA (documentado en docs/Fase4b_Estabilizacion.md §3):
--     Hasta ahora, editar un RAT se autorizaba por el PERMISO DE ROL GLOBAL
--     (`activity.update.own_unit`) + pertenencia a la unidad. El campo
--     `user_unit_assignments.unit_role ∈ {jefe, colaborador, consulta}` solo se
--     consultaba para el estado de la unidad. Por eso NO se podía tener un
--     miembro de solo lectura (`consulta`) si su rol global permitía editar.
--
--   MODELO NUEVO (regla del encargo §5):
--     derecho a editar el RAT de la unidad U  =
--        rol institucional con `activity.update.all`
--        Ó ( permiso `activity.update.own_unit` (del rol)
--            Y asignación a U con unit_role ∈ {jefe, colaborador} )
--
--     |  unit_role   | ver RAT | crear/editar RAT | enviar a revisión | estado unidad |
--     |  jefe        |   ✓     |        ✓         |        ✓          |      ✓        |
--     |  colaborador |   ✓     |        ✓         |        ✓          |      ✗        |
--     |  consulta    |   ✓     |        ✗         |        ✗          |      ✗        |
--
--   VER (pa_sel) no cambia: cualquier miembro —incl. consulta— sigue viendo
--   los RAT de su unidad. Solo se restringe la ESCRITURA.
--
--   Se mantiene: deny-by-default, FORCE RLS, aislamiento entre unidades, y la
--   regla de que el estado de la unidad solo lo mueve el jefe/autorizado.
--
--   Pruebas: supabase/tests/authz_permisos_test.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Unidades donde el usuario puede EDITAR actividades (jefe o colaborador),
-- incluidas las descendientes cuando la asignación lo indica.
create or replace function app.editor_unit_ids() returns setof uuid
language sql stable security definer set search_path = app, public as $$
  with direct as (
    select uua.unit_id, uua.includes_descendants
    from user_unit_assignments uua
    where uua.user_id = auth.uid()
      and uua.unit_role in ('jefe', 'colaborador')
      and (uua.valid_to is null or uua.valid_to > now())
  )
  select unit_id from direct
  union
  select c.descendant_id
  from direct d
  join organizational_unit_closure c on c.ancestor_id = d.unit_id
  where d.includes_descendants
$$;

-- ¿el usuario puede editar los RAT de esta unidad?
create or replace function app.can_edit_unit_activities(u uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select app.has_perm('activity.update.all')
      or (app.has_perm('activity.update.own_unit') and u in (select app.editor_unit_ids()))
$$;

-- ── processing_activities: INSERT / UPDATE usan can_edit_unit_activities ────
drop policy if exists pa_ins on processing_activities;
create policy pa_ins on processing_activities for insert
  with check (
    app.is_mfa()
    and app.has_perm('activity.create')
    and app.can_edit_unit_activities(responsible_unit_id)
  );

drop policy if exists pa_upd on processing_activities;
create policy pa_upd on processing_activities for update
  using (
    app.is_mfa() and (
      app.has_perm('activity.update.all')
      or (app.can_edit_unit_activities(responsible_unit_id)
          and app.activity_is_editable(status))
    )
  )
  with check (
    app.has_perm('activity.update.all')
    or app.can_edit_unit_activities(responsible_unit_id)   -- no puede "mudarla" a otra unidad
  );

-- ── tablas hijas: parent_activity_editable pasa por can_edit_unit_activities ─
create or replace function app.parent_activity_editable(p_activity uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1 from processing_activities a
    where a.id = p_activity and app.is_mfa()
      and (app.has_perm('activity.update.all')
           or (app.can_edit_unit_activities(a.responsible_unit_id)
               and app.activity_is_editable(a.status))))
$$;

-- ── set_activity_status: las transiciones de edición exigen poder editar ────
--   (marcar completado, volver a borrador, marcar corregida, enviar/reenviar).
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

  -- transiciones de EDICIÓN → exigen derecho a editar el RAT de esa unidad
  if v_tr.required_permission in ('activity.submit', 'activity.update.own_unit')
     and not app.can_edit_unit_activities(v_unit) then
    raise exception 'Sin derecho a editar los RAT de esta unidad' using errcode = '42501';
  end if;
  -- cerrar / reabrir → institucional o miembro de la unidad (permiso ya lo acota)
  if v_tr.required_permission in ('activity.reopen', 'activity.close')
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

-- ── review_resolve_observation: resolver = acción de edición ──────────────
--   Un miembro `consulta` no debe poder marcar observaciones resueltas.
create or replace function public.review_resolve_observation(
  p_obs uuid, p_resolved boolean default true) returns void
language plpgsql security definer set search_path = app, public as $$
declare v_activity uuid; v_unit uuid;
begin
  select o.activity_id, a.responsible_unit_id into v_activity, v_unit
  from review_observations o
  join processing_activities a on a.id = o.activity_id
  where o.id = p_obs;

  if v_activity is null or not app.can_see_unit(v_unit) then
    raise exception 'Observación no encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.has_perm('activity.review') or app.can_edit_unit_activities(v_unit)) then
    raise exception 'Sin permiso para modificar la observación' using errcode = '42501';
  end if;

  update review_observations
     set resolved_at = case when p_resolved then now() else null end,
         resolved_by = case when p_resolved then auth.uid() else null end
   where id = p_obs;
end $$;

-- ── grants ────────────────────────────────────────────────────────────────
--   Igual que app.user_unit_ids / app.has_perm: `authenticated` debe poder
--   ejecutarlas porque las RLS las invocan al evaluar cada fila. No hay riesgo
--   de RPC: viven en el esquema `app`, que PostgREST no expone.
revoke execute on function app.editor_unit_ids() from public, anon;
revoke execute on function app.can_edit_unit_activities(uuid) from public, anon;
grant execute on function app.editor_unit_ids() to authenticated, service_role;
grant execute on function app.can_edit_unit_activities(uuid) to authenticated, service_role;

-- `my_authz` ya expone `unit_role` por unidad; el frontend deriva el derecho de
-- edición de ahí (capa 1). La frontera real es esta RLS.

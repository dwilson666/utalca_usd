-- ════════════════════════════════════════════════════════════════════════════
-- 20260909120120_review_rpcs.sql — Fase 4b.2 · ciclo de revisión del DPD
--
--   RPCs atómicas para la bandeja de revisión. Cada una hace su propia
--   verificación de autorización (espejo de las políticas RLS); son
--   SECURITY DEFINER siguiendo el patrón de `set_activity_status`.
--
--   Segregación: una revisión solo puede abrirse sobre una actividad que el
--   usuario ya puede VER (institucional o miembro de su unidad) → si no, 404
--   (`no_data_found`), nunca 403. Añadir observaciones y decidir exigen además
--   el permiso `activity.review`.
--
--   Máquina de estado: la decisión delega en `app.set_activity_status`, que
--   valida la transición y la guarda `has_obligatory_observation`. Además:
--     - aprobar con observaciones obligatorias sin resolver → denegado.
--
--   Pruebas: supabase/tests/authz_review_test.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── helper interno: la revisión abierta de una actividad (la crea si no hay) ─
create or replace function app.review_ensure_open(p_activity uuid) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_review uuid; v_unit uuid; v_status activity_status;
begin
  if not app.is_mfa() then
    raise exception 'MFA (aal2) requerido' using errcode = '42501';
  end if;

  select responsible_unit_id, status into v_unit, v_status
  from processing_activities where id = p_activity for update;

  if v_unit is null or not app.can_see_unit(v_unit) then
    raise exception 'Actividad no encontrada' using errcode = 'no_data_found';   -- 404
  end if;
  if not app.has_perm('activity.review') then
    raise exception 'Permiso activity.review requerido' using errcode = '42501';
  end if;
  if v_status <> 'EN_REVISION' then
    raise exception 'La actividad no está en revisión (estado %)', v_status
      using errcode = '22000';
  end if;

  select id into v_review from activity_reviews
   where activity_id = p_activity and closed_at is null
   order by opened_at desc limit 1;

  if v_review is null then
    insert into activity_reviews (activity_id, reviewer_user_id)
    values (p_activity, auth.uid())
    returning id into v_review;
  end if;
  return v_review;
end $$;

-- ── añadir una observación ────────────────────────────────────────────────
create or replace function public.review_add_observation(
  p_activity uuid, p_field text, p_severity text, p_text text) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_review uuid; v_obs uuid;
begin
  if coalesce(p_severity, 'obligatoria') not in ('obligatoria', 'sugerida') then
    raise exception 'Severidad inválida' using errcode = '22000';
  end if;
  if length(coalesce(btrim(p_text), '')) < 3 then
    raise exception 'La observación necesita un texto descriptivo' using errcode = '22000';
  end if;

  v_review := app.review_ensure_open(p_activity);

  insert into review_observations (review_id, activity_id, field_path, severity, text)
  values (v_review, p_activity,
          coalesce(nullif(btrim(p_field), ''), 'general'),
          coalesce(p_severity, 'obligatoria'),
          btrim(p_text))
  returning id into v_obs;
  return v_obs;
end $$;

-- ── marcar una observación resuelta / reabrirla ──────────────────────────
--   La puede resolver el revisor o un editor de la unidad de la actividad.
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
  if not (
    app.has_perm('activity.review')
    or (app.has_perm('activity.update.own_unit') and v_unit in (select app.user_unit_ids()))
    or app.has_perm('activity.update.all')
  ) then
    raise exception 'Sin permiso para modificar la observación' using errcode = '42501';
  end if;

  update review_observations
     set resolved_at = case when p_resolved then now() else null end,
         resolved_by = case when p_resolved then auth.uid() else null end
   where id = p_obs;
end $$;

-- ── decidir la revisión: aprobar u observar (atómico) ────────────────────
create or replace function public.review_decide(
  p_activity uuid, p_outcome text, p_summary text default null) returns activity_status
language plpgsql security definer set search_path = app, public as $$
declare v_review uuid; v_to activity_status; v_new activity_status; v_open int;
begin
  if p_outcome not in ('approved', 'observed') then
    raise exception 'Resultado inválido (approved | observed)' using errcode = '22000';
  end if;

  v_review := app.review_ensure_open(p_activity);   -- valida visibilidad + review + EN_REVISION

  select count(*) into v_open from review_observations
   where activity_id = p_activity and severity = 'obligatoria' and resolved_at is null;

  if p_outcome = 'approved' and v_open > 0 then
    raise exception 'No puede aprobar: hay % observación(es) obligatoria(s) sin resolver', v_open
      using errcode = 'check_violation';
  end if;

  v_to := case p_outcome when 'approved' then 'APROBADO' else 'OBSERVADO' end::activity_status;

  -- delega la transición (valida workflow + guardas + permisos de nuevo)
  v_new := app.set_activity_status(
    p_activity, v_to,
    coalesce(p_summary,
      case p_outcome when 'approved' then 'Aprobada en revisión'
                     else 'Observada en revisión' end));

  update activity_reviews
     set closed_at = now(), outcome = p_outcome, summary = nullif(btrim(p_summary), '')
   where id = v_review;

  return v_new;
end $$;

-- ── permisos: solo authenticated (anon nada); el helper interno queda oculto ─
revoke execute on function app.review_ensure_open(uuid) from public, anon, authenticated;
grant execute on function app.review_ensure_open(uuid) to service_role;

do $$
declare fn text;
begin
  for fn in
    select p.oid::regprocedure::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('review_add_observation', 'review_resolve_observation', 'review_decide')
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 20260909120118_activity_create_institutional.sql
--
--   Ajuste puntual a `processing_activities` INSERT (política pa_ins).
--
--   ANTES: solo se podía crear una actividad si la unidad responsable estaba
--   entre las unidades del usuario (`app.user_unit_ids()`). Los roles
--   institucionales (superadmin / dpd_admin) no tienen asignaciones de unidad,
--   por lo que NO podían registrar actividades desde el asistente RAT.
--
--   AHORA: quien tiene `activity.update.all` (editar actividades de cualquier
--   unidad) puede además crearlas en cualquier unidad. Para el resto — jefe y
--   colaborador — la regla NO cambia: siguen restringidos a su(s) unidad(es).
--
--   Se mantiene: MFA (aal2) + `activity.create` + deny-by-default + FORCE RLS.
--   `pa_upd` ya contemplaba `activity.update.all`; esto solo alinea el INSERT.
--
--   Pruebas: supabase/tests/authz_wizard_test.sql (casos 4b.13).
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists pa_ins on processing_activities;

create policy pa_ins on processing_activities for insert
  with check (
    app.is_mfa()
    and app.has_perm('activity.create')
    and (
      app.has_perm('activity.update.all')                       -- rol institucional
      or responsible_unit_id in (select app.user_unit_ids())    -- o su propia unidad
    )
  );

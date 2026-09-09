-- ════════════════════════════════════════════════════════════════════════════
-- 0009_rls_policies.sql — CAPA 3: Row Level Security
--   deny-by-default en TODA tabla de negocio. FORCE RLS (aplica al owner).
--   service_role de Supabase tiene BYPASSRLS: solo lo usan Edge Functions,
--   siempre tras verificación explícita en código.
--   Ver docs/RLS_POLICIES.md para la explicación tabla por tabla y el mapeo
--   con la matriz de pruebas (docs/Fase4a_Contrato_Autorizacion.md §7).
-- ════════════════════════════════════════════════════════════════════════════

-- helper local: habilitar + forzar RLS
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','roles','permissions','role_permissions','user_roles','user_unit_assignments',
    'institutional_controller','data_protection_officer','feature_flags','app_settings',
    'organizational_units','organizational_unit_aliases','organizational_unit_closure',
    'unit_workflow_transitions','unit_rat_status_transitions','project_phases',
    'unit_engagements','engagement_contacts',
    'legal_bases','data_categories','subject_categories','recipient_types','security_measures',
    'transfer_guarantee_types','retention_criteria','campuses',
    'processing_activities','activity_intervening_units','activity_legal_bases',
    'activity_data_categories','activity_subject_categories','activity_recipients',
    'activity_transfers','activity_security_measures','activity_automated_decisions','activity_attachments',
    'workflow_transitions','activity_status_transitions','activity_reviews','review_observations',
    'activity_versions','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ IDENTIDAD Y RBAC                                                         │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- profiles: ve su fila; user.read ve todas; edita solo nombre/idioma propios.
create policy profiles_sel on profiles for select
  using (user_id = auth.uid() or app.has_perm('user.read'));
create policy profiles_upd_self on profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy profiles_mgmt on profiles for all
  using (app.has_perm('user.manage'))
  with check (app.has_perm('user.manage'));

-- roles / permissions / role_permissions: lectura autenticada; escritura role.manage
create policy roles_sel on roles for select using (auth.uid() is not null);
create policy perms_sel on permissions for select using (auth.uid() is not null);
create policy rp_sel on role_permissions for select using (auth.uid() is not null);
create policy roles_mgmt on roles for all using (app.has_perm('role.manage')) with check (app.has_perm('role.manage'));
create policy perms_mgmt on permissions for all using (app.has_perm('role.manage')) with check (app.has_perm('role.manage'));
create policy rp_mgmt on role_permissions for all using (app.has_perm('role.manage')) with check (app.has_perm('role.manage'));

-- user_roles: ve sus filas o user.read; escribe SOLO user.manage.  ── Caso 10
create policy ur_sel on user_roles for select
  using (user_id = auth.uid() or app.has_perm('user.read'));
create policy ur_ins on user_roles for insert
  with check (app.has_perm('user.manage'));
create policy ur_upd on user_roles for update
  using (app.has_perm('user.manage'))
  with check (app.has_perm('user.manage'));
create policy ur_del on user_roles for delete
  using (app.has_perm('user.manage'));

-- user_unit_assignments: idem.  ── Caso 10 + segregación de gestión de usuarios
create policy uua_sel on user_unit_assignments for select
  using (user_id = auth.uid() or app.has_perm('user.read'));
create policy uua_ins on user_unit_assignments for insert
  with check (app.has_perm('user.manage'));
create policy uua_upd on user_unit_assignments for update
  using (app.has_perm('user.manage'))
  with check (app.has_perm('user.manage'));
create policy uua_del on user_unit_assignments for delete
  using (app.has_perm('user.manage'));

-- Trigger anti-autoelevación: nadie modifica SUS PROPIOS roles/asignaciones,
-- ni siquiera con user.manage (defensa ante cuenta admin comprometida).  ── Caso 10
create or replace function app.guard_no_self_role_escalation() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if coalesce(new.user_id, old.user_id) = auth.uid()
     and current_setting('app.bootstrap', true) is distinct from 'on' then
    raise exception 'No puede modificar sus propios roles o asignaciones de unidad'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_ur_no_self before insert or update or delete on user_roles
  for each row execute function app.guard_no_self_role_escalation();
create trigger trg_uua_no_self before insert or update or delete on user_unit_assignments
  for each row execute function app.guard_no_self_role_escalation();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ CONFIGURACIÓN INSTITUCIONAL                                              │
-- ╰─────────────────────────────────────────────────────────────────────────╯
create policy ic_sel on institutional_controller for select using (auth.uid() is not null);
create policy ic_mgmt on institutional_controller for all using (app.has_perm('config.manage')) with check (app.has_perm('config.manage'));
create policy dpo_sel on data_protection_officer for select using (auth.uid() is not null);
create policy dpo_mgmt on data_protection_officer for all using (app.has_perm('config.manage')) with check (app.has_perm('config.manage'));
create policy ff_sel on feature_flags for select using (auth.uid() is not null);
create policy ff_mgmt on feature_flags for all using (app.has_perm('config.manage')) with check (app.has_perm('config.manage'));
create policy as_sel on app_settings for select using (app.is_institutional());
create policy as_mgmt on app_settings for all using (app.has_perm('config.manage')) with check (app.has_perm('config.manage'));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ UNIDADES                                                                 │
-- │ Lectura del árbol para todo autenticado con MFA (necesaria para navegar  │
-- │ y para el asistente de importación). El estado (rat_status) y los KPIs   │
-- │ de OTRAS unidades NO se exponen a usuarios de unidad: se sirven por RPC  │
-- │ (unit_dashboard / institutional_dashboard), no por esta tabla.           │
-- ╰─────────────────────────────────────────────────────────────────────────╯
create policy ou_sel on organizational_units for select
  using (app.is_mfa() and auth.uid() is not null);
create policy ou_mgmt on organizational_units for all
  using (app.has_perm('unit.manage'))
  with check (app.has_perm('unit.manage'));
-- rat_status solo se cambia por app.set_unit_rat_status(); bloquear UPDATE directo del campo.
create or replace function app.guard_unit_status_direct() returns trigger
language plpgsql as $$
begin
  if new.rat_status is distinct from old.rat_status
     and current_setting('app.unit_status_rpc', true) is distinct from 'on' then
    raise exception 'El estado de la unidad solo se cambia mediante set_unit_rat_status()'
      using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_ou_status_guard before update of rat_status on organizational_units
  for each row execute function app.guard_unit_status_direct();

create policy oua_sel on organizational_unit_aliases for select using (auth.uid() is not null);
create policy oua_mgmt on organizational_unit_aliases for all using (app.has_perm('unit.manage')) with check (app.has_perm('unit.manage'));
create policy ouc_sel on organizational_unit_closure for select using (auth.uid() is not null);

create policy uwt_sel on unit_workflow_transitions for select using (auth.uid() is not null);

-- transiciones de estado de unidad: institucional o miembro de la unidad
create policy urst_sel on unit_rat_status_transitions for select
  using (app.is_institutional() or unit_id in (select app.user_unit_ids()));

create policy pp_sel on project_phases for select using (auth.uid() is not null);
create policy pp_mgmt on project_phases for all using (app.has_perm('tracking.manage')) with check (app.has_perm('tracking.manage'));

-- seguimiento: institucional o miembro de la unidad
create policy ue_sel on unit_engagements for select
  using (app.has_perm('tracking.read.all') or unit_id in (select app.user_unit_ids()));
create policy ue_mgmt on unit_engagements for all
  using (app.has_perm('tracking.manage')) with check (app.has_perm('tracking.manage'));
create policy ec_sel on engagement_contacts for select
  using (app.has_perm('tracking.read.all') or unit_id in (select app.user_unit_ids()));
create policy ec_mgmt on engagement_contacts for all
  using (app.has_perm('tracking.manage')) with check (app.has_perm('tracking.manage'));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ CATÁLOGOS — lectura autenticada con MFA; escritura config.manage         │
-- ╰─────────────────────────────────────────────────────────────────────────╯
do $$
declare t text;
begin
  foreach t in array array['legal_bases','data_categories','subject_categories','recipient_types',
    'security_measures','transfer_guarantee_types','retention_criteria','campuses'] loop
    execute format('create policy %s_sel on %I for select using (app.is_mfa())', t, t);
    execute format('create policy %s_mgmt on %I for all using (app.has_perm(''config.manage'')) with check (app.has_perm(''config.manage''))', t, t);
  end loop;
end $$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ ACTIVIDADES DE TRATAMIENTO — núcleo de la segregación por unidad         │
-- │ Casos 1, 2, 8, 9                                                         │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create policy pa_sel on processing_activities for select
  using (
    app.is_mfa() and (
      app.has_perm('activity.read.all')
      or responsible_unit_id in (select app.user_unit_ids())
    )
  );

create policy pa_ins on processing_activities for insert
  with check (
    app.is_mfa()
    and app.has_perm('activity.create')
    and responsible_unit_id in (select app.user_unit_ids())   -- solo su unidad
  );

create policy pa_upd on processing_activities for update
  using (
    app.is_mfa() and (
      app.has_perm('activity.update.all')
      or (responsible_unit_id in (select app.user_unit_ids())
          and app.has_perm('activity.update.own_unit')
          and app.activity_is_editable(status))
    )
  )
  with check (
    app.has_perm('activity.update.all')
    or responsible_unit_id in (select app.user_unit_ids())    -- no puede "mudarla" a otra unidad
  );

-- sin policy de DELETE  →  nadie borra por API (borrado lógico vía RPC institucional)

-- helper para las hijas: ¿la actividad padre es visible / editable por mí?
create or replace function app.parent_activity_visible(p_activity uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1 from processing_activities a
    where a.id = p_activity
      and app.is_mfa()
      and (app.has_perm('activity.read.all') or a.responsible_unit_id in (select app.user_unit_ids()))
  )
$$;
create or replace function app.parent_activity_editable(p_activity uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1 from processing_activities a
    where a.id = p_activity and app.is_mfa()
      and (app.has_perm('activity.update.all')
           or (a.responsible_unit_id in (select app.user_unit_ids())
               and app.has_perm('activity.update.own_unit')
               and app.activity_is_editable(a.status)))
  )
$$;

-- políticas uniformes para todas las tablas hijas
do $$
declare t text;
begin
  foreach t in array app.activity_child_tables() loop
    execute format('create policy %1$s_sel on %1$I for select using (app.parent_activity_visible(activity_id))', t);
    execute format('create policy %1$s_ins on %1$I for insert with check (app.parent_activity_editable(activity_id))', t);
    execute format('create policy %1$s_upd on %1$I for update using (app.parent_activity_editable(activity_id)) with check (app.parent_activity_editable(activity_id))', t);
    execute format('create policy %1$s_del on %1$I for delete using (app.parent_activity_editable(activity_id))', t);
  end loop;
end $$;

-- workflow / transiciones / revisiones
create policy wt_sel on workflow_transitions for select using (auth.uid() is not null);

create policy ast_sel on activity_status_transitions for select
  using (app.parent_activity_visible(activity_id));
-- inserción solo por app.set_activity_status() (SECURITY DEFINER) → sin policy de insert

create policy arv_sel on activity_reviews for select
  using (app.parent_activity_visible(activity_id));
create policy arv_ins on activity_reviews for insert
  with check (app.has_perm('activity.review') and app.parent_activity_visible(activity_id));
create policy arv_upd on activity_reviews for update
  using (app.has_perm('activity.review'))
  with check (app.has_perm('activity.review'));

create policy ro_sel on review_observations for select
  using (app.parent_activity_visible(activity_id));
create policy ro_ins on review_observations for insert
  with check (app.has_perm('activity.review') and app.parent_activity_visible(activity_id));
-- el responsable de la unidad puede marcar resuelta una observación de SU actividad
create policy ro_upd on review_observations for update
  using (app.has_perm('activity.review') or app.parent_activity_editable(activity_id))
  with check (app.has_perm('activity.review') or app.parent_activity_editable(activity_id));

-- versiones: lectura si la actividad es visible; escritura solo por funciones
create policy av_sel on activity_versions for select
  using (app.parent_activity_visible(activity_id));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ AUDITORÍA — institucional ve todo; jefe/consulta ve su unidad            │
-- ╰─────────────────────────────────────────────────────────────────────────╯
create policy audit_sel on audit_log for select
  using (
    app.has_perm('audit.read')
    or (app.has_perm('audit.read.own_unit') and unit_id in (select app.user_unit_ids()))
  );
-- sin INSERT/UPDATE/DELETE: la escritura es exclusiva de app.write_audit()

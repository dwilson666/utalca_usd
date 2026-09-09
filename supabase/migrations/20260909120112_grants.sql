-- ════════════════════════════════════════════════════════════════════════════
-- 0012_grants.sql — normalización de privilegios (después de crear todo)
--   Principio de mínimo privilegio: authenticated solo lo necesario;
--   anon nada; funciones internas revocadas.
-- ════════════════════════════════════════════════════════════════════════════

-- ── esquemas ───────────────────────────────────────────────────────────────
revoke all on schema app from public, anon;
grant usage on schema app to authenticated, service_role;

-- ── tablas: PostgREST necesita el privilegio de tabla + RLS decide las filas ─
-- authenticated: SELECT/INSERT/UPDATE en tablas; DELETE solo donde hay política.
revoke all on all tables in schema public from anon, public;
grant select, insert, update on all tables in schema public to authenticated;
grant select, insert, update, delete on
  user_roles, user_unit_assignments, organizational_units, organizational_unit_aliases,
  legal_bases, data_categories, subject_categories, recipient_types, security_measures,
  transfer_guarantee_types, retention_criteria, campuses, feature_flags, app_settings,
  data_protection_officer, institutional_controller, project_phases, unit_engagements,
  engagement_contacts, activity_reviews, review_observations,
  activity_intervening_units, activity_legal_bases, activity_data_categories,
  activity_subject_categories, activity_recipients, activity_transfers,
  activity_security_measures, activity_automated_decisions, activity_attachments,
  import_batches, import_column_mappings, import_rows_staging
  to authenticated;
-- audit_log / activity_versions / *_transitions: solo SELECT (inmutables por API)
revoke insert, update, delete on audit_log, activity_versions,
  activity_status_transitions, unit_rat_status_transitions from authenticated;
grant select on audit_log, activity_versions, activity_status_transitions,
  unit_rat_status_transitions, unit_workflow_transitions, workflow_transitions,
  organizational_unit_closure, roles, permissions, role_permissions, unit_kpi_cache
  to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- ── funciones app.*: por defecto NADA; se concede lo llamable por RPC ───────
revoke execute on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated;

-- funciones internas (triggers / mantenimiento): revocar de authenticated
revoke execute on function
  app.write_audit(audit_action,text,text,uuid,text,text,text[],jsonb,audit_result,jsonb),
  app.rebuild_unit_closure(),
  app.handle_new_auth_user(),
  app.refresh_unit_kpi_cache(),
  app.trg_audit(),
  app.trg_touch_completeness(),
  app.trg_pa_self_completeness(),
  app.trg_version_on_status(),
  app.trg_pa_before_write(),
  app.trg_unit_hierarchy_changed(),
  app.trg_require_reinforced_basis(),
  app.guard_no_self_role_escalation(),
  app.guard_unit_status_direct(),
  app.guard_activity_status_direct(),
  app.touch_updated_at(),
  app.create_activity_version(uuid,text),
  app.build_activity_snapshot(uuid),
  app.recompute_completeness(uuid)
  from authenticated;

-- service_role (Edge Functions): ejecuta todo, PERO siempre tras verificación
-- explícita de autorización en código (ver docs/Fase4a_Contrato_Autorizacion.md §2).
grant execute on all functions in schema app to service_role;
grant all on all tables in schema public to service_role;

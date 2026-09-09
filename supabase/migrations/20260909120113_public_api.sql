-- ════════════════════════════════════════════════════════════════════════════
-- 0013_public_api.sql — superficie RPC para PostgREST
--   PostgREST solo expone el esquema `public`. Estos wrappers delegan en las
--   funciones `app.*` (que hacen su propia verificación de autorización).
--   No añaden lógica: solo exponen. SECURITY INVOKER.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.my_authz() returns jsonb
language sql stable as $$ select app.my_authz() $$;

create or replace function public.institutional_dashboard() returns jsonb
language sql stable as $$ select app.institutional_dashboard() $$;

create or replace function public.unit_dashboard(p_unit uuid) returns jsonb
language sql stable as $$ select app.unit_dashboard(p_unit) $$;

create or replace function public.set_activity_status(
  p_activity uuid, p_to activity_status, p_comment text default null) returns activity_status
language sql as $$ select app.set_activity_status(p_activity, p_to, p_comment) $$;

create or replace function public.set_unit_rat_status(
  p_unit uuid, p_to unit_rat_status, p_comment text default null) returns unit_rat_status
language sql as $$ select app.set_unit_rat_status(p_unit, p_to, p_comment) $$;

create or replace function public.diff_activity_versions(p_activity uuid, p_a int, p_b int) returns jsonb
language sql stable as $$ select app.diff_activity_versions(p_activity, p_a, p_b) $$;

create or replace function public.restore_activity_version(p_activity uuid, p_version int) returns int
language sql as $$ select app.restore_activity_version(p_activity, p_version) $$;

create or replace function public.verify_audit_chain(p_limit int default 100000)
returns table (ok boolean, broken_at bigint)
language sql as $$ select * from app.verify_audit_chain(p_limit) $$;

create or replace function public.import_commit(p_batch uuid) returns jsonb
language sql as $$ select app.import_commit(p_batch) $$;

-- permisos: solo authenticated (anon nada)
do $$
declare fn text;
begin
  for fn in
    select p.oid::regprocedure::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('my_authz','institutional_dashboard','unit_dashboard',
        'set_activity_status','set_unit_rat_status','diff_activity_versions',
        'restore_activity_version','verify_audit_chain','import_commit')
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;

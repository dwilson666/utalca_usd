-- ════════════════════════════════════════════════════════════════════════════
-- 20260909120114_mfa_toggle.sql — MFA como política configurable
--
--   DESVIACIÓN TEMPORAL respecto de D1 del contrato ("MFA TOTP obligatorio"),
--   decidida por la Unidad de Seguridad Digital para la fase de revisión con
--   la jefatura (menor fricción en el enlace compartido).
--
--   `app_settings['auth.require_mfa']`:
--     true  (producción) → RLS y frontend exigen sesión AAL2 (segundo factor).
--     false (revisión)   → se acepta AAL1; el frontend NO muestra el flujo TOTP.
--
--   Para volver a exigir MFA:
--     update app_settings set value = 'true' where key = 'auth.require_mfa';
--   (y habilitar TOTP a nivel de proyecto en el dashboard de Supabase).
-- ════════════════════════════════════════════════════════════════════════════

-- Valor por defecto SEGURO (coincide con D1). La desactivación para la fase de
-- revisión se hace como decisión operativa sobre el proyecto concreto:
--   update app_settings set value = 'false' where key = 'auth.require_mfa';
insert into app_settings (key, value) values ('auth.require_mfa', 'true'::jsonb)
on conflict (key) do nothing;

-- ¿la sesión cumple el requisito de segundo factor?
--   - AAL2 siempre cumple.
--   - Si la política 'auth.require_mfa' es false, AAL1 también cumple.
create or replace function app.is_mfa() returns boolean
language sql stable security definer set search_path = app, public as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
      'aal1'
    ) = 'aal2'
    or coalesce(
      (select value from app_settings where key = 'auth.require_mfa'),
      'true'::jsonb
    ) = 'false'::jsonb
$$;

-- exponer la política al frontend (para saltarse el flujo TOTP cuando no aplica)
create or replace function public.auth_policy() returns jsonb
language sql stable security definer set search_path = app, public as $$
  select jsonb_build_object(
    'require_mfa', coalesce(
      (select value from app_settings where key = 'auth.require_mfa'), 'true'::jsonb)
  )
$$;
revoke execute on function public.auth_policy() from public;
grant execute on function public.auth_policy() to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 20260909120117_ui_theme.sql — tema claro/oscuro configurable internamente
--
--   `app_settings['ui.default_theme']`  ('system' | 'light' | 'dark')
--     Predeterminado institucional que se aplica cuando la persona todavía no
--     eligió un tema propio (la elección individual vive en localStorage del
--     navegador: 'rat.theme').
--
--   Se expone por `public.auth_policy()`, que ya entrega la política de MFA;
--   el frontend lo lee una vez al cargar y llama a setInstitutionalDefault().
--
--   Para cambiar el predeterminado institucional:
--     update app_settings set value = '"dark"' where key = 'ui.default_theme';
-- ════════════════════════════════════════════════════════════════════════════

insert into app_settings (key, value) values ('ui.default_theme', '"system"'::jsonb)
on conflict (key) do nothing;

create or replace function public.auth_policy() returns jsonb
language sql stable security definer set search_path = app, public as $$
  select jsonb_build_object(
    'require_mfa', coalesce(
      (select value from app_settings where key = 'auth.require_mfa'), 'true'::jsonb),
    'ui_default_theme', coalesce(
      (select value from app_settings where key = 'ui.default_theme'), '"system"'::jsonb)
  )
$$;
revoke execute on function public.auth_policy() from public;
grant execute on function public.auth_policy() to anon, authenticated, service_role;

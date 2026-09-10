-- ════════════════════════════════════════════════════════════════════════════
-- 20260909120119_completeness_trigger_definer.sql
--
--   `app.recompute_completeness(uuid)` está (correctamente) revocada de
--   `authenticated`: no debe poder invocarse como RPC. Pero los triggers que
--   la llaman —`trg_pa_self_completeness` y `trg_touch_completeness`— corrían
--   como SECURITY INVOKER, así que al INSERT/UPDATE de una actividad hecho por
--   un usuario `authenticated` (el asistente RAT) fallaban con
--   «permission denied for function recompute_completeness».
--
--   Hasta ahora no se había notado porque todas las escrituras de actividades
--   eran vía seed (rol postgres). El asistente RAT (Fase 4b.1) es el primer
--   camino en que un usuario final inserta/edita actividades.
--
--   Solución: los dos triggers pasan a SECURITY DEFINER (propietario = postgres),
--   de modo que la llamada anidada a recompute_completeness queda autorizada.
--   Siguen revocados de `authenticated` (no invocables como RPC) y su lógica no
--   cambia. No se relaja ninguna política RLS.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function app.trg_touch_completeness() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  perform app.recompute_completeness(coalesce(new.activity_id, old.activity_id));
  return null;
end $$;

create or replace function app.trg_pa_self_completeness() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  perform app.recompute_completeness(new.id);
  return null;
end $$;

revoke execute on function app.trg_touch_completeness() from public, anon, authenticated;
revoke execute on function app.trg_pa_self_completeness() from public, anon, authenticated;

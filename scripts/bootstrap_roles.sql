-- ════════════════════════════════════════════════════════════════════════════
-- bootstrap_roles.sql — asignación INICIAL de roles a personas reales.
--
--   Se ejecuta UNA vez sobre la base en la nube por un operador con acceso
--   directo (psql). NO va en migraciones ni en seed: son datos operativos.
--   El mecanismo definitivo de asignación es la consola de Administración
--   (Fase 4b.3) + Edge Function `users-invite`, que hace exactamente este
--   INSERT sobre `user_roles` / `user_unit_assignments` tras verificar
--   `user.manage`. Este script es solo el arranque en frío.
--
--   Idempotente: se puede correr varias veces sin duplicar.
--   Uso:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/bootstrap_roles.sql
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- El trigger anti-autoelevación permite el arranque en frío con este flag.
select set_config('app.bootstrap', 'on', true);

-- ── David Wilson — Superadministrador (Unidad de Seguridad Digital) ─────────
insert into public.user_roles (user_id, role_id, scope)
select p.user_id, r.id, 'global'::role_scope
from public.profiles p, public.roles r
where p.email = 'david.wilson@utalca.cl' and r.code = 'superadmin'
on conflict (user_id, role_id) do update set revoked_at = null;

-- ── Alejandro Olea — Superadministrador ────────────────────────────────────
--   (antes tenía dpd_admin; superadmin incluye todos esos permisos)
insert into public.user_roles (user_id, role_id, scope)
select p.user_id, r.id, 'global'::role_scope
from public.profiles p, public.roles r
where p.email = 'alejandro.olea@utalca.cl' and r.code = 'superadmin'
on conflict (user_id, role_id) do update set revoked_at = null;

update public.user_roles ur
set revoked_at = now()
from public.profiles p, public.roles r
where ur.user_id = p.user_id and ur.role_id = r.id
  and p.email = 'alejandro.olea@utalca.cl' and r.code = 'dpd_admin'
  and ur.revoked_at is null;

-- ── edvasquez@utalca.cl — sin rol todavía ─────────────────────────────────
--   La cuenta existe (profile creado). Queda disponible para que un
--   administrador le asigne unidad + rol + permisos desde la consola 4b.3.
--   No se le asigna nada aquí a propósito.

select set_config('app.bootstrap', 'off', true);

-- Verificación
select p.email, r.code as rol, ur.scope, ur.revoked_at
from public.user_roles ur
join public.profiles p on p.user_id = ur.user_id
join public.roles r on r.id = ur.role_id
order by p.email, r.code;

commit;

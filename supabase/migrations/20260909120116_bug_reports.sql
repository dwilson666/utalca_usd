-- ════════════════════════════════════════════════════════════════════════════
-- 20260909120116_bug_reports.sql — reporte de errores desde la propia app
--   Cualquier usuario autenticado puede enviar un reporte (botón "bug").
--   Se guarda SIEMPRE en esta tabla; el correo es un extra (Edge Function
--   report-bug + Resend). Los roles institucionales los revisan y cierran.
-- ════════════════════════════════════════════════════════════════════════════

create type bug_status as enum ('nuevo', 'en_revision', 'resuelto', 'descartado');

create table bug_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_email   text,
  title            text not null check (length(title) between 3 and 200),
  description      text not null check (length(description) between 3 and 8000),
  url              text,
  route            text,
  user_agent       text,
  viewport         text,
  role_hint        text,
  console_errors   jsonb not null default '[]',
  app_commit       text,
  status           bug_status not null default 'nuevo',
  triaged_by       uuid references auth.users(id),
  resolved_at      timestamptz,
  resolution_note  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on bug_reports (status, created_at desc);
create index on bug_reports (reporter_user_id);

create trigger trg_bug_touch before update on bug_reports
  for each row execute function app.touch_updated_at();

alter table bug_reports enable row level security;
alter table bug_reports force row level security;

-- INSERT: cualquiera autenticado, solo a nombre propio.
create policy bug_ins on bug_reports for insert
  with check (auth.uid() is not null and reporter_user_id = auth.uid());

-- SELECT: institucional ve todo; el resto ve solo los suyos.
create policy bug_sel on bug_reports for select
  using (app.is_institutional() or reporter_user_id = auth.uid());

-- UPDATE (triage/cierre): solo institucional.
create policy bug_upd on bug_reports for update
  using (app.is_institutional())
  with check (app.is_institutional());

grant select, insert, update on bug_reports to authenticated;
grant all on bug_reports to service_role;

-- destino del correo de notificación (lo usa la Edge Function report-bug)
insert into app_settings (key, value)
values ('bug.notify_email', '"davidlaawl@gmail.com"'::jsonb)
on conflict (key) do nothing;

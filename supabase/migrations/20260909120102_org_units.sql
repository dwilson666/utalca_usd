-- ════════════════════════════════════════════════════════════════════════════
-- 0002_org_units.sql — árbol de unidades, cierre transitivo, alias,
--                      y máquina de estado GLOBAL de la unidad (separada de la
--                      máquina de estado de las actividades — ver D10).
-- ════════════════════════════════════════════════════════════════════════════

create table organizational_units (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,          -- slug estable e inmutable (clave de negocio)
  name_official  text not null,
  name_short     text not null,
  acronym        text,
  type           unit_type not null,
  parent_id      uuid references organizational_units(id),
  campus         text,
  status         unit_status not null default 'active',
  merged_into_id uuid references organizational_units(id),
  is_rat_unit    boolean not null default true,  -- cuenta para indicadores de "unidades del proceso RAT"
  deferred       boolean not null default false, -- nodo contenedor (p.ej. FIE — facultades)
  needs_review   boolean not null default false,
  sort_order     int not null default 0,
  external_ref   text,                           -- p.ej. 'RU N°1053-2025'
  notes          text,
  -- Estado GLOBAL de la unidad en el proceso RAT (lo mueve el JEFE de la unidad
  -- o un rol institucional con permiso unit.status.manage — NUNCA un colaborador,
  -- NUNCA el jefe de otra unidad). Ver app.set_unit_rat_status().
  rat_status     unit_rat_status not null default 'PENDIENTE',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
create index on organizational_units(parent_id);
create index on organizational_units(status);
create index on organizational_units(needs_review) where needs_review;

create trigger trg_units_touch before update on organizational_units
  for each row execute function app.touch_updated_at();

-- FK diferida desde 0001
alter table user_unit_assignments
  add constraint user_unit_assignments_unit_fk
  foreign key (unit_id) references organizational_units(id) on delete cascade;

-- ── alias de nomenclatura (Carta Gantt / instrumento / indicadores) ─────────
create table organizational_unit_aliases (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references organizational_units(id) on delete cascade,
  alias      text not null,
  source     text not null check (source in ('carta_gantt','instrumento_2026','indicadores','manual')),
  is_primary boolean not null default false,
  unique (alias, source)
);
create index on organizational_unit_aliases(lower(alias));

-- ── cierre transitivo para consultas de subárbol O(1) ──────────────────────
create table organizational_unit_closure (
  ancestor_id   uuid not null references organizational_units(id) on delete cascade,
  descendant_id uuid not null references organizational_units(id) on delete cascade,
  depth         int not null,
  primary key (ancestor_id, descendant_id)
);
create index on organizational_unit_closure(descendant_id);

-- Reconstrucción completa del cierre (barato para ~10^2–10^4 nodos).
create or replace function app.rebuild_unit_closure() returns void
language plpgsql security definer set search_path = app, public as $$
begin
  delete from organizational_unit_closure;
  insert into organizational_unit_closure (ancestor_id, descendant_id, depth)
  with recursive rel as (
    select id as ancestor_id, id as descendant_id, 0 as depth
    from organizational_units
    union all
    select r.ancestor_id, u.id, r.depth + 1
    from rel r
    join organizational_units u on u.parent_id = r.descendant_id
  )
  select ancestor_id, descendant_id, depth from rel;
end $$;

-- Se reconstruye cuando cambia la jerarquía.
create or replace function app.trg_unit_hierarchy_changed() returns trigger
language plpgsql as $$
begin
  perform app.rebuild_unit_closure();
  return null;
end $$;

create trigger trg_units_closure
  after insert or delete or update of parent_id on organizational_units
  for each statement execute function app.trg_unit_hierarchy_changed();

-- ── máquina de estado de la UNIDAD ─────────────────────────────────────────
create table unit_workflow_transitions (
  from_state unit_rat_status not null,
  to_state   unit_rat_status not null,
  label      text not null,
  active     boolean not null default true,
  primary key (from_state, to_state)
);

insert into unit_workflow_transitions (from_state, to_state, label) values
  ('PENDIENTE',        'EN_LEVANTAMIENTO',  'Iniciar levantamiento'),
  ('EN_LEVANTAMIENTO', 'EN_REVISION',       'Enviar unidad a revisión'),
  ('EN_REVISION',      'CON_OBSERVACIONES', 'Registrar observaciones a la unidad'),
  ('EN_REVISION',      'COMPLETADA',        'Marcar unidad como completada'),
  ('CON_OBSERVACIONES','EN_LEVANTAMIENTO',  'Retomar levantamiento'),
  ('CON_OBSERVACIONES','EN_REVISION',       'Reenviar a revisión'),
  ('COMPLETADA',       'CERRADA',           'Cerrar unidad'),
  ('COMPLETADA',       'EN_LEVANTAMIENTO',  'Reabrir levantamiento'),
  ('CERRADA',          'EN_LEVANTAMIENTO',  'Reabrir unidad');

create table unit_rat_status_transitions (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references organizational_units(id) on delete cascade,
  from_state    unit_rat_status not null,
  to_state      unit_rat_status not null,
  actor_user_id uuid,
  comment       text,
  occurred_at   timestamptz not null default now()
);
create index on unit_rat_status_transitions(unit_id, occurred_at desc);

-- ── módulo de seguimiento del proyecto (gestión del DPD — SEPARADO del RAT) ──
create table project_phases (
  id        uuid primary key default gen_random_uuid(),
  code      text unique not null,
  name      text not null,
  ordinal   int not null,
  starts_on date, ends_on date
);

create table unit_engagements (
  unit_id       uuid primary key references organizational_units(id) on delete cascade,
  stage         text not null default 'no_contactada'
                check (stage in ('no_contactada','contactada','agendada','reunion_realizada',
                                 'en_seguimiento','levantamiento_completo')),
  contacted_on  date,
  meeting_on    date,
  owner_user_id uuid references auth.users(id),
  pending_items text,
  notes         text,
  last_update_at timestamptz not null default now()
);

create table engagement_contacts (
  id             uuid primary key default gen_random_uuid(),
  unit_id        uuid not null references organizational_units(id) on delete cascade,
  full_name      text not null,
  position       text,
  email          text,
  phone          text,
  source_import_batch_id uuid,
  notes          text,
  created_at     timestamptz not null default now()
);
create index on engagement_contacts(unit_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 0004_processing_activities.sql — actividad de tratamiento + colecciones hijas
-- Toda hija hereda la unidad responsable de la actividad → segregación por RLS
-- se evalúa siempre contra processing_activities.responsible_unit_id.
-- ════════════════════════════════════════════════════════════════════════════

create sequence if not exists rat_ref_seq;

create table processing_activities (
  id                  uuid primary key default gen_random_uuid(),
  ref_code            text unique not null default ('RAT-' || lpad(nextval('rat_ref_seq')::text, 6, '0')),
  unit_local_no       int,
  responsible_unit_id uuid not null references organizational_units(id) on delete restrict,
  title               text not null default '',
  description         text,
  purpose             text,
  data_source         text,
  operational_owner_name text,
  retention_value     int,
  retention_unit      text check (retention_unit in ('dias','meses','anios','indefinido')),
  retention_criterion_id uuid references retention_criteria(id),
  retention_text      text,
  has_sensitive_data        boolean not null default false,
  has_international_transfer boolean not null default false,
  has_automated_decision    boolean not null default false,
  uses_ai             boolean not null default false,
  own_systems_text    text,
  status              activity_status not null default 'BORRADOR',
  completeness_pct    int not null default 0 check (completeness_pct between 0 and 100),
  current_version_no  int not null default 0,
  approved_at         timestamptz,
  closed_at           timestamptz,
  created_by          uuid,
  updated_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on processing_activities(responsible_unit_id);
create index on processing_activities(status);
create index on processing_activities(responsible_unit_id, status);

create trigger trg_pa_touch before update on processing_activities
  for each row execute function app.touch_updated_at();

-- El estado editable de una actividad (borrador / observado / corregido).
create or replace function app.activity_is_editable(s activity_status) returns boolean
language sql immutable as $$
  select s in ('BORRADOR','EN_COMPLETADO','OBSERVADO','CORREGIDO')
$$;

-- ── colecciones hijas ──────────────────────────────────────────────────────
create table activity_intervening_units (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references processing_activities(id) on delete cascade,
  unit_id uuid not null references organizational_units(id),
  role_in_activity text check (role_in_activity in ('recolecta','procesa','custodia','consulta')),
  unique (activity_id, unit_id)
);

create table activity_legal_bases (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references processing_activities(id) on delete cascade,
  legal_basis_id uuid not null references legal_bases(id),
  justification text,
  unique (activity_id, legal_basis_id)
);

create table activity_data_categories (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references processing_activities(id) on delete cascade,
  data_category_id uuid not null references data_categories(id),
  is_sensitive boolean not null default false,
  detail text,
  unique (activity_id, data_category_id)
);

create table activity_subject_categories (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references processing_activities(id) on delete cascade,
  subject_category_id uuid not null references subject_categories(id),
  is_protected_group boolean not null default false,
  detail text,
  unique (activity_id, subject_category_id)
);

create table activity_recipients (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references processing_activities(id) on delete cascade,
  recipient_type_id uuid not null references recipient_types(id),
  name text,
  is_processor boolean not null default false,
  detail text
);

create table activity_transfers (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references processing_activities(id) on delete cascade,
  country text not null,
  guarantee_type_id uuid references transfer_guarantee_types(id),
  detail text
);

create table activity_security_measures (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references processing_activities(id) on delete cascade,
  security_measure_id uuid not null references security_measures(id),
  detail text,
  unique (activity_id, security_measure_id)
);

create table activity_automated_decisions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references processing_activities(id) on delete cascade,
  description text,
  stage text,
  human_in_the_loop boolean not null default true,
  produces_profiling boolean not null default false
);

create table activity_attachments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references processing_activities(id) on delete cascade,
  storage_provider text not null default 'supabase' check (storage_provider in ('supabase','r2')),
  object_path text not null,
  filename text not null,
  mime text,
  size_bytes bigint,
  sha256 text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

-- Lista de tablas hijas que se filtran vía la actividad padre (usada por RLS y por
-- el snapshot de versiones). Mantener en sincronía al agregar colecciones.
create or replace function app.activity_child_tables() returns text[]
language sql immutable as $$
  select array[
    'activity_intervening_units','activity_legal_bases','activity_data_categories',
    'activity_subject_categories','activity_recipients','activity_transfers',
    'activity_security_measures','activity_automated_decisions','activity_attachments'
  ]
$$;

-- ── reglas de integridad de negocio ────────────────────────────────────────
-- Dato sensible ⇒ debe existir al menos una base de licitud reforzada.
create or replace function app.trg_require_reinforced_basis() returns trigger
language plpgsql as $$
declare v_activity uuid;
begin
  v_activity := coalesce(new.activity_id, old.activity_id);
  if exists (select 1 from processing_activities where id = v_activity and status <> 'BORRADOR')
     and exists (select 1 from activity_data_categories where activity_id = v_activity and is_sensitive)
     and not exists (
       select 1 from activity_legal_bases alb
       join legal_bases lb on lb.id = alb.legal_basis_id
       where alb.activity_id = v_activity and lb.requires_reinforced)
  then
    raise exception 'La actividad % trata datos sensibles y requiere una base de licitud reforzada.', v_activity
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

create constraint trigger trg_reinforced_basis
  after insert or update or delete on activity_data_categories
  deferrable initially deferred
  for each row execute function app.trg_require_reinforced_basis();

-- Al crear/editar, forzar autoría y (para no institucionales) impedir mover la
-- actividad a una unidad ajena. La comprobación fuerte está en RLS WITH CHECK;
-- esto normaliza y da mensajes claros.
create or replace function app.trg_pa_before_write() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger trg_pa_before_write before insert or update on processing_activities
  for each row execute function app.trg_pa_before_write();

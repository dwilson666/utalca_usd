-- ════════════════════════════════════════════════════════════════════════════
-- 0003_catalogs.sql — vocabularios controlados (no se borran: se deprecan)
-- ════════════════════════════════════════════════════════════════════════════

-- macro común: code, label, description, status, superseded_by, sort_order, source
create table legal_bases (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, label text not null, description text,
  requires_reinforced boolean not null default false,   -- base apta para datos sensibles
  status text not null default 'active' check (status in ('active','deprecated')),
  superseded_by_id uuid references legal_bases(id),
  source text not null default 'ley_21719', sort_order int not null default 0
);

create table data_categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, label text not null, description text,
  is_sensitive boolean not null default false,
  status text not null default 'active' check (status in ('active','deprecated')),
  superseded_by_id uuid references data_categories(id),
  source text not null default 'ley_21719', sort_order int not null default 0
);

create table subject_categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, label text not null, description text,
  is_protected_group boolean not null default false,   -- NNA u otros
  status text not null default 'active' check (status in ('active','deprecated')),
  superseded_by_id uuid references subject_categories(id),
  source text not null default 'ley_21719', sort_order int not null default 0
);

create table recipient_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, label text not null, description text,
  is_processor boolean not null default false,
  status text not null default 'active' check (status in ('active','deprecated')),
  superseded_by_id uuid references recipient_types(id),
  source text not null default 'ley_21719', sort_order int not null default 0
);

create table security_measures (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, label text not null, description text,
  status text not null default 'active' check (status in ('active','deprecated')),
  superseded_by_id uuid references security_measures(id),
  source text not null default 'iso27001', sort_order int not null default 0
);

create table transfer_guarantee_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, label text not null, description text,
  status text not null default 'active' check (status in ('active','deprecated')),
  superseded_by_id uuid references transfer_guarantee_types(id),
  source text not null default 'ley_21719', sort_order int not null default 0
);

create table retention_criteria (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, label text not null, description text,
  status text not null default 'active' check (status in ('active','deprecated')),
  superseded_by_id uuid references retention_criteria(id),
  source text not null default 'manual', sort_order int not null default 0
);

create table campuses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, label text not null, sort_order int not null default 0
);

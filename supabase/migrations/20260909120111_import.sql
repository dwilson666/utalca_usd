-- ════════════════════════════════════════════════════════════════════════════
-- 0011_import.sql — staging de importación del Excel institucional
--   Solo roles con import.execute (institucional). NUNCA publica actividades:
--   crea contactos de seguimiento y BORRADORES para curación manual (D4).
-- ════════════════════════════════════════════════════════════════════════════

create table import_batches (
  id              uuid primary key default gen_random_uuid(),
  source_filename text not null,
  sheet_names     text[],
  uploaded_by     uuid not null,
  status          import_batch_status not null default 'uploaded',
  summary         jsonb not null default '{}',
  committed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create table import_column_mappings (
  id            uuid primary key default gen_random_uuid(),
  template_key  text not null,
  source_column text not null,
  target_field  text not null,
  transform     text,
  unique (template_key, source_column)
);

create table import_rows_staging (
  id               uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references import_batches(id) on delete cascade,
  sheet            text not null,
  source_row_no    int,
  raw              jsonb not null,
  mapped           jsonb,
  classification   import_row_class not null default 'empty',
  validation       import_row_validation not null default 'valid',
  messages         jsonb not null default '[]',
  resolved_unit_id uuid references organizational_units(id),
  target           text check (target in ('processing_activity','engagement_contact','discarded')),
  result_entity_id uuid
);
create index on import_rows_staging(batch_id);

alter table import_batches enable row level security;
alter table import_batches force row level security;
alter table import_column_mappings enable row level security;
alter table import_column_mappings force row level security;
alter table import_rows_staging enable row level security;
alter table import_rows_staging force row level security;

create policy ib_all on import_batches for all
  using (app.has_perm('import.execute')) with check (app.has_perm('import.execute'));
create policy icm_all on import_column_mappings for all
  using (app.has_perm('import.execute')) with check (app.has_perm('import.execute'));
create policy irs_all on import_rows_staging for all
  using (app.has_perm('import.execute')) with check (app.has_perm('import.execute'));

-- Resolver una hoja del Excel a una unidad canónica por alias.
create or replace function app.resolve_unit_by_alias(p_alias text) returns uuid
language sql stable security definer set search_path = app, public as $$
  select coalesce(
    (select unit_id from organizational_unit_aliases where lower(alias) = lower(p_alias) order by is_primary desc limit 1),
    (select id from organizational_units where lower(name_official) = lower(p_alias)
                                            or lower(name_short) = lower(p_alias) limit 1)
  )
$$;

-- Commit: crea contactos + BORRADORES en staging. Nunca aprueba/cierra.
create or replace function app.import_commit(p_batch uuid)
returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare r record; v_contacts int := 0; v_seeds int := 0; v_act uuid;
begin
  if not (app.is_mfa() and app.has_perm('import.execute')) then
    raise exception 'Importación no autorizada' using errcode = '42501';
  end if;

  for r in select * from import_rows_staging
           where batch_id = p_batch and validation in ('valid','warning') loop
    if r.classification = 'contact' and r.resolved_unit_id is not null then
      insert into engagement_contacts(unit_id, full_name, position, email, phone, source_import_batch_id, notes)
      values (r.resolved_unit_id,
              coalesce(r.mapped->>'full_name','(sin nombre)'),
              r.mapped->>'position', nullif(r.mapped->>'email',''),
              r.mapped->>'phone', p_batch, r.mapped->>'notes');
      update import_rows_staging set validation = 'imported', target = 'engagement_contact' where id = r.id;
      v_contacts := v_contacts + 1;

    elsif r.classification = 'activity_seed' and r.resolved_unit_id is not null then
      insert into processing_activities(responsible_unit_id, title, description, status)
      values (r.resolved_unit_id,
              coalesce(nullif(r.mapped->>'title',''), 'Actividad importada (por completar)'),
              r.mapped->>'description', 'BORRADOR')   -- SIEMPRE borrador
      returning id into v_act;
      update import_rows_staging
        set validation = 'imported', target = 'processing_activity', result_entity_id = v_act
        where id = r.id;
      v_seeds := v_seeds + 1;
    end if;
  end loop;

  update import_batches set status = 'committed', committed_at = now(),
    summary = summary || jsonb_build_object('contacts_created', v_contacts, 'activity_drafts_created', v_seeds)
    where id = p_batch;

  perform app.write_audit('import', 'import_batches', p_batch::text, null, null, null, null,
    jsonb_build_object('contacts', v_contacts, 'drafts', v_seeds), 'success'::audit_result, null::jsonb);

  return jsonb_build_object('contacts_created', v_contacts, 'activity_drafts_created', v_seeds);
end $$;

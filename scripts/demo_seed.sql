-- ════════════════════════════════════════════════════════════════════════════
-- demo_seed.sql — DATOS DE DEMOSTRACIÓN (NO producción, NO migración, NO CI).
--   Puebla actividades, contactos y estados de unidad para mostrar el dashboard.
--   Idempotente (ids fijos + on conflict). Ejecutar como postgres.
--   Para limpiar: ver el bloque final comentado.
-- ════════════════════════════════════════════════════════════════════════════

-- helper: id de unidad por code
create or replace function pg_temp.u(code text) returns uuid
language sql stable as $$ select id from organizational_units where organizational_units.code = $1 $$;

-- helper: id de catálogo
create or replace function pg_temp.lb(c text) returns uuid language sql stable as $$ select id from legal_bases where code=$1 $$;
create or replace function pg_temp.dc(c text) returns uuid language sql stable as $$ select id from data_categories where code=$1 $$;
create or replace function pg_temp.sc(c text) returns uuid language sql stable as $$ select id from subject_categories where code=$1 $$;
create or replace function pg_temp.sm(c text) returns uuid language sql stable as $$ select id from security_measures where code=$1 $$;
create or replace function pg_temp.rt(c text) returns uuid language sql stable as $$ select id from recipient_types where code=$1 $$;

-- ── ACTIVIDADES ────────────────────────────────────────────────────────────
insert into processing_activities
  (id, responsible_unit_id, title, purpose, description, data_source,
   operational_owner_name, retention_criterion_id, retention_text, status)
values
 ('d0000000-0000-4000-a000-000000000001', pg_temp.u('VRA'),
  'Recepción de RU para pago de incentivos por publicación',
  'Gestionar la numeración de la resolución que autoriza el pago del incentivo por publicación.',
  'El académico presenta la RU; la unidad la numera y deriva a Transparencia y RR.HH. para el pago.',
  'Del propio académico y de sistemas internos de investigación.',
  'Isabel Salazar',
  (select id from retention_criteria where code='politica_institucional'),
  'Conservada en la nube institucional según su política de retención.', 'APROBADO'),

 ('d0000000-0000-4000-a000-000000000002', pg_temp.u('VRA'),
  'Gestión de pago de incentivos de investigación',
  'Realizar el pago de incentivos a través de las asignaciones de investigación.',
  'La Dirección de Investigación recibe la solicitud, valida la calidad contractual y tramita el pago.',
  'Del propio académico.', 'Karolayn Moya',
  (select id from retention_criteria where code='politica_institucional'),
  'Nube universitaria, por el tiempo que establezca su política.', 'EN_REVISION'),

 ('d0000000-0000-4000-a000-000000000003', pg_temp.u('VRA'),
  'Movilidad e intercambio internacional de estudiantes y académicos',
  'Gestionar intercambios, viajes de investigación y movilidad entrante y saliente.',
  'La Dirección de Relaciones Internacionales administra visados, seguros y situación académica de los participantes.',
  'Del propio titular y de las instituciones de destino.', 'Roxana Vergara',
  (select id from retention_criteria where code='fin_finalidad'),
  'Según el período de conservación de la nube institucional.', 'EN_REVISION'),

 ('d0000000-0000-4000-a000-000000000004', pg_temp.u('VRA-DBIB'),
  'Gestión de préstamos y usuarios de Bibliotecas',
  'Administrar el préstamo de material bibliográfico y el registro de usuarios.',
  null, null, 'Dirección de Bibliotecas', null, null, 'BORRADOR'),

 ('d0000000-0000-4000-a000-000000000010', pg_temp.u('VDE'),
  'Acreditación socioeconómica estudiantil (FAES)',
  'Asignar beneficios estudiantiles según la evaluación socioeconómica de estudiantes de pregrado.',
  'El estudiante carga antecedentes en la plataforma FAES; asistentes sociales evalúan; la dirección aprueba.',
  'Del propio titular (formulario) y del Ministerio de Educación.',
  'Jorge Gajardo',
  (select id from retention_criteria where code='vinculo_mas_n'),
  'Durante el vínculo del estudiante y según política institucional.', 'OBSERVADO'),

 ('d0000000-0000-4000-a000-000000000011', pg_temp.u('VDE'),
  'Registro de atención de salud estudiantil',
  'Registrar las atenciones de salud prestadas a estudiantes para gestión y estadística.',
  'La Dirección de Salud Estudiantil registra la atención en un formulario; solo estadística agregada se comparte.',
  'Del profesional de salud que presta la atención.', 'Daniel Jiménez',
  (select id from retention_criteria where code='plazo_legal'),
  'Según normativa sectorial de salud (Ley 20.584).', 'BORRADOR'),

 ('d0000000-0000-4000-a000-000000000012', pg_temp.u('VDE-DBE'),
  'Reportes de beneficios estudiantiles al Ministerio',
  'Consolidar y remitir información de beneficios al Ministerio de Educación y al proceso de admisión.',
  null, 'Del Ministerio de Educación y de sistemas internos.', 'Judith Méndez',
  (select id from retention_criteria where code='plazo_legal'), null, 'EN_COMPLETADO'),

 ('d0000000-0000-4000-a000-000000000020', pg_temp.u('SG'),
  'Registro y trayectoria académica de estudiantes',
  'Mantener el expediente académico oficial de cada estudiante.',
  'El Departamento de Registro Académico administra matrícula, notas y certificaciones.',
  'Del proceso de matrícula y de las unidades académicas.', 'Ana San Martín',
  (select id from retention_criteria where code='plazo_legal'),
  'Expediente académico: conservación permanente según normativa.', 'APROBADO'),

 ('d0000000-0000-4000-a000-000000000030', pg_temp.u('CONTR'),
  'Auditorías internas de procesos institucionales',
  'Ejecutar el plan anual de auditoría interna sobre procesos y unidades.',
  null, 'De las unidades auditadas y de sistemas internos.', 'Darío Fuenzalida',
  (select id from retention_criteria where code='politica_institucional'), null, 'BORRADOR'),

 ('d0000000-0000-4000-a000-000000000040', pg_temp.u('DAC'),
  'Gestión de procesos de acreditación institucional y de carreras',
  'Recopilar evidencia y coordinar los procesos de acreditación ante la CNA.',
  null, 'De las unidades académicas y administrativas.', 'Carolina Ulloa',
  (select id from retention_criteria where code='fin_finalidad'), null, 'EN_COMPLETADO')
on conflict (id) do nothing;

-- ── categorías de datos / titulares / bases / medidas / destinatarios ──────
insert into activity_data_categories (activity_id, data_category_id, is_sensitive, detail)
select a::uuid, pg_temp.dc(c),
       (select is_sensitive from data_categories where code=c), null
from (values
  ('d0000000-0000-4000-a000-000000000001','identificativos'),('d0000000-0000-4000-a000-000000000001','bancarios'),
  ('d0000000-0000-4000-a000-000000000002','identificativos'),('d0000000-0000-4000-a000-000000000002','contacto'),('d0000000-0000-4000-a000-000000000002','bancarios'),
  ('d0000000-0000-4000-a000-000000000003','identificativos'),('d0000000-0000-4000-a000-000000000003','academicos'),
  ('d0000000-0000-4000-a000-000000000010','identificativos'),('d0000000-0000-4000-a000-000000000010','contacto'),('d0000000-0000-4000-a000-000000000010','academicos'),('d0000000-0000-4000-a000-000000000010','socioeconomica'),
  ('d0000000-0000-4000-a000-000000000011','identificativos'),('d0000000-0000-4000-a000-000000000011','salud'),
  ('d0000000-0000-4000-a000-000000000020','identificativos'),('d0000000-0000-4000-a000-000000000020','contacto'),('d0000000-0000-4000-a000-000000000020','academicos'),
  ('d0000000-0000-4000-a000-000000000040','identificativos'),('d0000000-0000-4000-a000-000000000040','academicos')
) v(a,c)
on conflict (activity_id, data_category_id) do nothing;

insert into activity_subject_categories (activity_id, subject_category_id)
select a::uuid, pg_temp.sc(c) from (values
  ('d0000000-0000-4000-a000-000000000001','academicos'),
  ('d0000000-0000-4000-a000-000000000002','academicos'),('d0000000-0000-4000-a000-000000000002','estudiantes'),
  ('d0000000-0000-4000-a000-000000000003','estudiantes'),('d0000000-0000-4000-a000-000000000003','academicos'),
  ('d0000000-0000-4000-a000-000000000010','estudiantes'),('d0000000-0000-4000-a000-000000000010','apoderados'),
  ('d0000000-0000-4000-a000-000000000011','estudiantes'),
  ('d0000000-0000-4000-a000-000000000020','estudiantes'),
  ('d0000000-0000-4000-a000-000000000040','estudiantes'),('d0000000-0000-4000-a000-000000000040','academicos')
) v(a,c)
on conflict (activity_id, subject_category_id) do nothing;

insert into activity_legal_bases (activity_id, legal_basis_id, justification)
select a::uuid, pg_temp.lb(c), j from (values
  ('d0000000-0000-4000-a000-000000000001','obligacion_legal','Cumplimiento de obligaciones contractuales y de rendición.'),
  ('d0000000-0000-4000-a000-000000000002','contrato','Ejecución de la asignación de incentivos.'),
  ('d0000000-0000-4000-a000-000000000003','funcion_publica','Ejercicio de funciones propias de la Universidad.'),
  ('d0000000-0000-4000-a000-000000000010','consentimiento_explicito','El estudiante autoriza el tratamiento de su situación socioeconómica al postular al beneficio.'),
  ('d0000000-0000-4000-a000-000000000020','obligacion_legal','Normativa de registro académico y aseguramiento de la calidad.'),
  ('d0000000-0000-4000-a000-000000000012','obligacion_legal','Reporte obligatorio al Ministerio de Educación.'),
  ('d0000000-0000-4000-a000-000000000040','funcion_publica','Procesos de acreditación exigidos por ley.')
) v(a,c,j)
on conflict (activity_id, legal_basis_id) do nothing;

insert into activity_security_measures (activity_id, security_measure_id)
select a::uuid, pg_temp.sm(c) from (values
  ('d0000000-0000-4000-a000-000000000001','acceso_rol'),('d0000000-0000-4000-a000-000000000001','mfa'),
  ('d0000000-0000-4000-a000-000000000002','acceso_rol'),
  ('d0000000-0000-4000-a000-000000000003','cifrado_transito'),('d0000000-0000-4000-a000-000000000003','acceso_rol'),
  ('d0000000-0000-4000-a000-000000000010','acceso_rol'),('d0000000-0000-4000-a000-000000000010','trazabilidad'),
  ('d0000000-0000-4000-a000-000000000020','acceso_rol'),('d0000000-0000-4000-a000-000000000020','respaldos'),
  ('d0000000-0000-4000-a000-000000000040','acceso_rol')
) v(a,c)
on conflict (activity_id, security_measure_id) do nothing;

insert into activity_recipients (activity_id, recipient_type_id, name, is_processor)
select a::uuid, pg_temp.rt(c), n, false from (values
  ('d0000000-0000-4000-a000-000000000001','interno','Oficina de Transparencia; RR.HH.'),
  ('d0000000-0000-4000-a000-000000000003','institucion_educativa','Instituciones de destino del intercambio'),
  ('d0000000-0000-4000-a000-000000000010','organismo_publico','Ministerio de Educación'),
  ('d0000000-0000-4000-a000-000000000012','organismo_publico','Ministerio de Educación'),
  ('d0000000-0000-4000-a000-000000000020','organismo_publico','Ministerio de Educación (SIES)')
) v(a,c,n);

update processing_activities set has_international_transfer = true
where id = 'd0000000-0000-4000-a000-000000000003';
insert into activity_transfers (activity_id, country, detail)
values ('d0000000-0000-4000-a000-000000000003','Varios (según destino del intercambio)','Se remite situación académica y de seguros a la institución receptora.')
on conflict do nothing;

-- ── una observación abierta (para RAT-…010) ───────────────────────────────
insert into activity_reviews (id, activity_id, reviewer_user_id, outcome, summary)
values ('d0000000-0000-4000-a000-0000000000aa','d0000000-0000-4000-a000-000000000010',
        (select id from auth.users where email='david.wilson@utalca.cl'),'observed',
        'Falta precisar base de licitud reforzada y criterio de conservación.')
on conflict (id) do nothing;
insert into review_observations (review_id, activity_id, field_path, severity, text)
values ('d0000000-0000-4000-a000-0000000000aa','d0000000-0000-4000-a000-000000000010',
        'base_licitud','obligatoria',
        'Trata situación socioeconómica (dato sensible). Confirmar la base reforzada y, si es ejercicio de función pública, citar la norma.')
on conflict do nothing;

-- ── ESTADO DE UNIDAD ──────────────────────────────────────────────────────
select set_config('app.unit_status_rpc','on',true);
update organizational_units set rat_status='EN_REVISION'      where code='VRA'  and rat_status='PENDIENTE';
update organizational_units set rat_status='CON_OBSERVACIONES' where code='VDE'  and rat_status='PENDIENTE';
update organizational_units set rat_status='EN_LEVANTAMIENTO'  where code in ('SG','CONTR','DAC') and rat_status='PENDIENTE';
select set_config('app.unit_status_rpc','off',true);

-- ── CONTACTOS DE SEGUIMIENTO (muestra de "responsables levantados") ────────
insert into engagement_contacts (unit_id, full_name, position, email, notes)
select pg_temp.u(c), n, p, e, null from (values
  ('VRA','Rodrigo Palomo','Vicerrector Académico','rodrigo.palomo@utalca.cl'),
  ('VRA','Isabel Salazar','Analista de incentivos','isabel.salazar@utalca.cl'),
  ('VRA-DINV','Roberto Jara','Director de Investigación','roberto.jara@utalca.cl'),
  ('VRA-DRI','María Elisa Quinteros','Directora de RR.II.','melisa.quinteros@utalca.cl'),
  ('VDE','Paula Jorquera','Vicerrectora de Desarrollo Estudiantil','paula.jorquera@utalca.cl'),
  ('VDE-DBE','Sandra Chamorro','Directora de Bienestar Estudiantil','sandra.chamorro@utalca.cl'),
  ('VDE-DSE','Daniel Jiménez','Director de Salud Estudiantil','daniel.jimenez@utalca.cl'),
  ('SG','Isabel Hernández','Secretaria General','isabel.hernandez@utalca.cl'),
  ('SG-DRA','Ana San Martín','Jefa de Registro Académico','ana.sanmartin@utalca.cl'),
  ('CONTR','Johann Allesch','Contralor','johann.allesch@utalca.cl'),
  ('DAC','Eduardo Álvarez','Director de Aseguramiento de la Calidad','eduardo.alvarez@utalca.cl'),
  ('VGEA','Luis Urra','Vicerrector de Gestión Económica','luis.urra@utalca.cl'),
  ('VRF','Carla Forster','Jefa Depto. Calidad de la Formación','carla.forster@utalca.cl')
) v(c,n,p,e)
where not exists (select 1 from engagement_contacts ec where ec.unit_id = pg_temp.u(c) and ec.email = e);

-- ── seguimiento por unidad ────────────────────────────────────────────────
update unit_engagements set stage='levantamiento_completo', meeting_on = current_date - 20, contacted_on = current_date - 35
  where unit_id in (pg_temp.u('VRA'), pg_temp.u('VDE'));
update unit_engagements set stage='en_seguimiento', contacted_on = current_date - 15
  where unit_id in (pg_temp.u('SG'), pg_temp.u('CONTR'), pg_temp.u('DAC'));
update unit_engagements set stage='agendada', contacted_on = current_date - 5, meeting_on = current_date + 3
  where unit_id in (pg_temp.u('VGEA'), pg_temp.u('VRF'));

-- recalcular completitud de todo (por si algún trigger no cubrió alguna vía)
select app.recompute_completeness(id) from processing_activities;

select 'actividades='||count(*)||'  aprobadas='||count(*) filter (where status='APROBADO') from processing_activities;
select 'contactos='||count(*) from engagement_contacts;

-- ── LIMPIEZA (descomentar para revertir la demo) ──────────────────────────
-- delete from processing_activities where id::text like 'd0000000-0000-4000-a000-%';
-- delete from engagement_contacts where email like '%@utalca.cl' and full_name in ('Rodrigo Palomo','Isabel Salazar', ...);
-- select set_config('app.unit_status_rpc','on',true);
-- update organizational_units set rat_status='PENDIENTE' where code in ('VRA','VDE','SG','CONTR','DAC');

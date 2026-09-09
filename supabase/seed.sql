-- ════════════════════════════════════════════════════════════════════════════
-- seed.sql — datos maestros (producción-safe). Se ejecuta tras las migraciones.
--   NO crea usuarios ni actividades. Solo: permisos, roles, catálogos,
--   configuración institucional, fases de proyecto y el árbol de unidades.
-- ════════════════════════════════════════════════════════════════════════════

-- ── permisos atómicos ──────────────────────────────────────────────────────
insert into permissions (code, category, description) values
  ('activity.read.all','actividad','Ver actividades de todas las unidades'),
  ('activity.read.own_unit','actividad','Ver actividades de su(s) unidad(es)'),
  ('activity.create','actividad','Crear actividades en su(s) unidad(es)'),
  ('activity.update.all','actividad','Editar actividades de cualquier unidad'),
  ('activity.update.own_unit','actividad','Editar actividades de su(s) unidad(es)'),
  ('activity.submit','actividad','Enviar actividades a revisión'),
  ('activity.review','actividad','Revisar: aprobar / observar'),
  ('activity.close','actividad','Cerrar actividades aprobadas'),
  ('activity.reopen','actividad','Reabrir actividades cerradas'),
  ('activity.delete','actividad','Borrado lógico de actividades'),
  ('unit.read.all','unidad','Ver todas las unidades y su estado'),
  ('unit.manage','unidad','Crear / editar / mover unidades'),
  ('unit.status.manage','unidad','Cambiar el estado global de cualquier unidad'),
  ('user.read','usuarios','Ver usuarios y sus asignaciones'),
  ('user.manage','usuarios','Invitar usuarios, asignar roles y unidades'),
  ('role.manage','usuarios','Editar la matriz rol × permiso'),
  ('config.manage','config','Catálogos, DPD, responsable, flags'),
  ('import.execute','import','Ejecutar importaciones'),
  ('export.execute','export','Exportar RAT / indicadores'),
  ('audit.read','auditoria','Ver toda la auditoría'),
  ('audit.read.own_unit','auditoria','Ver la auditoría de su(s) unidad(es)'),
  ('tracking.read.all','seguimiento','Ver el seguimiento de todas las unidades'),
  ('tracking.read.own_unit','seguimiento','Ver el seguimiento de su unidad'),
  ('tracking.manage','seguimiento','Gestionar el seguimiento del proyecto'),
  ('institutional.view','institucional','Acceder a información institucional consolidada')
on conflict (code) do nothing;

-- ── roles ──────────────────────────────────────────────────────────────────
insert into roles (code, name, description) values
  ('superadmin','Superadministrador','Acceso completo al sistema'),
  ('dpd_admin','Administrador RAT / DPD','Supervisión institucional del proceso RAT'),
  ('auditor','Auditor / Consulta','Solo lectura de lo autorizado + auditoría'),
  ('unit_manager','Responsable de Unidad (jefe)','Gestiona su unidad y su estado global'),
  ('collaborator','Colaborador','Edita actividades de su unidad')
on conflict (code) do nothing;

-- ── matriz rol × permiso ───────────────────────────────────────────────────
-- superadmin: todos
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p where r.code = 'superadmin'
on conflict do nothing;

-- dpd_admin
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.code in (
  'activity.read.all','activity.create','activity.update.all','activity.update.own_unit',
  'activity.submit','activity.review','activity.close','activity.reopen','activity.delete',
  'unit.read.all','unit.status.manage','config.manage','import.execute','export.execute',
  'audit.read','tracking.read.all','tracking.manage','institutional.view')
where r.code = 'dpd_admin' on conflict do nothing;

-- auditor (solo lectura)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.code in (
  'activity.read.all','unit.read.all','export.execute','audit.read',
  'tracking.read.all','institutional.view')
where r.code = 'auditor' on conflict do nothing;

-- unit_manager (jefe) — SIN unit.status.manage: su autoridad sobre el estado de
-- SU unidad se resuelve por app.is_jefe_of(), no por permiso global.
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.code in (
  'activity.read.own_unit','activity.create','activity.update.own_unit','activity.submit',
  'export.execute','audit.read.own_unit','tracking.read.own_unit')
where r.code = 'unit_manager' on conflict do nothing;

-- collaborator
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.code in (
  'activity.read.own_unit','activity.create','activity.update.own_unit','tracking.read.own_unit')
where r.code = 'collaborator' on conflict do nothing;

-- ── configuración institucional ────────────────────────────────────────────
insert into institutional_controller (id, legal_name, rut, address, legal_representative)
values (1, 'Universidad de Talca', '70.885.500-6', '2 Norte 685, Talca', 'Rector/a')
on conflict (id) do nothing;

insert into data_protection_officer (name, unit_label, email)
values ('Delegado de Protección de Datos', 'Oficina de Seguridad Digital', 'dpd@utalca.cl')
on conflict do nothing;

insert into feature_flags (key, enabled, description) values
  ('demo_mode', false, 'Habilita el selector de rol y datos de demostración. NUNCA en producción.'),
  ('email_notifications', false, 'Envío de notificaciones por correo institucional (post-MVP).')
on conflict (key) do nothing;

insert into app_settings (key, value) values
  ('completeness.obligatory_threshold', '100'),
  ('password.min_length', '12'),
  ('password.check_hibp', 'true'),
  ('session.idle_minutes', '30'),
  ('attachment.max_mb', '10'),
  ('attachment.allowed_mime', '["application/pdf","image/png","image/jpeg","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]'),
  ('audit.retention_years', '6')
on conflict (key) do nothing;

-- ── fases del proyecto (Carta Gantt) ───────────────────────────────────────
insert into project_phases (code, name, ordinal) values
  ('F1','Contacto y coordinación con unidades',1),
  ('F2','Levantamiento de información (reuniones)',2),
  ('F3','Seguimiento de unidades pendientes',3),
  ('F4','Consolidación y redacción del RAT',4),
  ('F5','Revisión y entrega',5)
on conflict (code) do nothing;

-- ── catálogos (semilla Ley 21.719 + valores observados en Fase 1) ──────────
insert into legal_bases (code,label,requires_reinforced,source,sort_order) values
  ('consentimiento','Consentimiento del titular',false,'ley_21719',1),
  ('contrato','Ejecución de un contrato',false,'ley_21719',2),
  ('obligacion_legal','Cumplimiento de una obligación legal',false,'ley_21719',3),
  ('interes_legitimo','Interés legítimo del responsable',false,'ley_21719',4),
  ('interes_vital','Interés vital del titular',false,'ley_21719',5),
  ('funcion_publica','Ejercicio de funciones de un órgano público',false,'ley_21719',6),
  ('consentimiento_explicito','Consentimiento explícito (datos sensibles)',true,'ley_21719',7),
  ('fines_estadisticos','Fines históricos, estadísticos o científicos',true,'ley_21719',8)
on conflict (code) do nothing;

insert into data_categories (code,label,is_sensitive,source,sort_order) values
  ('identificativos','Identificativos',false,'ley_21719',1),
  ('contacto','Contacto',false,'ley_21719',2),
  ('academicos','Académicos',false,'observado',3),
  ('laborales','Laborales',false,'observado',4),
  ('economicos','Económicos / financieros',false,'observado',5),
  ('bancarios','Datos bancarios',false,'observado',6),
  ('uso_sistemas','Conducta / uso de sistemas',false,'observado',7),
  ('salud','Salud',true,'ley_21719',20),
  ('biometricos','Biométricos',true,'ley_21719',21),
  ('origen_etnico','Origen étnico o racial',true,'ley_21719',22),
  ('afiliacion_sindical','Afiliación sindical',true,'ley_21719',23),
  ('afiliacion_politica','Afiliación política',true,'ley_21719',24),
  ('creencias','Creencias o convicciones',true,'ley_21719',25),
  ('vida_sexual','Vida sexual u orientación sexual',true,'ley_21719',26),
  ('socioeconomica','Situación socioeconómica',true,'ley_21719',27)
on conflict (code) do nothing;

insert into subject_categories (code,label,is_protected_group,source,sort_order) values
  ('estudiantes','Estudiantes',false,'observado',1),
  ('postulantes','Postulantes',false,'observado',2),
  ('alumni','Egresados / alumni',false,'observado',3),
  ('academicos','Académicos/as',false,'observado',4),
  ('funcionarios','Funcionarios/as',false,'observado',5),
  ('honorarios','Personal a honorarios',false,'observado',6),
  ('investigadores','Investigadores/as',false,'observado',7),
  ('proveedores','Proveedores',false,'observado',8),
  ('pacientes','Pacientes',false,'observado',9),
  ('participantes_inv','Participantes de investigación',false,'observado',10),
  ('participantes_ext','Participantes de extensión',false,'observado',11),
  ('apoderados','Apoderados',false,'observado',12),
  ('nna','Niños, niñas y adolescentes (NNA)',true,'ley_21719',13)
on conflict (code) do nothing;

insert into recipient_types (code,label,is_processor,source,sort_order) values
  ('interno','Unidades internas',false,'observado',1),
  ('encargado','Encargado de tratamiento (proveedor)',true,'ley_21719',2),
  ('organismo_publico','Organismo público / regulador',false,'ley_21719',3),
  ('institucion_educativa','Institución educativa receptora',false,'observado',4),
  ('red_salud','Campos clínicos / red de salud',false,'observado',5),
  ('entidad_bancaria','Entidad bancaria',false,'observado',6)
on conflict (code) do nothing;

insert into security_measures (code,label,source,sort_order) values
  ('acceso_rol','Control de acceso por rol','iso27001',1),
  ('mfa','Autenticación multifactor (MFA)','iso27001',2),
  ('cifrado_transito','Cifrado en tránsito','iso27001',3),
  ('cifrado_reposo','Cifrado en reposo','iso27001',4),
  ('respaldos','Respaldos','iso27001',5),
  ('trazabilidad','Registro y trazabilidad','iso27001',6),
  ('confidencialidad','Acuerdos de confidencialidad','iso27001',7),
  ('capacitacion','Capacitación','iso27001',8),
  ('anonimizacion','Anonimización / seudonimización','iso27001',9),
  ('acceso_fisico','Acceso físico restringido','iso27001',10)
on conflict (code) do nothing;

insert into transfer_guarantee_types (code,label,source,sort_order) values
  ('clausulas_tipo','Cláusulas contractuales tipo','ley_21719',1),
  ('nivel_adecuado','País con nivel de protección adecuado','ley_21719',2),
  ('consentimiento','Consentimiento del titular','ley_21719',3),
  ('normas_vinculantes','Normas corporativas vinculantes (BCR)','ley_21719',4),
  ('sin_garantia','Sin garantía formal (a corregir)','manual',9)
on conflict (code) do nothing;

insert into retention_criteria (code,label,source,sort_order) values
  ('plazo_legal','Plazo legal sectorial','manual',1),
  ('vinculo_mas_n','Duración del vínculo + N años','manual',2),
  ('fin_finalidad','Hasta el fin de la finalidad','manual',3),
  ('politica_institucional','Política institucional documentada','manual',4),
  ('sin_criterio','Sin criterio definido (a corregir)','manual',9)
on conflict (code) do nothing;

insert into campuses (code,label,sort_order) values
  ('talca','Talca',1),('linares','Linares',2),
  ('colchagua','Colchagua (Santa Cruz)',3),('santiago','Santiago',4)
on conflict (code) do nothing;

-- ── árbol de unidades (generado) ───────────────────────────────────────────
\i seed/units.sql

-- ── estado de seguimiento inicial por unidad ──────────────────────────────
insert into unit_engagements (unit_id, stage)
select id, 'no_contactada' from organizational_units
where is_rat_unit and not deferred
on conflict (unit_id) do nothing;

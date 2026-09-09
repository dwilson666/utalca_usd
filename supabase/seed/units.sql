-- GENERADO por scripts/gen_units_seed.py desde seed-data/organizational_units.v0.1.json
-- No editar a mano. Idempotente (on conflict do nothing / update por code).
set app.bootstrap = 'on';

insert into organizational_units (code,name_official,name_short,acronym,type,campus,is_rat_unit,deferred,needs_review,sort_order,external_ref,notes) values
  ('CS','Consejo Superior','Consejo Superior','CS','consejo',null,false,false,false,1,'RU N°1053-2025',null),
  ('CONTR','Contraloría Universitaria','Contraloría','CONTR','contraloria','Talca',true,false,false,2,'RU N°1053-2025','Relación funcional con el Consejo Superior (informar/rectificar).'),
  ('CONTR-DCL','Departamento de Control Legal','Control Legal',null,'departamento','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('CONTR-DAI','Departamento de Auditoría Interna','Auditoría Interna',null,'departamento','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('RECT','Rectoría','Rectoría','RECT','rectoria','Talca',false,false,false,3,'RU N°1053-2025',null),
  ('SG','Secretaría General','Secretaría General','SG','secretaria_general','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('SG-DRA','Departamento de Registro Académico','Registro Académico',null,'departamento','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('SG-OGT','Oficina de Gobierno Transparente','Gobierno Transparente',null,'oficina','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('SG-OP','Oficina de Partes','Oficina de Partes',null,'oficina','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('DGEN','Dirección de Género','Dirección de Género',null,'direccion','Talca',true,false,true,2,'RU N°1053-2025','Confirmar dependencia (Rectoría vs Secretaría General) y unidades hijas.'),
  ('UCU','Unidad de Convivencia Universitaria','Convivencia Universitaria','UCU','unidad','Talca',true,false,true,3,'RU N°1053-2025',null),
  ('OPB','Oficina de Proyectos Basales','Proyectos Basales',null,'oficina','Talca',true,false,true,4,'RU N°1053-2025','Dependencia por confirmar (Rectoría / VGEA).'),
  ('OTDA','Oficina de Transformación Digital Administrativa','Transformación Digital Administrativa',null,'oficina','Talca',true,false,true,5,'RU N°1053-2025','Dependencia por confirmar.'),
  ('OSD','Oficina de Seguridad Digital','Seguridad Digital','OSD','oficina','Talca',true,false,true,6,'RU N°1053-2025','Unidad a cargo del proyecto RAT / rol de DPD institucional. Dependencia por confirmar.'),
  ('VRA','Vicerrectoría Académica','V. Académica','VRA','vicerrectoria','Talca',true,false,false,7,'RU N°1053-2025',null),
  ('VRA-DINV','Dirección de Investigación','Investigación',null,'direccion','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VRA-DINV-UPI','Unidad de Proyectos de Investigación','Proyectos de Investigación',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VRA-DINV-UGI','Unidad de Gestión de la Investigación','Gestión de la Investigación',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VRA-DIT','Dirección de Innovación y Transferencia','Innovación y Transferencia',null,'direccion','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VRA-DIT-UPIT','Unidad de Proyectos de Innovación y Transferencia','Proyectos de Innovación y Transferencia',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VRA-DIT-UGIE','Unidad de Gestión de la Innovación y Emprendimiento','Gestión de la Innovación y Emprendimiento',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VRA-DCRE','Dirección de Creación','Creación',null,'direccion','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VRA-DCRE-UPC','Unidad de Proyectos de Creación','Proyectos de Creación',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VRA-DCRE-UGC','Unidad de Gestión de la Creación','Gestión de la Creación',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VRA-DRI','Dirección de Relaciones Internacionales','Relaciones Internacionales','RRII','direccion','Talca',true,false,false,4,'RU N°1053-2025',null),
  ('VRA-DRI-UM','Unidad de Movilidad','Movilidad',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VRA-DRI-UCI','Unidad de Cooperación Internacional','Cooperación Internacional',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VRA-DRI-OIB','Oficina Internacional de Bienvenida','Internacional de Bienvenida',null,'oficina','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VRA-DBIB','Dirección de Bibliotecas','Bibliotecas',null,'direccion','Talca',true,false,false,5,'RU N°1053-2025',null),
  ('VRA-DBIB-UGPT','Unidad de Gestión de Proyectos Transversales','Proyectos Transversales',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VGEA','Vicerrectoría de Gestión Económica y Administración','VGEA','VGEA','vicerrectoria','Talca',true,false,false,8,'RU N°1053-2025',null),
  ('VGEA-DF','Dirección de Finanzas','Finanzas',null,'direccion','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VGEA-DF-DT','Departamento de Tesorería','Tesorería',null,'departamento','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VGEA-DF-DCB','Departamento de Contabilidad y Bienes','Contabilidad y Bienes',null,'departamento','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VGEA-DF-DGPP','Departamento de Gestión de Pago a Proveedores','Pago a Proveedores',null,'departamento','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VGEA-DF-DAFE','Departamento de Apoyo Financiero al Estudiante','Apoyo Financiero al Estudiante',null,'departamento','Talca',true,false,true,4,'RU N°1053-2025',null),
  ('VGEA-DF-DP','Departamento de Presupuesto','Presupuesto',null,'departamento','Talca',true,false,false,5,'RU N°1053-2025',null),
  ('VGEA-DPER','Dirección de Personas','Personas',null,'direccion','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VGEA-DPER-DGP','Departamento de Gestión de Personas','Gestión de Personas',null,'departamento','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VGEA-DPER-UR','Unidad de Remuneraciones','Remuneraciones',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VGEA-DPER-DDP','Departamento de Desarrollo de Personas','Desarrollo de Personas',null,'departamento','Talca',true,false,true,3,'RU N°1053-2025',null),
  ('VGEA-DPER-BP','Bienestar del Personal','Bienestar del Personal',null,'unidad','Talca',true,false,false,4,'RU N°1053-2025',null),
  ('VGEA-DLS','Dirección de Logística y Servicios','Logística y Servicios',null,'direccion','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VGEA-DLS-DGC','Departamento de Gestión de Compras','Gestión de Compras',null,'departamento','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VGEA-DLS-UCE','Unidad de Compras Estratégicas','Compras Estratégicas',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VGEA-DLS-UPRMA','Unidad de Prevención de Riesgos y Medio Ambiente','Prevención de Riesgos y Medio Ambiente',null,'unidad','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VGEA-DLS-DAC','Departamento de Administración de Campus','Administración de Campus',null,'departamento','Talca',true,false,false,4,'RU N°1053-2025',null),
  ('VGEA-DLS-UM','Unidad de Mantenimiento','Mantenimiento',null,'unidad','Talca',true,false,false,5,'RU N°1053-2025',null),
  ('VGEA-DTI','Dirección de Tecnologías de Información','Tecnologías de Información','DTI','direccion','Talca',true,false,false,4,'RU N°1053-2025',null),
  ('VGEA-DTI-DSPTI','Departamento de Servicios y Procesos TI','Servicios y Procesos TI',null,'departamento','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VGEA-DTI-DPTI','Departamento de Plataformas TI','Plataformas TI',null,'departamento','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VGEA-DTI-DS','Departamento de Sistemas','Sistemas',null,'departamento','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VDE','Vicerrectoría de Desarrollo Estudiantil','VDE','VDE','vicerrectoria','Talca',true,false,false,9,'RU N°1053-2025',null),
  ('VDE-DBE','Dirección de Bienestar Estudiantil','Bienestar Estudiantil',null,'direccion','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VDE-DSE','Dirección de Salud Estudiantil','Salud Estudiantil',null,'direccion','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VDE-DAOIE','Dirección de Apoyo a Organizaciones e Iniciativas Estudiantiles','Apoyo a Organizaciones e Iniciativas Estudiantiles','DAOI','direccion','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VRF','Vicerrectoría de Formación','V. Formación','VRF','vicerrectoria','Talca',true,false,false,10,'RU N°1053-2025',null),
  ('VRF-DCF','Departamento de Calidad de la Formación','Calidad de la Formación',null,'departamento','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VRF-AD','Academia Docente','Academia Docente',null,'academia','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VRF-DPRE','Dirección de Pregrado','Pregrado',null,'direccion','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VRF-DPRE-UDCP','Unidad de Desarrollo Curricular de Pregrado','Desarrollo Curricular de Pregrado',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VRF-DPRE-UAE','Unidad de Acompañamiento Estudiantil (CIMA)','Acompañamiento Estudiantil (CIMA)','CIMA','unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VRF-DPRE-PD','Programa de Deportes','Deportes',null,'programa','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VRF-DPRE-PI','Programa de Idiomas','Idiomas',null,'programa','Talca',true,false,false,4,'RU N°1053-2025',null),
  ('VRF-DPRE-PFF','Programa de Formación Fundamental','Formación Fundamental',null,'programa','Talca',true,false,false,5,'RU N°1053-2025',null),
  ('VRF-DPOS','Dirección de Postgrado','Postgrado',null,'direccion','Talca',true,false,false,4,'RU N°1053-2025',null),
  ('VRF-DPOS-UDCP','Unidad de Desarrollo Curricular de Postgrado','Desarrollo Curricular de Postgrado',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VRF-DPOS-UPA','Unidad de Promoción y Acompañamiento','Promoción y Acompañamiento',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VRF-DPOS-UEC','Unidad de Educación Continua','Educación Continua',null,'unidad','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VRF-DPOS-OTEC','Organismo Técnico de Capacitación (OTEC)','OTEC','OTEC','unidad','Talca',true,false,false,4,'RU N°1053-2025',null),
  ('VRF-DCVE','Dirección de Ciclo de Vida Estudiantil','Ciclo de Vida Estudiantil',null,'direccion','Talca',true,false,false,5,'RU N°1053-2025',null),
  ('VRF-DCVE-UVSE','Unidad de Vinculación con el Sistema Escolar','Vinculación con el Sistema Escolar',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VRF-DCVE-UAA','Unidad de Admisión y Acceso','Admisión y Acceso',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VRF-DCVE-DGIE','Departamento de Gestión de Información Estudiantil','Gestión de Información Estudiantil',null,'departamento','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('VRF-DCVE-UAIL','Unidad Alumni e Inserción Laboral','Alumni e Inserción Laboral',null,'unidad','Talca',true,false,false,4,'RU N°1053-2025',null),
  ('VRF-DTE','Dirección Tecnologías Educativas','Tecnologías Educativas',null,'direccion','Talca',true,false,false,6,'RU N°1053-2025',null),
  ('VRF-DTE-URDD','Unidad de Recursos Digitales Docentes','Recursos Digitales Docentes',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('VRF-DTE-UA','Unidad de Aplicaciones','Aplicaciones',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('VRF-DTE-ULMS','Unidad LMS - Educandus','LMS - Educandus',null,'unidad','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('DAC','Dirección de Aseguramiento de la Calidad','Aseguramiento de la Calidad','DAC','direccion','Talca',true,false,false,11,'RU N°1053-2025',null),
  ('DAC-DPPE','Departamento de Planificación y Proyectos Estratégicos','Planificación y Proyectos Estratégicos',null,'departamento','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('DAC-DAAC','Departamento de Análisis y Aseguramiento de la Calidad','Análisis y Aseguramiento de la Calidad',null,'departamento','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('DAC-DDI','Departamento de Desarrollo de Infraestructura','Desarrollo de Infraestructura',null,'departamento','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('DAC-DRSCC','Departamento de Red de Salud y Campos Clínicos','Red de Salud y Campos Clínicos',null,'departamento','Talca',true,false,false,4,'RU N°1053-2025',null),
  ('DAC-DACR','Departamento de Acreditación','Acreditación',null,'departamento','Talca',true,false,false,5,'RU N°1053-2025',null),
  ('DAC-DACR-UAPRE','Unidad de Acreditación de Pregrado','Acreditación de Pregrado',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('DAC-DACR-UAPOS','Unidad de Acreditación de Postgrado','Acreditación de Postgrado',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('DAJ','Dirección de Asuntos Jurídicos','Asuntos Jurídicos','DAJ','direccion','Talca',true,false,false,12,'RU N°1053-2025',null),
  ('FISC','Fiscalía Universitaria','Fiscalía Universitaria',null,'direccion','Talca',true,false,false,13,'RU N°1053-2025',null),
  ('SEDE-SC','Dirección de Sede Santa Cruz','Sede Santa Cruz',null,'sede','Colchagua (Santa Cruz)',true,false,false,14,'RU N°1053-2025',null),
  ('SEDE-STGO','Dirección de Sede Santiago','Sede Santiago',null,'sede','Santiago',true,false,false,15,'RU N°1053-2025',null),
  ('DGVM','Dirección General de Vinculación con el Medio','Vinculación con el Medio','DGVM','direccion_general','Talca',true,false,false,16,'RU N°1053-2025',null),
  ('DGVM-DSUS','Departamento de Sustentabilidad','Sustentabilidad',null,'departamento','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('DGVM-DSUS-JB','Jardín Botánico','Jardín Botánico',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('DGVM-DAV','Departamento de Aseguramiento de la Vinculación','Aseguramiento de la Vinculación',null,'departamento','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('DGVM-UDIV','Unidad de Divulgación','Divulgación',null,'unidad','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('DGVM-UDT','Unidad de Desarrollo Territorial','Desarrollo Territorial',null,'unidad','Talca',true,false,false,4,'RU N°1053-2025',null),
  ('DCC','Dirección de Comunicaciones Corporativas','Comunicaciones Corporativas','DCC','direccion','Talca',true,false,false,17,'RU N°1053-2025',null),
  ('DCC-DBRAND','Departamento de Branding','Branding',null,'departamento','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('DCC-DCEM','Departamento de Comunicación Externa y Medios','Comunicación Externa y Medios',null,'departamento','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('DCC-DCI','Departamento de Comunicación Interna','Comunicación Interna',null,'departamento','Talca',true,false,false,3,'RU N°1053-2025',null),
  ('DEXT','Dirección de Extensión','Extensión',null,'direccion','Talca',true,false,false,18,'RU N°1053-2025',null),
  ('DEXT-UGCA','Unidad de Gestión Cultural y Artística','Gestión Cultural y Artística',null,'unidad','Talca',true,false,false,1,'RU N°1053-2025',null),
  ('DEXT-UPA','Unidad de Patrimonio Artístico','Patrimonio Artístico',null,'unidad','Talca',true,false,false,2,'RU N°1053-2025',null),
  ('EDIT','Editorial Universidad de Talca','Editorial',null,'unidad','Talca',true,false,false,19,'RU N°1053-2025',null),
  ('FIE','Facultades, Institutos y Escuelas','Facultades, Institutos y Escuelas','FIE','otro',null,true,true,false,20,'RU N°1053-2025','Rama DIFERIDA. Se poblará después con Facultades (Medicina, Cs. de la Salud, Odontología, Economía y Negocios, Cs. Jurídicas y Sociales, Ingeniería, Cs., etc.), sus escuelas y departamentos. No requiere cambios de modelo: se insertan como descendientes de FIE.')
on conflict (code) do nothing;

-- parentesco
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'CONTR' and p.code = 'CS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'CONTR-DCL' and p.code = 'CONTR';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'CONTR-DAI' and p.code = 'CONTR';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'SG' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'SG-DRA' and p.code = 'SG';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'SG-OGT' and p.code = 'SG';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'SG-OP' and p.code = 'SG';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DGEN' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'UCU' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'OPB' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'OTDA' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'OSD' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DINV' and p.code = 'VRA';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DINV-UPI' and p.code = 'VRA-DINV';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DINV-UGI' and p.code = 'VRA-DINV';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DIT' and p.code = 'VRA';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DIT-UPIT' and p.code = 'VRA-DIT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DIT-UGIE' and p.code = 'VRA-DIT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DCRE' and p.code = 'VRA';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DCRE-UPC' and p.code = 'VRA-DCRE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DCRE-UGC' and p.code = 'VRA-DCRE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DRI' and p.code = 'VRA';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DRI-UM' and p.code = 'VRA-DRI';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DRI-UCI' and p.code = 'VRA-DRI';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DRI-OIB' and p.code = 'VRA-DRI';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DBIB' and p.code = 'VRA';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRA-DBIB-UGPT' and p.code = 'VRA-DBIB';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DF' and p.code = 'VGEA';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DF-DT' and p.code = 'VGEA-DF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DF-DCB' and p.code = 'VGEA-DF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DF-DGPP' and p.code = 'VGEA-DF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DF-DAFE' and p.code = 'VGEA-DF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DF-DP' and p.code = 'VGEA-DF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DPER' and p.code = 'VGEA';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DPER-DGP' and p.code = 'VGEA-DPER';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DPER-UR' and p.code = 'VGEA-DPER';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DPER-DDP' and p.code = 'VGEA-DPER';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DPER-BP' and p.code = 'VGEA-DPER';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DLS' and p.code = 'VGEA';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DLS-DGC' and p.code = 'VGEA-DLS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DLS-UCE' and p.code = 'VGEA-DLS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DLS-UPRMA' and p.code = 'VGEA-DLS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DLS-DAC' and p.code = 'VGEA-DLS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DLS-UM' and p.code = 'VGEA-DLS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DTI' and p.code = 'VGEA';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DTI-DSPTI' and p.code = 'VGEA-DTI';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DTI-DPTI' and p.code = 'VGEA-DTI';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VGEA-DTI-DS' and p.code = 'VGEA-DTI';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VDE' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VDE-DBE' and p.code = 'VDE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VDE-DSE' and p.code = 'VDE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VDE-DAOIE' and p.code = 'VDE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DCF' and p.code = 'VRF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-AD' and p.code = 'VRF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPRE' and p.code = 'VRF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPRE-UDCP' and p.code = 'VRF-DPRE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPRE-UAE' and p.code = 'VRF-DPRE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPRE-PD' and p.code = 'VRF-DPRE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPRE-PI' and p.code = 'VRF-DPRE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPRE-PFF' and p.code = 'VRF-DPRE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPOS' and p.code = 'VRF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPOS-UDCP' and p.code = 'VRF-DPOS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPOS-UPA' and p.code = 'VRF-DPOS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPOS-UEC' and p.code = 'VRF-DPOS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DPOS-OTEC' and p.code = 'VRF-DPOS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DCVE' and p.code = 'VRF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DCVE-UVSE' and p.code = 'VRF-DCVE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DCVE-UAA' and p.code = 'VRF-DCVE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DCVE-DGIE' and p.code = 'VRF-DCVE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DCVE-UAIL' and p.code = 'VRF-DCVE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DTE' and p.code = 'VRF';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DTE-URDD' and p.code = 'VRF-DTE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DTE-UA' and p.code = 'VRF-DTE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'VRF-DTE-ULMS' and p.code = 'VRF-DTE';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DAC' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DAC-DPPE' and p.code = 'DAC';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DAC-DAAC' and p.code = 'DAC';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DAC-DDI' and p.code = 'DAC';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DAC-DRSCC' and p.code = 'DAC';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DAC-DACR' and p.code = 'DAC';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DAC-DACR-UAPRE' and p.code = 'DAC-DACR';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DAC-DACR-UAPOS' and p.code = 'DAC-DACR';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DAJ' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'FISC' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'SEDE-SC' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'SEDE-STGO' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DGVM' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DGVM-DSUS' and p.code = 'DGVM';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DGVM-DSUS-JB' and p.code = 'DGVM-DSUS';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DGVM-DAV' and p.code = 'DGVM';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DGVM-UDIV' and p.code = 'DGVM';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DGVM-UDT' and p.code = 'DGVM';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DCC' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DCC-DBRAND' and p.code = 'DCC';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DCC-DCEM' and p.code = 'DCC';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DCC-DCI' and p.code = 'DCC';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DEXT' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DEXT-UGCA' and p.code = 'DEXT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'DEXT-UPA' and p.code = 'DEXT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'EDIT' and p.code = 'RECT';
update organizational_units c set parent_id = p.id from organizational_units p where c.code = 'FIE' and p.code = 'RECT';

-- alias de nomenclatura
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'CONTRALORIA','instrumento_2026',true from organizational_units where code = 'CONTR' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'CONTRALORIA INTERNA','carta_gantt',false from organizational_units where code = 'CONTR' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'Contraloria','indicadores',false from organizational_units where code = 'CONTR' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'SEC. GRAL','instrumento_2026',true from organizational_units where code = 'SG' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'SECRETARIA GENERAL','carta_gantt',false from organizational_units where code = 'SG' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'SECRETARIA GENERAL','indicadores',false from organizational_units where code = 'SG' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'TRANSPARENCIA','carta_gantt',false from organizational_units where code = 'SG-OGT' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'Vicerrectoria Academica','instrumento_2026',true from organizational_units where code = 'VRA' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'V. ACADEMICA','carta_gantt',false from organizational_units where code = 'VRA' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'VICERRECTORIA ACADEMICA','instrumento_2026',false from organizational_units where code = 'VRA' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'RRII','carta_gantt',false from organizational_units where code = 'VRA-DRI' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'VGEA','instrumento_2026',true from organizational_units where code = 'VGEA' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'VGEA','carta_gantt',false from organizational_units where code = 'VGEA' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'D° de Apoyo al Estudiante','carta_gantt',false from organizational_units where code = 'VGEA-DF-DAFE' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'D° de Personas','carta_gantt',false from organizational_units where code = 'VGEA-DPER' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'Dirección de personas','instrumento_2026',false from organizational_units where code = 'VGEA-DPER' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'D° de Desarrollo','carta_gantt',false from organizational_units where code = 'VGEA-DPER-DDP' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'VDE','instrumento_2026',true from organizational_units where code = 'VDE' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'V DESARROLLO ESTUDIANTIL','carta_gantt',false from organizational_units where code = 'VDE' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'VICERRECTORIA DESARROLLO ESTUDIANTIL','instrumento_2026',false from organizational_units where code = 'VDE' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'VRF','instrumento_2026',true from organizational_units where code = 'VRF' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'V. DE FORMACION','carta_gantt',false from organizational_units where code = 'VRF' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'Vicerrectoria de Formación','instrumento_2026',false from organizational_units where code = 'VRF' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'D.ASEG. CALIDAD','instrumento_2026',true from organizational_units where code = 'DAC' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'DIRECCION DE ASEGURAMIENTO DE LA CALIDAD','carta_gantt',false from organizational_units where code = 'DAC' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'DAJ','instrumento_2026',true from organizational_units where code = 'DAJ' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'DIRECCION ASUNTOS JURIDICOS','carta_gantt',false from organizational_units where code = 'DAJ' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'DIRECCION ASUNTOS JURIDICOS','instrumento_2026',false from organizational_units where code = 'DAJ' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'FISCALIA UNIVERSITARIA','instrumento_2026',true from organizational_units where code = 'FISC' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'FISCALIA UNIVERSITARIA','carta_gantt',false from organizational_units where code = 'FISC' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'DIRECCION SEDE SANTA CRUZ','instrumento_2026',true from organizational_units where code = 'SEDE-SC' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'DIRECCION SEDE SANTIAGO','instrumento_2026',true from organizational_units where code = 'SEDE-STGO' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'D°GRAL. VINC. CON EL MEDIO','instrumento_2026',true from organizational_units where code = 'DGVM' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'DIRECCION DE VINCULACION CON EL MEDIO','carta_gantt',false from organizational_units where code = 'DGVM' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'D°COM. COORPORATIVAS','instrumento_2026',true from organizational_units where code = 'DCC' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'DIRECCION DE COMUNICACIONES','carta_gantt',false from organizational_units where code = 'DCC' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'DIRECC. DE EXTENSIÓN','instrumento_2026',true from organizational_units where code = 'DEXT' on conflict (alias,source) do nothing;
insert into organizational_unit_aliases (unit_id,alias,source,is_primary) select id,'EDITORIAL','instrumento_2026',true from organizational_units where code = 'EDIT' on conflict (alias,source) do nothing;

select app.rebuild_unit_closure();
reset app.bootstrap;

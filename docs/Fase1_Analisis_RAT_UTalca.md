# Fase 1 — Análisis
## Plataforma institucional RAT — Registro de Actividades de Tratamiento de Datos Personales · Universidad de Talca

> Documento de análisis previo al diseño. **No contiene código.** Su objetivo es dejar por escrito qué dice la información fuente, qué entidades y relaciones se derivan de ella, qué roles y flujos existen, qué riesgos hay y qué decisiones deben tomarse antes de pasar a la Fase 2 (Arquitectura).

Fecha: 2026-09-08 · Prioridad transversal: **Seguridad → Integridad → Trazabilidad → Control de acceso → Usabilidad → Escalabilidad**

---

## 1. Resumen ejecutivo

- Se analizaron **3 archivos Excel** y se identificaron **2 PDF de contexto** (no procesados).
- El instrumento RAT actual (`Plantilla_RAT_ISO27001_UTALCA_2026.xlsx`) tiene **23 hojas** (Introducción + Indicadores + **21 hojas de unidad**), **17 columnas** por hoja de unidad y ~**785 filas** de contenido.
- **Hallazgo crítico:** las hojas de unidad **no son "una fila = una actividad de tratamiento"**. Hoy son un **híbrido de tres cosas** mezcladas en la misma tabla: (a) un **inventario de personas / responsables** (~761 nombres), (b) **notas de las reuniones de levantamiento** dispersas en cualquier columna, y (c) un **conjunto pequeño de actividades RAT reales** (~43, en 4 unidades) y aún fragmentarias.
- Esto condiciona toda la estrategia de importación: **no se puede mapear fila → actividad de forma automática**.
- Las **3 fuentes usan nombres distintos para las mismas unidades** y hay **inconsistencias numéricas** (19 vs 21 unidades; avance 19% vs 32%; período 2025 vs 2026). Se requiere una **taxonomía institucional canónica de unidades** como primer dato maestro.
- El brief confirma que deben existir **dos módulos separados**: **Gestión del levantamiento / proyecto** (alimentado por la Carta Gantt + rosters) y **RAT** (el registro propiamente tal). Este análisis lo respalda.
- Casi todos los campos hoy son **texto libre**. El sistema debe migrar a **vocabularios controlados** (base de licitud, categorías de datos, categorías de titulares, destinatarios, medidas de seguridad) conservando además un campo de nota libre.
- Aparecen **datos personales sensibles** en el material levantado (salud, atención de pacientes, condición sexual y religiosa, situación socioeconómica). La plataforma, además, **contendrá datos personales** (los 761 nombres de responsables) y por lo tanto **queda ella misma sujeta a la Ley 21.719**.

---

## 2. Fuentes analizadas

| # | Archivo | Contenido | Uso para el proyecto |
|---|---------|-----------|----------------------|
| 1 | `CartaGantt_RAT_UTalca.xlsx` *(adjunto)* | Hoja **"RAT – Carta Gantt"**: plan de 5 fases, línea de tiempo semanal 22-jun → 21-sep. Hoja **"Listado de Unidades"**: 21 filas, columna "VISITADAS" con 6 marcadas `OK`. | Insumo del **módulo de seguimiento del proyecto**. |
| 2 | `Plantilla_RAT_ISO27001_UTALCA_2026.xlsx` | Instrumento RAT vigente. 23 hojas. Hoja **Introducción** con la definición de los **15 campos legales**. Hoja **Indicadores** con métricas y detalle por unidad. 21 hojas de unidad con 17 columnas. | Fuente principal del **modelo de datos del RAT** y de los **datos iniciales**. |
| 3 | `Plantilla_RAT_ISO27001_Instrucciones (Recuperado automáticamente).xlsx` | Versión anterior / con instrucciones. 13 columnas. Incluye ejemplos "limpios" (`RAT-001/002/003`) y una hoja **"Instrucciones"** con glosario de campos. | Referencia para **glosario, ejemplos y vocabularios**. |
| 4 | `2026_06_11_Taller RAT_ Universidades - REUNA.pdf` | Material de taller RAT para universidades (REUNA). | Contexto normativo/metodológico. *(No procesado en esta fase.)* |
| 5 | `REUNA_Sujetos_Tratamiento_Datos.pdf` | Sujetos del tratamiento de datos. | Contexto. *(No procesado.)* |

---

## 3. Análisis del instrumento RAT actual

### 3.1 Estructura

- **Introducción** (informativa): qué es el RAT, mapa de datos vs. RAT, sujetos del tratamiento (responsable, encargado, titular, DPD, APDP), "las 5 preguntas" y la **tabla de los 15 campos** con definición y ejemplo.
- **Indicadores** (calculada): resumen general + detalle por unidad + barra de progreso. Los valores se calculan con fórmulas a partir de las hojas de unidad.
- **21 hojas de unidad**, todas con el **mismo encabezado de 17 columnas**. Número de filas muy dispar (de 4 en `EDITORIAL` a ~194 en `VGEA`).

### 3.2 Las 17 columnas y su mapeo a los 15 campos legales

| Col. instrumento | Campo legal (hoja Introducción) | Observación |
|---|---|---|
| 1 · ID de Registro | — (identificador) | Hoy es un correlativo por hoja (se reinicia en cada unidad) → **no es un ID global**. |
| 2 · Área Responsable | 4 · Áreas que intervienen (parcial) | En la práctica = vicerrectoría / facultad. |
| 3 · Direcciones/Unidades | 4 · Áreas que intervienen (parcial) | Segundo nivel jerárquico (dirección, depto., escuela, programa). |
| 4 · Responsable | — | Persona operativa que ejecuta / custodia. No es el "responsable del tratamiento" legal. |
| 5 · Delegado de Protección de Datos | 3 · DPD | **Vacío en todas las filas.** Debe ser configuración institucional única. |
| 6 · Nombre del Tratamiento | 1 · Actividad de tratamiento | A menudo contiene notas, no un nombre. |
| 7 · Descripción de la Actividad | 6 · Descripción | Poco poblado. |
| 8 · Finalidad del Tratamiento | 5 · Finalidad | Poco poblado. |
| 9 · Base Legal del Tratamiento | 11 · Base de licitud | Valores vistos: "Obligación legal", "Obligación contractual", "Obligación contractual/legal", "Contrato". → **vocabulario controlado**. |
| 10 · Origen o Fuente de los Datos | 9 · Origen o fuente | Casi vacío. |
| 11 · Categorías de Datos Personales | 8 · Categorías de datos | Texto libre enumerando campos ("Nombre, RUT, datos bancarios…"). Debe marcar **datos sensibles**. |
| 12 · Categorías de Titulares | 7 · Categoría de titulares | Texto libre ("Académicos", "Alumnos", "Funcionarios"…). → **vocabulario controlado**. |
| 13 · Destinatarios de los Datos | 10 · Categoría de destinatarios | Texto libre, mezcla internos / encargados / organismos. |
| 14 · Transferencias Internacionales | 12 · Transferencia internacional | Valores: "No", "No aplica", "Sí, Europa…", "Sí con la Universidad tratante". → **booleano + detalle + país + garantía**. |
| 15 · Plazo de Conservación | 13 · Plazo de conservación | Texto libre; frecuente "lo que dure la permanencia en la nube". |
| 16 · Medidas de Seguridad Aplicadas | 14 · Medidas de seguridad | Texto libre ("Clave + MFA", "nube institucional"…). → **catálogo de medidas + nota**. |
| 17 · Decisiones Automatizadas | 15 · Decisiones automatizadas | Se usa para tres cosas distintas: decisiones automatizadas, **uso de IA** y **sistemas propios**. Conviene **separar** en 2–3 campos. |

**Campo legal ausente como columna:** *2 · Responsable del tratamiento* (la Universidad: razón social, RUT, domicilio, representante legal). Es **constante** en todo el RAT → debe ser **configuración institucional**, no un campo por actividad.

### 3.3 Hallazgo crítico — el Excel es un híbrido

Ejemplos reales de las hojas de unidad:

- `Vicerrectoria Academica`: ~59 filas; la mayoría son solo `ID | VICERRECTORIA ACADEMICA | <sub-unidad> | <nombre de persona>` **sin ningún dato de tratamiento**. Es un **listado de personas**.
- `Fac. Medicina` fila 3: la celda de "Nombre del Tratamiento" dice *"Pacientes se ven atraves de Utalca saluda"* → es una **nota de reunión**, no un nombre de actividad.
- `Fac. Medicina` fila 5: *"Condicion sexual, religiosa"* suelta en una celda → dato sensible mencionado al pasar.
- `VDE` fila 4: un párrafo largo sobre la plataforma "FAES UTALCA" metido en la columna de titulares.

**Conclusión:** el instrumento actual está en fase de **mapa de datos / levantamiento**, no de RAT redactado. Las ~43 "actividades" son germen de actividades, no actividades cerradas.

**Implicancia de diseño:**
1. Los ~761 nombres se cargan en el **módulo de seguimiento** como *contactos / responsables levantados por unidad*, **no** como actividades de tratamiento.
2. Las ~43 actividades se cargan en un **área de staging** y se **completan/redactan manualmente** (con asistente) antes de existir como registros RAT válidos.
3. La importación **nunca** crea actividades RAT "publicadas" directamente desde filas del Excel.

### 3.4 Calidad de datos

| Problema | Evidencia | Acción propuesta |
|---|---|---|
| ID no global | El correlativo se reinicia por hoja | ID global `RAT-000001` + `unit_local_no` opcional. |
| Texto libre en campos que deberían ser catálogo | Base legal, titulares, destinatarios, medidas | Vocabularios controlados + campo "detalle/nota". |
| Jerarquía de unidad inconsistente | "Área Responsable" a veces es la vicerrectoría, a veces se repite el nombre de la unidad; "Direcciones/Unidades" mezcla direcciones, departamentos, escuelas y programas | Árbol de unidades normalizado (ver §5). |
| 3 campos mezclados en "Decisiones Automatizadas" | Celdas "IA: …", "Sistemas propios: …" | Separar: `decisiones_automatizadas`, `uso_de_ia`, `sistemas_propios`. |
| Inconsistencias numéricas | 19 unidades (Gantt) vs 21 (Indicadores); avance 19% vs 32%; período "2025" en texto y 2026 en fechas | Definir cifras oficiales; todas calculadas desde BD, nunca hardcodeadas. |
| Filas vacías / basura | Filas solo con número de ID | El importador las descarta con reporte. |

### 3.5 Datos personales sensibles detectados en el material

Salud y atención de pacientes (Utalca Salud, Salud Estudiantil, campos clínicos, fichas — **Ley 20.584**); **condición sexual y religiosa**; **situación socioeconómica** (acreditación FAES); datos de contacto de emergencia y antecedentes médicos; posibles datos de menores (apoderados). Referencias normativas en el material: **Ley 19.628, Ley 21.719, Ley 20.584**.

> La plataforma debe permitir **marcar** cada actividad que trate datos sensibles y exigir **base de licitud reforzada**, y su propio almacenamiento de estos metadatos debe protegerse en consecuencia.

### 3.6 Indicadores actuales (hoja Indicadores)

| Indicador | Valor |
|---|---|
| Unidades / direcciones totales | 21 |
| Unidades con levantamiento preliminar (responsables identificados) | 21 |
| Unidades con actividades RAT ya registradas | 4 |
| Unidades pendientes de registrar actividades | 17 |
| Total de responsables / unidades identificados | 761 |
| Total de actividades de tratamiento registradas | 43 |
| % de avance RAT (unidades con actividades / total) | 19,05 % |

Estados usados hoy (solo 2): **"Actividades RAT registradas"** / **"Solo levantamiento preliminar"**.
Detalle por unidad con más carga: VGEA (194 responsables, 0 actividades), VRF (143, 0), Vic. Académica (59, 15), VDE (55, 11), F.ING (45, 0), F.CS (42, 0), D°Com. Corporativas (33, 0)…

---

## 4. Análisis de la Carta Gantt → módulo de seguimiento

Estructura de la hoja "RAT – Carta Gantt":

- **Período:** 22-jun → 21-sep (líneas de tiempo semanales; 2 semanas de receso).
- **Fase 1 — Contacto y coordinación:** envío de correos y agendamiento, en **3 bloques de unidades** (1-7, 8-14, 15-19).
- **Fase 2 — Levantamiento (reuniones):** una reunión por unidad, ~1 por semana (unidades #7 a #19).
- **Fase 3 — Seguimiento de unidades pendientes:** recordatorios y cierre de reuniones.
- **Fase 4 — Consolidación y redacción:** consolidar información, redactar RAT, verificar cumplimiento Ley 21.719.
- **Fase 5 — Revisión y entrega:** revisión interna (OSD / Unidad de Seguridad Digital), correcciones, entrega formal.
- Nota de avance: *"6 / 19 unidades completadas (32%)"*.
- Leyenda con 5 categorías de color (receso, contacto, reunión, seguimiento, consolidación, revisión).

**Datos por unidad para el módulo de seguimiento** (§25 del brief): estado, fecha de contacto, fecha de reunión, responsable(s), estado del levantamiento, pendientes, última actualización, observaciones.

> Este módulo es **conceptualmente distinto** del formulario RAT y no debe mezclarse con él:
> `Gestión del proyecto → Unidades / seguimiento → Levantamiento RAT → Actividades de tratamiento`

---

## 5. Reconciliación de unidades (dato maestro)

Las tres fuentes nombran distinto a las mismas unidades. Ejemplos:

| Concepto | Carta Gantt ("Listado") | Instrumento (hoja) | Indicadores |
|---|---|---|---|
| Vicerrectoría Académica | `V. ACADEMICA` | `Vicerrectoria Academica` | `Vicerrectoria Academica` |
| Relaciones Internacionales | `RRII` | *(dentro de Vic. Académica → Dir. de RR.II.)* | — |
| Vic. de Formación | `V. DE FORMACION` | `VRF` | `VRF` |
| Vic. Desarrollo Estudiantil | `V DESARROLLO ESTUDIANTIL` | `VDE` | `VDE` |
| Aseguramiento de la Calidad | `DIRECCION DE ASEGURAMIENTO DE LA CALIDAD` | `D.ASEG. CALIDAD` | `D.ASEG. CALIDAD` |
| Vinculación con el Medio | `DIRECCION DE VINCULACION CON EL MEDIO` | `D°GRAL. VINC. CON EL MEDIO` | `D°GRAL. VINC. CON EL MEDIO` |
| Comunicaciones | `DIRECCION DE COMUNICACIONES` | `D°COM. COORPORATIVAS` | `D°COM. COORPORATIVAS` |
| Facultades (FEN, FCJS, F.ING, F.CS) | *no listadas aparte* | hojas propias | filas propias |
| Sedes (Santa Cruz, Santiago) | *no listadas* | hojas propias | filas propias |
| `D° de Personas`, `D° de Desarrollo`, `D° de Apoyo al Estudiante`, `TRANSPARENCIA` | listadas | *no tienen hoja propia* | *no tienen fila* |

**Requerimiento:** definir con la orgánica oficial de UTalca un **árbol de unidades canónico** con:

- `id`, `nombre_oficial`, `nombre_corto`, `sigla`, `tipo` (`rectoria | vicerrectoria | facultad | direccion | departamento | escuela | unidad | programa | sede | otro`), `parent_id` (jerárquico), `estado` (`activa | inactiva`), `campus` (Talca, Linares, Colchagua/Santa Cruz, Santiago), `alias[]` (para el mapeo de importación).

Las hojas del Excel = nodos de nivel 1–2; las "Direcciones/Unidades" = hijos.

---

## 6. Entidades identificadas

### 6.1 Identidad y acceso
- **User** — persona con acceso. Campos: identidad, correo institucional, estado, MFA, último acceso.
- **Role** — Superadministrador, Administrador RAT / DPD, Responsable de Unidad, Colaborador, Auditor / Consulta.
- **Permission** — permisos atómicos (`activity.create`, `activity.approve`, `unit.manage`, `audit.read`, …).
- **RolePermission**, **UserRole**.
- **OrganizationalUnit** — árbol de unidades (§5).
- **UserUnitAssignment** — usuario × unidad × rol-en-la-unidad (un usuario puede pertenecer a varias unidades).

### 6.2 Núcleo RAT
- **ProcessingActivity** — la actividad de tratamiento. Estado, unidad responsable, completitud, versión actual.
- **ProcessingActivityVersion** — snapshot inmutable por cada cambio relevante (para historial y comparación).
- **ActivityInterveningUnit** — unidades que intervienen (N:M con OrganizationalUnit).
- **ActivityDataCategory** — N:M con **DataCategory** (catálogo), con flag `es_sensible`.
- **ActivitySubjectCategory** — N:M con **DataSubjectCategory** (catálogo; marca NNA / grupos protegidos).
- **ActivityRecipient** — N:M con **RecipientType** / encargados, con detalle.
- **ActivityTransfer** — 0..N transferencias internacionales: país, tipo de garantía, detalle.
- **ActivitySecurityMeasure** — N:M con **SecurityMeasure** (catálogo) + nota.
- **LegalBasis** — catálogo de bases de licitud (Ley 21.719); la actividad referencia 1..N con fundamento.
- **RetentionRule** — plazo/criterio de conservación (valor + unidad + criterio legal/justificado).
- **AutomatedDecision** — decisiones automatizadas / perfilamiento / uso de IA / sistemas propios asociados.

### 6.3 Configuración institucional
- **Controller** (Responsable del tratamiento) — datos de la Universidad (constante, con posible override por actividad).
- **DataProtectionOfficer** — DPD institucional (nombre, contacto, domicilio).
- **Catálogos** — LegalBasis, DataCategory, DataSubjectCategory, RecipientType, SecurityMeasure, TransferGuaranteeType, RetentionCriterion, Campus.

### 6.4 Ciclo de vida y control
- **ActivityStatusTransition** — cada cambio de estado (quién, cuándo, de → a, comentario).
- **ActivityReview** — revisión del DPD: observaciones, solicitud de corrección, aprobación/cierre.
- **ReviewObservation** — observación puntual sobre un campo.
- **AuditLog** — registro **inmutable** de toda acción sensible (§10 del brief).
- **Notification** — notificaciones in-app (y luego correo).
- **Attachment** — adjuntos (evidencia), con validación de tipo/tamaño.

### 6.5 Importación
- **ImportBatch** — carga de Excel: quién, cuándo, archivo, hoja(s), resultado.
- **ImportRowStaging** — fila cruda + mapeo + validación + estado (`válida | advertencia | error | descartada | importada`).
- **ColumnMapping** — mapeo columna Excel → campo del sistema, reutilizable por plantilla.

### 6.6 Módulo de seguimiento del proyecto (separado del RAT)
- **ProjectPhase** / **ProjectTask** — fases y tareas de la Carta Gantt.
- **UnitEngagement** — seguimiento por unidad: estado, fecha de contacto, fecha de reunión, responsable(s) de la unidad, estado del levantamiento, pendientes, observaciones, última actualización.
- **EngagementContact** — personas de contacto levantadas por unidad (aquí caen los ~761 nombres).

---

## 7. Modelo conceptual (relaciones)

```text
                         ┌───────────────┐
                         │  Permission   │
                         └──────┬────────┘
                                │ N:M
                         ┌──────┴────────┐        ┌──────────────────────┐
             ┌───────────│     Role      │        │ OrganizationalUnit   │◄─┐ parent_id
             │ N:M       └──────┬────────┘        │  (árbol jerárquico)  │──┘
       ┌─────┴─────┐            │ N:M             └──────────┬───────────┘
       │   User    │────────────┘                           │
       └─────┬─────┘   UserUnitAssignment (User × Unit × RoleEnUnidad)
             │───────────────────────────────────────────────┤
             │                                               │
             │ crea / edita                                  │ responsable de
             ▼                                               ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │                    ProcessingActivity  (RAT)                     │
      │  estado · completitud · unidad_responsable · versión_actual      │
      └───┬───────┬───────┬────────┬────────┬────────┬────────┬──────────┘
          │       │       │        │        │        │        │
   InterveningUnits │  DataCategory │  RecipientType │  SecurityMeasure
              SubjectCategory   LegalBasis   Transfer(país,garantía)
          │       │       │        │        │        │        │
          ▼       ▼       ▼        ▼        ▼        ▼        ▼
      ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐
      │ ActivityVersion │  │ StatusTransition │  │ ActivityReview    │
      │  (inmutable)    │  │  (de → a)        │  │  observaciones    │
      └─────────────────┘  └──────────────────┘  └───────────────────┘
                                   │
                                   ▼
                             ┌───────────┐     ┌──────────────┐
                             │ AuditLog  │     │ Notification │
                             │(inmutable)│     └──────────────┘
                             └───────────┘

  ── Módulo de seguimiento (separado) ─────────────────────────────
     ProjectPhase → ProjectTask
     OrganizationalUnit ─1:1─ UnitEngagement ─1:N─ EngagementContact  (~761)

  ── Importación ─────────────────────────────────────────────────
     ImportBatch ─1:N─ ImportRowStaging ── (validación) ──► ProcessingActivity / EngagementContact
```

---

## 8. Roles y modelo de acceso

RBAC **con dimensión de unidad** (RBAC + *scoping*). Cada permiso se evalúa junto con el **alcance**: `global` o `unidad(es) asignada(s)`.

| Rol | Alcance | Puede |
|---|---|---|
| **Superadministrador** | Global | Todo: usuarios, unidades, roles, permisos, configuración, ver/editar cualquier RAT, auditoría. |
| **Administrador RAT / DPD** | Global (institucional) | Ver todas las unidades y actividades; crear/editar; revisar; solicitar correcciones; aprobar/cerrar; indicadores institucionales; exportar; auditoría (lectura). No administra usuarios/roles. |
| **Responsable de Unidad** | Su(s) unidad(es) | Ver/crear/editar actividades de su unidad; completar pendientes; enviar a revisión. **No** ve ni edita otras unidades. |
| **Colaborador** | Su(s) unidad(es), restringido | Editar campos de actividades asignadas; no envía a revisión ni cambia estado global. |
| **Auditor / Consulta** | Definido | Solo lectura de lo autorizado + reportes. Sin escritura. |

**Regla no negociable (§26 del brief):** toda autorización sobre un registro se valida **en el backend** contra la unidad del registro. Conocer una URL o un ID (`/rat/123`) no da acceso.

---

## 9. Flujos identificados

1. **Autenticación:** login → política de contraseñas / rate-limiting / bloqueo por fuerza bruta → **MFA (TOTP)** → sesión segura con expiración → registro de evento (éxito/fallo) → logout. Recuperación de contraseña segura. Arquitectura preparada para **SSO institucional (Entra ID)**.
2. **Ciclo de vida de la actividad (máquina de estados configurable):**
   `BORRADOR → EN_COMPLETADO → EN_REVISIÓN → (APROBADO → CERRADO) | (OBSERVADO → CORREGIDO → EN_REVISIÓN)`
   Cada transición: registrada, con actor, timestamp y comentario.
3. **Revisión / aprobación (DPD):** Responsable envía → DPD revisa → aprueba (cierra) u observa (devuelve con observaciones por campo) → Responsable corrige → vuelve a revisión.
4. **Completitud:** cálculo automático del % y lista de campos faltantes por actividad y por unidad.
5. **Importación:** subir Excel → detectar hojas/columnas → mapear → validar → **vista previa** (`válidos / advertencias / errores`) → confirmar → crear en staging → curación manual → publicar. Registro de quién importó. Nunca sobrescribe sin confirmación.
6. **Exportación:** RAT completo / por unidad / filtrado / indicadores → Excel, CSV, PDF.
7. **Auditoría:** toda operación sensible → AuditLog inmutable (usuario, fecha/hora, IP, acción, registro, unidad, estado anterior/nuevo, campos modificados, resultado).
8. **Dashboard por nivel de acceso:** institucional (Superadmin/DPD) · de unidad (Responsable) · limitado (Colaborador) · consulta (Auditor).
9. **Seguimiento del proyecto:** contacto → agendamiento → reunión de levantamiento → seguimiento de pendientes → consolidación → revisión OSD → entrega.

---

## 10. Riesgos y mitigaciones

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | La fuente **no es fila→actividad**; importación automática cargaría basura | Alto | Importar rosters al módulo de seguimiento como contactos; actividades a **staging** + curación manual; nunca publicar directo. |
| R2 | **Taxonomía de unidades divergente** entre las 3 fuentes | Alto | Definir árbol canónico con la orgánica oficial **antes** de cargar datos; tabla de `alias` para el mapeo. |
| R3 | La plataforma **contiene datos personales** (761 nombres, responsables) → sujeta a Ley 21.719 | Alto | Control de acceso estricto, auditoría, minimización, política de retención y su propia entrada en el RAT. |
| R4 | **Datos sensibles** descritos en texto libre (salud, condición sexual/religiosa) | Alto | Marca de sensibilidad, base reforzada obligatoria, cifrado en reposo de campos marcados, acceso restringido. |
| R5 | **Sobre-alcance**: 20 funcionalidades = varios trimestres; riesgo de no entregar | Alto | Definir **MVP** y fases; ver §11. |
| R6 | Todo en **texto libre** → analítica pobre, indicadores frágiles | Medio | Vocabularios controlados + nota libre; migración asistida. |
| R7 | **DPD vacío** en todo el instrumento | Medio | Configuración institucional única de DPD y Responsable del tratamiento. |
| R8 | **Auth local ahora vs SSO después** = retrabajo | Medio | Capa de identidad abstracta (proveedor conmutable); decidir en Fase 2 (ver Anexo D1). |
| R9 | **Residencia de datos** si se aloja en nube fuera de Chile → transferencia internacional del propio sistema | Medio | Decidir hosting (Anexo D2); preferir infraestructura institucional / región Chile. |
| R10 | Inconsistencias numéricas y de fechas en las fuentes | Bajo | Todas las cifras calculadas desde BD; no hardcodear; definir cifras oficiales. |
| R11 | Correlativo de ID por hoja | Bajo | ID global + numeración local opcional. |
| R12 | Adjuntos / import de Excel = vector de archivos maliciosos | Medio | Validación MIME real, límites de tamaño, antivirus, almacenamiento fuera del webroot. |

---

## 11. Recomendaciones

1. **Dos módulos, un sistema.** "Gestión del Levantamiento / Proyecto" y "RAT" comparten identidad, unidades y auditoría, pero son módulos separados con navegación propia.
2. **Dato maestro primero.** Construir y validar el árbol de unidades canónico antes de cualquier carga.
3. **Vocabularios controlados** sembrados desde la Ley 21.719 y desde los valores observados; siempre con campo "detalle / nota" para no perder matices.
4. **Importación asistida y en staging.** Rosters → contactos de seguimiento. Actividades → borradores a curar. Confirmación humana obligatoria. Trazabilidad de la importación.
5. **MVP sugerido (Fase 4a):** autenticación + MFA; RBAC con *scoping* por unidad; gestión de unidades y usuarios; CRUD de actividades con formulario tipo *wizard* + completitud; máquina de estados + revisión/aprobación del DPD; auditoría + versionado; dashboard por rol; exportación Excel/CSV.
   **Diferible (Fase 4b+):** notificaciones por correo, SSO institucional, adjuntos, comparación visual de versiones avanzada, PDF con formato institucional, módulo de seguimiento completo con Gantt interactivo.
6. **Seguridad desde el diseño:** OWASP ASVS como checklist, control de acceso en backend, secretos fuera del código, cifrado en tránsito y en reposo de campos sensibles, sesiones seguras, backups y plan de recuperación.
7. **No presentar el sistema como "certificado" de la Ley 21.719.** Es una herramienta para *facilitar y evidenciar* el cumplimiento (responsabilidad proactiva).

---

## Anexo — Decisiones arquitectónicas abiertas (con recomendación)

> Estas decisiones condicionan la Fase 2. Para cada una se propone una alternativa y se indican ventajas y riesgos.

### D1 · Autenticación: ¿local (contraseña + TOTP) o SSO institucional (Entra ID) desde el inicio?
- **Recomendación:** **capa de identidad abstracta** + **local con MFA TOTP** para el MVP, con adaptador SSO/OIDC listo para conectar.
- **Ventaja:** avanza sin depender de TI institucional; migración a Entra ID sin rediseño (solo se agrega el proveedor).
- **Riesgo:** doble gestión de cuentas hasta que se active SSO; se mitiga con aprovisionamiento por correo institucional y desactivación de auto-registro.

### D2 · Hosting / despliegue: ¿on-premise UTalca, nube institucional (Azure UTalca), u otra?
- **Recomendación:** **infraestructura institucional UTalca** (on-prem o tenant Azure de la Universidad, región que minimice transferencia internacional). Contenedores Docker para portabilidad.
- **Ventaja:** coherencia con el discurso de residencia y control de datos; evita que el propio sistema sea una transferencia internacional.
- **Riesgo:** dependencia de capacidades de operación de TI; se mitiga con despliegue contenedorizado y documentación de operación.

### D3 · Alcance de la primera entrega: ¿MVP acotado o build completo por fases largas?
- **Recomendación:** **MVP** (§11.5) y luego incrementos.
- **Ventaja:** valor usable pronto; permite que el DPD empiece a revisar actividades reales; reduce riesgo de no entregar.
- **Riesgo:** expectativa de "todo de una vez"; se mitiga con un roadmap explícito por fases.

### D4 · Importación de datos iniciales: ¿confirmamos que los ~761 nombres van a "seguimiento" (contactos) y NO a "actividades", y que las ~43 actividades se crean/curan manualmente?
- **Recomendación:** **sí**. Rosters → `EngagementContact`. Actividades → `ImportRowStaging` → curación → publicación.
- **Ventaja:** el RAT nace limpio y trazable; no se contamina con notas de reunión.
- **Riesgo:** trabajo manual de curación de ~43 registros; es acotado y necesario de todos modos.

### D5 · Stack tecnológico
- **Propuesta (a confirmar en Fase 2):** React + TypeScript · NestJS + Prisma · PostgreSQL · Redis (sesiones/rate-limit) · Docker. TOTP para MFA. Justificación completa en Fase 2.

### D6 · Modelo de estados
- **Propuesta:** `BORRADOR · EN_COMPLETADO · EN_REVISIÓN · OBSERVADO · CORREGIDO · APROBADO · CERRADO`, con transiciones configurables. A validar con el flujo real de la Unidad de Seguridad Digital.

---

## Próximos pasos

1. **Resolver D1–D4** (y preferencias sobre D5–D6).
2. Conseguir la **orgánica oficial de unidades** de UTalca (para el árbol canónico).
3. Con eso, **Fase 2 — Arquitectura**: diagrama de componentes, modelo de datos y esquema de BD, endpoints, modelo RBAC, flujos de autenticación / MFA / aprobación, estrategia de auditoría.
4. **Fase 3 — UX/UI**: login, MFA, dashboards, formulario RAT (wizard), detalle, historial, auditoría, administración.
5. **Fase 4 — Implementación** del MVP.

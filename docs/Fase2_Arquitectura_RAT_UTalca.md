# Fase 2 — Arquitectura
## Plataforma institucional RAT · Universidad de Talca

> Continúa la [Fase 1 — Análisis](Fase1_Analisis_RAT_UTalca.md). Define arquitectura de componentes, stack (100 % capa gratuita), modelo de datos y esquema de BD, modelo RBAC, flujos de autenticación / MFA / aprobación, y estrategia de auditoría y versionado.
> **No contiene código de aplicación**; incluye DDL conceptual y políticas como especificación.

Fecha: 2026-09-09 · Prioridad transversal: **Seguridad → Integridad → Trazabilidad → Control de acceso → Usabilidad → Escalabilidad**

---

## 1. Decisiones (actualizadas)

| # | Decisión | Estado |
|---|---|---|
| D1 | **Autenticación:** local (correo institucional + contraseña) con **MFA TOTP obligatorio**, detrás de una **capa de identidad abstracta**; adaptador OIDC/**Entra ID** conectable sin rediseño. | ✅ Confirmada |
| D2 | **Hosting:** *(revisada — ver D7)* Objetivo de largo plazo sigue siendo **infraestructura institucional UTalca**; para el piloto/MVP se usa capa gratuita con **portabilidad garantizada**. | 🔄 Revisada |
| D3 | **Alcance:** **MVP acotado** primero, luego incrementos. | ✅ Confirmada |
| D4 | **Importación:** rosters (~761 personas) → módulo de seguimiento como *contactos*; actividades (~43) → *staging* + curación manual; nunca publica RAT directo. | ✅ Confirmada |
| D5 | **Stack de aplicación:** React + TypeScript (frontend). Lógica de negocio sensible en funciones de servidor. | ✅ Confirmada |
| D6 | **Estados:** máquina de estados **configurable** en BD (tabla `workflow_transitions`). | ✅ Confirmada |
| **D7** | **Backend/BD sobre capa gratuita:** **Supabase** (PostgreSQL + Auth + RLS + Storage + Edge Functions) como sistema de registro; **Cloudflare Pages** para el frontend; **Cloudflare R2** para adjuntos si superan el límite de Supabase Storage. | ✅ **Nueva — confirmada por el usuario** |

### D7 — Justificación y contraste

| Criterio | **Supabase (elegido)** | Cloudflare D1 + Workers | Por qué |
|---|---|---|---|
| Motor de BD | **PostgreSQL 15+** | SQLite (D1) | El modelo relacional normalizado de la Fase 1 sobrevive intacto en Postgres; SQLite obliga a simplificar (sin `jsonb` real, tipos ricos, *constraints* avanzados). |
| Control de acceso por unidad | **RLS nativo en la BD** | Solo en código del Worker | El brief exige control de acceso **en backend, no solo frontend**. RLS lo impone en la capa más profunda (*defense in depth*): aunque falle la app, la BD no entrega filas de otra unidad. |
| MFA | **TOTP incluido en capa gratuita** | Cloudflare Access (SSO/MFA gratis ≤ 50 usuarios) | Supabase cubre MFA sin límite de usuarios; Access es atractivo pero topa a 50 usuarios gratis y el sistema crecerá más allá. |
| SSO Entra ID | OAuth/OIDC de Azure en capa gratuita; SAML enterprise en plan pago | Access integra Entra gratis ≤ 50 | Para el MVP basta Azure como proveedor OIDC. |
| Auditoría / versionado | Triggers + funciones `SECURITY DEFINER` + `pg_cron` | Requiere construir todo en el Worker | Postgres da inmutabilidad y automatización a nivel de motor. |
| Migraciones / portabilidad | Supabase CLI → `*.sql` versionados en git | Migraciones D1 menos maduras | Todo el esquema (tablas, RLS, funciones, triggers, `pg_cron`) es **Postgres estándar**, portable a cualquier Postgres o a Supabase self-hosted en UTalca. |

**Cloudflare aporta lo que hace mejor:** hosting estático global del frontend (Pages) y almacenamiento de objetos sin costo de egress (R2). **Supabase aporta el núcleo de datos, identidad y autorización.**

### D7 — Límites de la capa gratuita y mitigaciones

| Recurso | Límite gratuito | ¿Suficiente para el MVP? | Mitigación |
|---|---|---|---|
| Supabase — PostgreSQL | 500 MB | **Sí.** Un registro RAT completo con colecciones hijas ≈ 5–20 KB; 10.000 actividades ≈ ~100 MB. | Monitoreo de tamaño; archivar versiones antiguas a `jsonb` comprimido si crece. |
| Supabase — Auth | 50.000 usuarios activos/mes | **Sí** (usuarios reales del sistema: decenas → cientos). | — |
| Supabase — Storage | 1 GB / 5 GB egress mes | **Ajustado** si hay muchos adjuntos. | Límite por adjunto (p. ej. 10 MB), tipos permitidos; mover adjuntos a **Cloudflare R2 (10 GB)** vía Edge Function. |
| Supabase — Edge Functions | 500.000 invocaciones/mes | **Sí.** | — |
| Supabase — egress BD | 5 GB/mes | **Sí.** | Paginación obligatoria, `select` de columnas explícitas. |
| Supabase — **pausa por inactividad** | Se pausa tras **7 días sin actividad** | Riesgo operativo en piloto. | `pg_cron` de *keep-alive* + **GitHub Action** cron diario que hace un `select 1`. |
| Supabase — proyectos activos | 2 | **Sí** (1 `dev`, 1 `prod`). | Branching de Supabase para PRs si se requiere. |
| Cloudflare Pages | requests ilimitados; 500 builds/mes | **Sí.** | — |
| Cloudflare R2 | 10 GB; 1M ops A + 10M ops B / mes | **Sí.** | — |

### D7 — Residencia de datos (riesgo normativo)

Supabase capa gratuita se aloja en **AWS**; la región más cercana es **`sa-east-1` (São Paulo, Brasil)** — **los datos salen de Chile**. Bajo la **Ley 21.719** esto es una **transferencia internacional** que debe:

- documentarse en el propio RAT (la plataforma es una actividad de tratamiento);
- ampararse en **garantías adecuadas** (cláusulas contractuales / DPA de Supabase);
- limitarse, en el piloto, a **datos no productivos o de sensibilidad acotada** hasta que se apruebe el uso productivo.

**Ruta de salida (sin retrabajo de esquema):** migrar a **Supabase self-hosted** (Docker) en infraestructura UTalca, o a **PostgreSQL gestionado por la Universidad** + una API propia (NestJS/Hono) reutilizando las mismas migraciones y políticas RLS. Ver §12.

---

## 2. Principios rectores y cómo se materializan

| Principio | Mecanismo concreto en esta arquitectura |
|---|---|
| **Escalabilidad** | Modelo relacional normalizado; índices y RLS por unidad; indicadores en vistas materializadas refrescadas por `pg_cron` (no cálculos O(n) en cada carga); paginación obligatoria; frontend estático en CDN. |
| **Reutilización** | Monorepo con `packages/shared`: tipos TypeScript **generados desde la BD** (`supabase gen types`), esquemas de validación **Zod** usados por el cliente y por las Edge Functions, librería de componentes UI y *design tokens* (Fase 3). |
| **Mejora continua** | Todo el esquema en **migraciones SQL versionadas** en git; catálogos y unidades con `status` + `superseded_by` + `needs_review` (nunca se borran, se deprecan); `CHANGELOG` de datos maestros (`organizational_units.v0.1 → vN`); tabla `feature_flags`; workflow configurable en BD. |
| **Segregación por unidad** | `user_unit_assignments` + RLS en cada tabla; el árbol de `organizational_units` permite herencia de alcance (un rol en una vicerrectoría puede ver sus descendientes, si así se configura). |
| **Defense in depth** | 4 capas de autorización (§7): UI → RLS/PostgREST → Edge Functions → constraints/triggers. |
| **Facultades diferidas sin cambio de modelo** | Son solo nodos descendientes del nodo `FIE`; se insertan por migración/seed posterior. Ninguna tabla ni política cambia. |

---

## 3. Vista de arquitectura (componentes)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  NAVEGADOR (usuario institucional)                                         │
│  React + TypeScript + Vite  ·  @supabase/supabase-js  ·  React Router      │
│  Estado: TanStack Query  ·  Formularios: React Hook Form + Zod             │
│  — Solo UI. NUNCA es la frontera de seguridad —                            │
└───────────────┬───────────────────────────────────┬──────────────────────┘
                │ HTTPS (JWT en Authorization)       │ HTTPS
                ▼                                   ▼
┌───────────────────────────────┐   ┌──────────────────────────────────────┐
│  Cloudflare Pages (CDN)       │   │  SUPABASE (proyecto prod, sa-east-1)  │
│  - Frontend estático          │   │                                      │
│  - Cache, TLS, headers CSP    │   │  ┌────────────────────────────────┐  │
└───────────────────────────────┘   │  │ Auth (GoTrue)                  │  │
                                    │  │  email+pass · TOTP MFA (AAL2)  │  │
┌───────────────────────────────┐   │  │  OIDC Azure (adaptador SSO)    │  │
│  Cloudflare R2 (adjuntos)     │◄──┤  └────────────────────────────────┘  │
│  10 GB · sin egress fee       │   │  ┌────────────────────────────────┐  │
└───────────────────────────────┘   │  │ PostgREST (API REST auto)      │  │
                                    │  │  + RLS en TODAS las tablas     │  │
┌───────────────────────────────┐   │  └────────────────────────────────┘  │
│  GitHub                       │   │  ┌────────────────────────────────┐  │
│  - Repo monorepo              │   │  │ Edge Functions (Deno)          │  │
│  - Migraciones SQL            │──▶│  │  import-parse · import-commit  │  │
│  - CI: deploy Pages + db push │   │  │  export-xlsx · export-pdf      │  │
│  - Action cron: keep-alive    │   │  │  activity-transition · notify  │  │
└───────────────────────────────┘   │  └────────────────────────────────┘  │
                                    │  ┌────────────────────────────────┐  │
                                    │  │ PostgreSQL 15                  │  │
                                    │  │  tablas · funciones SECURITY   │  │
                                    │  │  DEFINER · triggers (audit,    │  │
                                    │  │  versión, guardas de estado)  │  │
                                    │  │  vistas materializadas (KPIs) │  │
                                    │  │  pg_cron (keep-alive, KPIs,   │  │
                                    │  │  digest de notificaciones)    │  │
                                    │  │  Storage (bucket adjuntos)     │  │
                                    │  └────────────────────────────────┘  │
                                    └──────────────────────────────────────┘
```

### Capas lógicas

```text
Presentación (React)  →  API (PostgREST + Edge Functions)  →  Servicios (funciones SQL / Deno)  →  Datos (PostgreSQL + RLS)
```

- **Lecturas simples** (listas, detalle, dashboard): cliente → PostgREST, filtradas por RLS.
- **Operaciones sensibles o multi-paso** (transición de estado, import, export, alta de usuario, cambios de config): cliente → **Edge Function** (valida, ejecuta con *service role* de forma acotada, escribe auditoría).
- **Invariantes** (máquina de estados, auditoría, versión): **triggers** en la BD — se cumplen aunque la operación entre por cualquier vía.

---

## 4. Modelo de datos

Ocho módulos. Todas las tablas llevan `id uuid pk default gen_random_uuid()`, `created_at timestamptz`, `updated_at timestamptz`, y (donde aplica) `created_by uuid`, `updated_by uuid`.

### 4.1 Identidad y acceso

| Tabla | Columnas clave | Notas |
|---|---|---|
| `profiles` | `user_id` (= `auth.users.id`), `full_name`, `email`, `status` (`active/suspended/invited`), `mfa_enrolled bool`, `last_seen_at` | Espejo de `auth.users`. 1:1. |
| `roles` | `code` (`superadmin/dpd_admin/unit_manager/collaborator/auditor`), `name`, `description`, `is_system bool` | Extensible. |
| `permissions` | `code` (p. ej. `activity.review`), `description`, `category` | Catálogo atómico (§7). |
| `role_permissions` | `role_id`, `permission_id` | N:M. Editable por `role.manage`. |
| `user_roles` | `user_id`, `role_id`, `scope` (`global` \| `unit`), `granted_by`, `granted_at`, `revoked_at` | Un rol global aplica a todo; un rol `unit` se combina con `user_unit_assignments`. |
| `user_unit_assignments` | `user_id`, `unit_id`, `unit_role` (`responsable` \| `colaborador` \| `consulta`), `includes_descendants bool`, `valid_from`, `valid_to` | Un usuario puede estar en varias unidades. `includes_descendants` permite alcance sobre el subárbol. |

### 4.2 Unidades organizacionales

| Tabla | Columnas clave | Notas |
|---|---|---|
| `organizational_units` | `code` (slug estable, único), `name_official`, `name_short`, `acronym`, `type` (enum), `parent_id`, `campus`, `status` (`active/inactive/merged`), `merged_into_id`, `needs_review bool`, `sort_order`, `external_ref` (`RU N°1053-2025`), `notes` | Árbol autoreferenciado. Semilla = `organizational_units.v0.1.json` (106 nodos; `FIE` = rama diferida de facultades). |
| `organizational_unit_aliases` | `unit_id`, `alias`, `source` (`carta_gantt/instrumento_2026/indicadores/manual`), `is_primary bool` | Resuelve el mapeo de importación y las 3 nomenclaturas distintas detectadas en Fase 1. |
| `organizational_unit_closure` *(opcional)* | `ancestor_id`, `descendant_id`, `depth` | Tabla de cierre para consultas de subárbol O(1); mantenida por trigger. Alternativa: `WITH RECURSIVE`. |

### 4.3 Núcleo RAT

| Tabla | Columnas clave | Notas |
|---|---|---|
| `processing_activities` | `ref_code` (`RAT-000001`, global), `unit_local_no int`, `title`, `description`, `purpose`, `data_source`, `responsible_unit_id`, `operational_owner_name`, `retention_text`, `retention_value int`, `retention_unit` (`dias/meses/años/indefinido`), `retention_criterion`, `has_sensitive_data bool`, `has_international_transfer bool`, `has_automated_decision bool`, `uses_ai bool`, `own_systems_text`, `status` (enum), `completeness_pct int`, `current_version_no int`, `approved_at`, `closed_at` | 1 fila = 1 actividad **curada**. El campo legal *Responsable del tratamiento* NO va aquí (es config institucional, §4.6). |
| `activity_intervening_units` | `activity_id`, `unit_id`, `role_in_activity` (`recolecta/procesa/custodia/consulta`) | Campo legal 4 "Áreas que intervienen". |
| `activity_legal_bases` | `activity_id`, `legal_basis_id`, `justification` | 1..N; datos sensibles ⇒ exige base reforzada (guarda en trigger). |
| `activity_data_categories` | `activity_id`, `data_category_id`, `is_sensitive bool` (denormalizado del catálogo), `detail` | N:M. |
| `activity_subject_categories` | `activity_id`, `subject_category_id`, `is_protected_group bool` (NNA, etc.), `detail` | N:M. |
| `activity_recipients` | `activity_id`, `recipient_type_id`, `name`, `is_processor bool` (encargado), `detail` | Internos / encargados / organismos. |
| `activity_transfers` | `activity_id`, `country`, `guarantee_type_id`, `detail` | 0..N transferencias internacionales. |
| `activity_security_measures` | `activity_id`, `security_measure_id`, `detail` | N:M con catálogo + nota libre. |
| `activity_automated_decisions` | `activity_id`, `description`, `stage`, `human_in_the_loop bool`, `produces_profiling bool` | Separa lo que hoy el Excel mezcla en 1 columna. |
| `activity_attachments` | `activity_id`, `storage_provider` (`supabase/r2`), `object_path`, `filename`, `mime`, `size_bytes`, `sha256`, `uploaded_by` | Validación de tipo/tamaño en Edge Function. |

### 4.4 Catálogos (vocabularios controlados)

Todos con: `code`, `label`, `description`, `status` (`active/deprecated`), `superseded_by_id`, `sort_order`, `source` (`ley_21719/iso27001/observado/manual`).

| Catálogo | Semilla inicial (de Ley 21.719 + valores observados en Fase 1) |
|---|---|
| `legal_bases` | Consentimiento · Ejecución de contrato · Obligación legal · Interés legítimo · Interés vital del titular · Ejercicio de funciones de órgano público · *(sensibles)* Consentimiento explícito · Fines históricos/estadísticos/científicos |
| `data_categories` | Identificativos · Contacto · Académicos · Laborales · Económicos/financieros · Bancarios · Conducta/uso de sistemas · **Sensibles:** salud · biométricos · origen étnico · afiliación sindical · afiliación política · creencias/religión · vida sexual/orientación · situación socioeconómica *(dato sensible en la Ley 21.719)* |
| `subject_categories` | Estudiantes · Postulantes · Egresados/alumni · Académicos/as · Funcionarios/as · Honorarios · Investigadores/as · Proveedores · Pacientes · Participantes de investigación · Participantes de extensión · Apoderados · **NNA** |
| `recipient_types` | Unidades internas · Encargado de tratamiento (proveedor) · Organismo público / regulador · Institución educativa receptora · Campos clínicos / red de salud · Entidad bancaria |
| `security_measures` | Control de acceso por rol · MFA · Cifrado en tránsito · Cifrado en reposo · Respaldos · Registro y trazabilidad · Acuerdos de confidencialidad · Capacitación · Anonimización/seudonimización · Acceso físico restringido |
| `transfer_guarantee_types` | Cláusulas contractuales tipo · País con nivel adecuado · Consentimiento del titular · Norma/BCR · Sin garantía formal *(hallazgo a corregir)* |
| `retention_criteria` | Plazo legal sectorial · Duración del vínculo + N años · Fin de la finalidad · Política institucional documentada · Sin criterio definido *(a corregir)* |
| `campuses` | Talca · Linares · Colchagua (Santa Cruz) · Santiago |

### 4.5 Ciclo de vida y control

| Tabla | Columnas clave |
|---|---|
| `workflow_states` | `code`, `label`, `is_initial bool`, `is_terminal bool`, `sort_order` |
| `workflow_transitions` | `from_state`, `to_state`, `required_permission`, `guard` (`completeness_ok` \| `has_observations` \| `null`), `label`, `active bool` |
| `activity_status_transitions` | `activity_id`, `from_state`, `to_state`, `actor_user_id`, `comment`, `occurred_at` |
| `activity_reviews` | `activity_id`, `reviewer_user_id`, `opened_at`, `closed_at`, `outcome` (`approved/observed`), `summary` |
| `review_observations` | `review_id`, `field_path` (p. ej. `purpose`, `data_categories`), `severity` (`obligatoria/sugerida`), `text`, `resolved_by`, `resolved_at` |

### 4.6 Configuración institucional

| Tabla | Contenido |
|---|---|
| `institutional_controller` (1 fila) | Razón social, RUT, domicilio, representante legal de la Universidad. Es el "Responsable del tratamiento" constante. Override opcional por actividad vía `processing_activities.controller_override_id` → `controller_overrides`. |
| `data_protection_officer` (1 fila activa) | Nombre, correo, domicilio del DPD institucional. Historizado (`valid_from/valid_to`). |
| `feature_flags` | `key`, `enabled bool`, `description`, `updated_by` |
| `app_settings` | `key`, `value jsonb` — umbrales de completitud, política de contraseñas, tamaño máx. de adjunto, etc. |

### 4.7 Auditoría

| Tabla | Columnas |
|---|---|
| `audit_log` (append-only, particionada por mes) | `id`, `occurred_at`, `actor_user_id`, `actor_email_snapshot`, `actor_ip inet`, `actor_user_agent`, `action` (enum: `login/login_failed/logout/mfa_enrolled/create/update/delete/state_change/review/import/export/permission_grant/config_change/access_denied`), `entity_type`, `entity_id`, `unit_id`, `previous_state`, `new_state`, `changed_fields text[]`, `diff jsonb`, `result` (`success/denied/error`), `request_id`, `prev_hash`, `row_hash`, `metadata jsonb` |

- `prev_hash`/`row_hash`: cadena de hash opcional (tamper-evidence) calculada en el trigger.
- **Inmutabilidad:** política RLS que permite `SELECT` a `audit.read` y **niega** `INSERT/UPDATE/DELETE` a todos los roles; la escritura ocurre solo dentro de `app.write_audit()` (`SECURITY DEFINER`, propietaria = rol privilegiado). `UPDATE`/`DELETE` revocados a nivel de `GRANT` incluso para el rol de servicio.

### 4.8 Importación

| Tabla | Columnas |
|---|---|
| `import_batches` | `id`, `source_filename`, `sheet_names text[]`, `uploaded_by`, `status` (`uploaded/parsed/mapped/validated/previewed/committed/failed`), `summary jsonb` (`{found, valid, warnings, errors}`), `committed_at` |
| `import_column_mappings` | `template_key`, `source_column`, `target_field`, `transform` (`trim/split_semicolon/lookup_unit/…`) — reutilizable entre cargas |
| `import_rows_staging` | `batch_id`, `sheet`, `source_row_no`, `raw jsonb`, `mapped jsonb`, `classification` (`activity_seed/contact/note/empty`), `validation` (`valid/warning/error`), `messages jsonb`, `target` (`processing_activity/engagement_contact/discarded`), `result_entity_id`, `resolved_unit_id` |

### 4.9 Módulo de seguimiento del proyecto (separado del RAT)

| Tabla | Columnas |
|---|---|
| `project_phases` | `code`, `name`, `order`, `starts_on`, `ends_on` (semilla = 5 fases de la Carta Gantt) |
| `project_tasks` | `phase_id`, `name`, `unit_id` (opc.), `planned_start`, `planned_end`, `status` (`no_iniciada/en_curso/completada/en_receso`) |
| `unit_engagements` (1:1 con unidad) | `unit_id`, `stage` (`no_contactada/contactada/agendada/reunion_realizada/en_seguimiento/levantamiento_completo`), `contacted_on`, `meeting_on`, `pending_items`, `notes`, `last_update_at`, `owner_user_id` |
| `engagement_contacts` | `unit_id`, `full_name`, `position`, `email`, `phone`, `source_import_batch_id`, `notes` — **aquí caen los ~761 nombres** |

---

## 5. Esquema de BD — DDL conceptual (extracto)

> Tipos y enums centrales. El DDL completo son las migraciones de la Fase 4.

```sql
-- ── enums ───────────────────────────────────────────────────────────────
create type unit_type as enum (
  'consejo','rectoria','contraloria','secretaria_general','vicerrectoria',
  'direccion_general','direccion','departamento','unidad','oficina','programa',
  'academia','sede','facultad','instituto','escuela','otro');

create type activity_status as enum (
  'BORRADOR','EN_COMPLETADO','EN_REVISION','OBSERVADO','CORREGIDO','APROBADO','CERRADO');

create type audit_action as enum (
  'login','login_failed','logout','mfa_enrolled','create','update','delete',
  'state_change','review','import','export','permission_grant','config_change','access_denied');

-- ── unidades ────────────────────────────────────────────────────────────
create table organizational_units (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name_official text not null,
  name_short    text not null,
  acronym       text,
  type          unit_type not null,
  parent_id     uuid references organizational_units(id),
  campus        text,
  status        text not null default 'active',   -- active|inactive|merged
  merged_into_id uuid references organizational_units(id),
  needs_review  boolean not null default false,
  sort_order    int not null default 0,
  external_ref  text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on organizational_units(parent_id);
create index on organizational_units(status);

-- ── actividad de tratamiento ────────────────────────────────────────────
create table processing_activities (
  id                uuid primary key default gen_random_uuid(),
  ref_code          text unique not null,                       -- RAT-000001 (secuencia global)
  unit_local_no     int,
  responsible_unit_id uuid not null references organizational_units(id),
  title             text not null,
  description       text,
  purpose           text,
  data_source       text,
  operational_owner_name text,
  retention_value   int,
  retention_unit    text,                                       -- dias|meses|años|indefinido
  retention_criterion text,
  retention_text    text,
  has_sensitive_data      boolean not null default false,
  has_international_transfer boolean not null default false,
  has_automated_decision  boolean not null default false,
  uses_ai           boolean not null default false,
  own_systems_text  text,
  status            activity_status not null default 'BORRADOR',
  completeness_pct  int not null default 0,
  current_version_no int not null default 0,
  controller_override_id uuid,
  approved_at       timestamptz,
  closed_at         timestamptz,
  created_by        uuid, updated_by uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on processing_activities(responsible_unit_id);
create index on processing_activities(status);

-- ── versiones (snapshot inmutable) ──────────────────────────────────────
create table activity_versions (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references processing_activities(id) on delete cascade,
  version_no   int not null,
  reason       text,                    -- 'submit' | 'approve' | 'manual' | 'restore'
  snapshot     jsonb not null,          -- actividad + colecciones hijas denormalizadas
  content_hash text not null,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  unique (activity_id, version_no)
);

-- ── auditoría (append-only, particionada) ───────────────────────────────
create table audit_log (
  id            bigint generated always as identity,
  occurred_at   timestamptz not null default now(),
  actor_user_id uuid,
  actor_email_snapshot text,
  actor_ip      inet,
  actor_user_agent text,
  action        audit_action not null,
  entity_type   text,
  entity_id     uuid,
  unit_id       uuid,
  previous_state text,
  new_state     text,
  changed_fields text[],
  diff          jsonb,
  result        text not null default 'success',   -- success|denied|error
  request_id    text,
  prev_hash     text,
  row_hash      text,
  metadata      jsonb,
  primary key (id, occurred_at)
) partition by range (occurred_at);
```

### 5.1 Funciones auxiliares para RLS (todas `stable`, `security definer` cuando corresponde)

```sql
app.uid()                     -- auth.uid()
app.is_superadmin()           -- ¿tiene rol superadmin global?
app.has_perm(text)            -- ¿el usuario tiene el permiso X por alguno de sus roles?
app.scoped_unit_ids()         -- conjunto de unit_id que el usuario puede ver
                              --   = unidades asignadas  ∪  (descendientes si includes_descendants)
app.can_read_activity(uuid)   -- has_perm('activity.read.all') OR responsible_unit_id ∈ scoped_unit_ids()
app.can_write_activity(uuid)  -- análogo con activity.update.* y estado editable
```

### 5.2 Estrategia RLS (patrón aplicado a **todas** las tablas)

```sql
alter table processing_activities enable row level security;

create policy pa_select on processing_activities for select
  using ( app.has_perm('activity.read.all')
          or responsible_unit_id in (select app.scoped_unit_ids()) );

create policy pa_insert on processing_activities for insert
  with check ( app.has_perm('activity.create')
               and responsible_unit_id in (select app.scoped_unit_ids()) );

create policy pa_update on processing_activities for update
  using ( app.can_write_activity(id) )
  with check ( app.can_write_activity(id) );

-- sin policy de DELETE  →  nadie borra vía API (borrado lógico por Edge Function)
```

- **`audit_log`, `activity_versions`, `activity_status_transitions`:** `SELECT` según permiso; **ninguna** policy de escritura → solo los triggers/funciones `SECURITY DEFINER` escriben.
- **Catálogos y `organizational_units`:** `SELECT` para todo usuario autenticado; escritura solo con `unit.manage` / `config.manage`.
- **`profiles`, `user_roles`, `user_unit_assignments`:** el usuario ve su propia fila; gestión completa con `user.manage`.

### 5.3 Triggers de invariantes

| Trigger | Tabla | Efecto |
|---|---|---|
| `trg_audit` | todas las tablas de negocio | `AFTER INSERT/UPDATE/DELETE` → `app.write_audit()` con `diff` y `changed_fields`. |
| `trg_state_guard` | `processing_activities` | `BEFORE UPDATE OF status` → valida contra `workflow_transitions` (transición existe + permiso + guarda); inserta en `activity_status_transitions`. |
| `trg_version` | `processing_activities` + hijas | En `reason ∈ {submit, approve, manual}` → arma `snapshot jsonb`, calcula hash, inserta `activity_versions`, actualiza `current_version_no`. |
| `trg_completeness` | `processing_activities` + hijas | Recalcula `completeness_pct` y `has_*` según reglas de `app_settings`. |
| `trg_sensitive_base` | `activity_legal_bases` / `activity_data_categories` | Si hay dato sensible y no hay base reforzada → error. |
| `trg_touch_updated_at` | todas | `updated_at = now()`, `updated_by = app.uid()`. |

### 5.4 Indicadores (no *hardcodeados*)

```sql
create materialized view mv_institutional_kpis as
  select
    (select count(*) from organizational_units where status='active' and type in ('vicerrectoria','direccion','direccion_general','departamento','sede','unidad','facultad')) as unidades_total,
    (select count(distinct responsible_unit_id) from processing_activities) as unidades_con_actividades,
    count(*)                                            as actividades_total,
    count(*) filter (where status='BORRADOR')           as en_borrador,
    count(*) filter (where status='EN_REVISION')        as en_revision,
    count(*) filter (where status='APROBADO')           as aprobadas,
    count(*) filter (where status='OBSERVADO')          as observadas,
    round(avg(completeness_pct))                        as completitud_promedio
  from processing_activities;

-- refresco: pg_cron cada 10 min  +  NOTIFY tras transiciones relevantes
select cron.schedule('kpi_refresh', '*/10 * * * *', $$refresh materialized view concurrently mv_institutional_kpis$$);
select cron.schedule('keep_alive',  '17 */12 * * *', $$select 1$$);
```

`mv_unit_kpis` análoga, agrupada por `responsible_unit_id`, con RLS aplicada vía vista *security invoker* encima.

---

## 6. Modelo RBAC + scoping por unidad

### 6.1 Permisos atómicos

| Categoría | Permisos |
|---|---|
| Actividades | `activity.read.own_unit` · `activity.read.all` · `activity.create` · `activity.update.own_unit` · `activity.update.all` · `activity.submit` · `activity.review` · `activity.close` · `activity.reopen` · `activity.delete` |
| Unidades | `unit.read.all` · `unit.manage` |
| Usuarios/roles | `user.read` · `user.manage` · `role.manage` |
| Datos maestros | `config.manage` (catálogos, DPD, controller, flags) |
| Importación / exportación | `import.execute` · `export.execute` |
| Auditoría | `audit.read` |
| Seguimiento | `tracking.read.own_unit` · `tracking.read.all` · `tracking.manage` |

### 6.2 Matriz rol × permiso (por defecto; editable con `role.manage`)

| Permiso | Superadmin | DPD / Admin RAT | Responsable de Unidad | Colaborador | Auditor |
|---|:--:|:--:|:--:|:--:|:--:|
| `activity.read.all` | ✅ | ✅ | — | — | ✅ |
| `activity.read.own_unit` | ✅ | ✅ | ✅ | ✅ | ✅ (alcance) |
| `activity.create` | ✅ | ✅ | ✅ | ✅ | — |
| `activity.update.own_unit` | ✅ | ✅ | ✅ | ✅¹ | — |
| `activity.update.all` | ✅ | ✅ | — | — | — |
| `activity.submit` | ✅ | ✅ | ✅ | — | — |
| `activity.review` / `close` / `reopen` | ✅ | ✅ | — | — | — |
| `activity.delete` | ✅ | ✅² | — | — | — |
| `unit.manage` | ✅ | — | — | — | — |
| `user.manage` / `role.manage` | ✅ | — | — | — | — |
| `config.manage` | ✅ | ✅³ | — | — | — |
| `import.execute` | ✅ | ✅ | — | — | — |
| `export.execute` | ✅ | ✅ | ✅ (su unidad) | — | ✅ |
| `audit.read` | ✅ | ✅ | ✅⁴ (su unidad) | — | ✅ |
| `tracking.read.all` / `tracking.manage` | ✅ | ✅ | — | — | ✅ (solo lectura) |
| `tracking.read.own_unit` | ✅ | ✅ | ✅ | ✅ | ✅ |

¹ Colaborador: solo campos de actividades en estado editable, sin `submit`.  ² Borrado lógico, con motivo.  ³ DPD administra catálogos y DPO, no *feature flags* críticos.  ⁴ Auditoría filtrada a su(s) unidad(es).

### 6.3 Cómo se evalúa el alcance (scoping)

```text
usuario ──has── user_roles (global | unit)
        └─has── user_unit_assignments (unit_id, includes_descendants)

scoped_unit_ids(usuario) =
    { u.id : (u.id ∈ asignaciones)                          }
  ∪ { d.id : d ∈ descendientes(u) ∧ asignación.includes_descendants }

Lectura de actividad X permitida  ⟺
    has_perm('activity.read.all')
  ∨ X.responsible_unit_id ∈ scoped_unit_ids(usuario)
```

Regla del brief (§26): `/rat/123` **no** da acceso — la RLS filtra `123` si su unidad no está en `scoped_unit_ids()`. La UI nunca decide esto.

### 6.4 Cuatro capas de autorización (defense in depth)

| Capa | Qué hace | Se puede saltar? |
|---|---|---|
| 1 · UI (React) | Oculta/deshabilita acciones no permitidas | Sí — **no es seguridad**, solo UX |
| 2 · PostgREST + **RLS** | Filtra filas y valida `with check` en cada lectura/escritura directa | No desde el cliente |
| 3 · **Edge Functions** | Operaciones multi-paso/privilegiadas: revalida permisos, usa *service role* de forma acotada, escribe auditoría | No |
| 4 · **Constraints + triggers** | Máquina de estados, base reforzada para sensibles, auditoría y versión siempre | No — a nivel de motor |

---

## 7. Flujo de autenticación + MFA

```text
1. Usuario → /login  (correo institucional + contraseña)
2. Supabase Auth valida  →  AAL1
   · rate-limiting por IP/usuario (Supabase + regla en Edge Function)
   · registro: audit_log(login | login_failed)
3. Si el usuario no tiene TOTP inscrito → /mfa/enroll
   · muestra QR (compatible Microsoft Authenticator / Google Authenticator)
   · verifica primer código  →  audit_log(mfa_enrolled)
4. Challenge TOTP  →  AAL2
5. La app EXIGE aal2 para todo:  RLS y Edge Functions rechazan JWT con aal1
   ( policy:  (auth.jwt() ->> 'aal') = 'aal2' )
6. Sesión:  access token corto (1 h) + refresh token;  expiración por inactividad 30 min (config)
7. Logout → revoca refresh;  audit_log(logout)

Recuperación de contraseña:  enlace firmado de un solo uso (Supabase) → exige re-inscripción MFA si aplica.

Adaptador SSO (sin rediseño):
   authProvider abstracto  →  { password (hoy) | azure-oidc (activable) }
   Al activar Entra ID:  se habilita el provider Azure en Supabase Auth;
   los usuarios se vinculan por correo institucional;  MFA puede delegarse al IdP.
```

Política de contraseñas, intentos y bloqueo → `app_settings` (longitud mínima, rechazo de contraseñas filtradas vía HIBP k-anon, N intentos → backoff).

---

## 8. Flujo de aprobación (máquina de estados)

```text
                         crear
                           │
                           ▼
                      ┌─────────┐   editar    ┌──────────────┐
                      │ BORRADOR│◄───────────►│ EN_COMPLETADO│
                      └────┬────┘             └──────┬───────┘
                           │  activity.submit         │ activity.submit
                           │  [guarda: completitud    │ [misma guarda]
                           │   obligatoria = 100%]    │
                           └───────────┬──────────────┘
                                       ▼
                                ┌─────────────┐
                    ┌──────────►│ EN_REVISION │◄───────────┐
                    │           └──────┬──────┘            │
                    │        activity.review               │ activity.submit
                    │        ┌─────────┴─────────┐          │
       activity.reopen│      ▼                   ▼          │
       [con motivo]  │ ┌──────────┐        ┌───────────┐   │
                    │ │ APROBADO │        │ OBSERVADO │───┘
                    │ └────┬─────┘        └─────┬─────┘
                    │      │ activity.close     │ activity.update.own_unit
                    │      ▼                    ▼
                    │ ┌──────────┐        ┌───────────┐
                    └─┤ CERRADO  │        │ CORREGIDO │──► (activity.submit) ─► EN_REVISION
                      └──────────┘        └───────────┘
   APROBADO ──activity.review──► OBSERVADO   (hallazgo antes de cerrar)
```

- Toda transición: `workflow_transitions` (existe + permiso + guarda) → `activity_status_transitions` + `audit_log(state_change)` + (si aplica) `activity_versions`.
- `OBSERVADO` exige ≥ 1 `review_observations` de severidad `obligatoria`.
- `CERRADO → EN_REVISION` mantiene el "RAT vivo" (§ Fase 1): revisión periódica.
- Configurable: agregar/quitar transiciones o cambiar el permiso requerido sin desplegar código.

---

## 9. Estrategia de auditoría

| Propiedad | Implementación |
|---|---|
| **Cobertura** | Trigger `trg_audit` en toda tabla de negocio + eventos de Auth (Edge Function/hook) + `access_denied` (registrado por Edge Functions y por un *wrapper* de RLS en operaciones críticas). |
| **Contenido** (§10 Fase 1) | usuario, correo *snapshot*, fecha/hora, IP, user-agent, acción, entidad, unidad, estado anterior/nuevo, campos modificados, `diff`, resultado. IP/UA vía `current_setting('request.headers', true)`. |
| **Inmutabilidad** | RLS sin `INSERT/UPDATE/DELETE`; `GRANT` revocado; escritura solo en `app.write_audit()` (`SECURITY DEFINER`). Partición mensual → `REVOKE` sobre particiones antiguas. |
| **Tamper-evidence** (opcional) | Cadena `prev_hash → row_hash` (SHA-256 de la fila + hash previo); Edge Function `audit-verify` recorre y detecta rupturas. |
| **Retención / respaldo** | Export mensual firmado a R2 (WORM lógico); política de retención en `app_settings`. |
| **Consulta** | Vista para `audit.read`, filtrada por unidad para el rol Responsable; búsqueda por entidad, actor, rango, acción. |

---

## 10. Estrategia de versionado

- **Working copy:** la fila de `processing_activities` + hijas es el estado editable actual.
- **Versión (snapshot inmutable):** se crea en `submit`, `approve`, `restore` y "guardar versión" manual — **no** en cada tecla ni en cada insert de hija (evita explosión de versiones durante la edición del borrador).
- `activity_versions.snapshot` = `jsonb` con la actividad y todas sus colecciones hijas denormalizadas + `content_hash`.
- **Comparar:** Edge Function `activity-diff(v_a, v_b)` → diff estructurado por campo y por colección; el cliente lo pinta.
- **Restaurar:** genera una **nueva** versión a partir del snapshot elegido (nunca *hard rollback*), con `reason='restore'`, auditada, sujeta a permiso `activity.update.*`.
- **Identificar la actual:** `processing_activities.current_version_no`.

---

## 11. Endpoints principales

> PostgREST expone cada tabla como recurso REST (`/rest/v1/<tabla>`) con filtros; abajo van los de negocio y las Edge Functions. Todos exigen JWT `aal2`.

| Método | Ruta | Capa | Descripción | Permiso |
|---|---|---|---|---|
| `GET` | `/rest/v1/processing_activities?...` | PostgREST+RLS | Listar/filtrar actividades (RLS aplica scope) | `activity.read.*` |
| `GET` | `/rest/v1/processing_activities?id=eq.` | PostgREST+RLS | Detalle (deniega si fuera de scope) | `activity.read.*` |
| `POST` | `/rest/v1/processing_activities` | PostgREST+RLS | Crear borrador | `activity.create` |
| `PATCH` | `/rest/v1/processing_activities?id=eq.` | PostgREST+RLS | Editar campos (estado editable) | `activity.update.*` |
| `POST` | `/functions/v1/activity-transition` | Edge | Cambiar estado (`submit/review/observe/approve/close/reopen`) con validación y comentario | según transición |
| `GET` | `/functions/v1/activity-diff?a=&b=` | Edge | Comparar dos versiones | `activity.read.*` |
| `POST` | `/functions/v1/activity-restore` | Edge | Restaurar versión → nueva versión | `activity.update.*` |
| `GET` | `/rest/v1/mv_unit_kpis` / `mv_institutional_kpis` | PostgREST+RLS | Indicadores del dashboard | `activity.read.*` |
| `GET` | `/rest/v1/organizational_units` | PostgREST+RLS | Árbol de unidades | autenticado |
| `POST`/`PATCH` | `/rest/v1/organizational_units` | PostgREST+RLS | Alta/edición de unidad; marcar `needs_review` | `unit.manage` |
| `POST` | `/functions/v1/import-parse` | Edge | Subir Excel → detectar hojas/columnas → `import_rows_staging` con clasificación | `import.execute` |
| `POST` | `/functions/v1/import-validate` | Edge | Validar + resolver unidades por alias → resumen `{found, valid, warnings, errors}` | `import.execute` |
| `POST` | `/functions/v1/import-commit` | Edge | Crear `engagement_contacts` y borradores en staging (nunca publica) | `import.execute` |
| `POST` | `/functions/v1/export` | Edge | Exportar RAT (completo/unidad/filtrado) e indicadores → `xlsx`/`csv`/`pdf` | `export.execute` |
| `POST` | `/functions/v1/attachments-sign` | Edge | URL firmada de subida (valida MIME/tamaño; destino Supabase Storage o R2) | `activity.update.*` |
| `GET` | `/rest/v1/audit_log?...` | PostgREST+RLS | Consulta de auditoría (filtrada por unidad si Responsable) | `audit.read` |
| `POST` | `/functions/v1/users-invite` | Edge | Invitar usuario, asignar rol y unidad(es) | `user.manage` |
| `GET`/`PATCH` | `/rest/v1/unit_engagements` | PostgREST+RLS | Seguimiento por unidad | `tracking.*` |

---

## 12. Portabilidad y ruta de salida de la capa gratuita

| Componente | Hoy (gratis) | Migración a UTalca | Retrabajo |
|---|---|---|---|
| Base de datos | Supabase Postgres | Supabase self-hosted (Docker) **o** Postgres institucional | **Ninguno** — mismas migraciones `*.sql`, RLS, funciones, `pg_cron` |
| Auth | Supabase Auth (GoTrue) | GoTrue self-hosted **o** Keycloak/Entra como OIDC + API propia | Bajo — `authProvider` abstracto; `profiles` desacopla de `auth.users` por `user_id` |
| API | PostgREST | PostgREST self-hosted **o** NestJS/Hono sobre el mismo esquema | Bajo/medio — los contratos REST se replican |
| Edge Functions | Deno Deploy (Supabase) | Contenedores en UTalca | Bajo — Deno/TypeScript portable |
| Frontend | Cloudflare Pages | Nginx/estático en UTalca | Ninguno |
| Adjuntos | Supabase Storage / R2 | MinIO/S3 institucional | Bajo — `storage_provider` ya es columna |

**Regla de disciplina:** nada de lógica en el cliente que deba estar en BD/Edge; toda la lógica de negocio en SQL o Deno portable; cero dependencia de características propietarias fuera de `auth.*` y `storage.*`.

---

## 13. Roadmap del MVP (incremental)

| Incremento | Contenido | Resultado usable |
|---|---|---|
| **4a — Núcleo** | Migraciones base; seed de unidades v0.1 + catálogos; Auth + MFA; RBAC + RLS; CRUD de actividades (wizard, §Fase 3); completitud; auditoría + versión; dashboard por rol; export XLSX/CSV. | El DPD y las unidades ya registran y revisan actividades reales. |
| **4b — Flujo y datos** | Máquina de estados completa + revisión/observaciones; módulo de seguimiento (unidades, contactos); **importación asistida** (parse→map→validate→preview→commit a staging). | Se cargan los ~761 contactos y se curan las ~43 actividades. |
| **4c — Refinamiento** | Notificaciones in-app + digest por correo; adjuntos (R2); comparación visual de versiones; export PDF institucional; tablero de "mejora continua" del catálogo (`needs_review`). | RAT operativo end-to-end. |
| **Post-MVP** | SSO Entra ID productivo; Carta Gantt interactiva; rama `FIE` (facultades); métricas de evolución temporal; API pública de solo lectura para la APDP. | — |

---

## 14. Riesgos nuevos / actualizados

| # | Riesgo | Mitigación |
|---|---|---|
| R13 | **Residencia de datos** fuera de Chile (Supabase/AWS São Paulo) | Piloto con datos acotados; DPA/cláusulas; registrar la plataforma en su propio RAT; plan de migración §12 aprobado desde ya. |
| R14 | **Pausa del proyecto** por inactividad (7 días) | `pg_cron` keep-alive + GitHub Action cron; alerta si el proyecto no responde. |
| R15 | **Acoplamiento a Supabase** dificulta la salida | Disciplina §12; revisiones de arquitectura por incremento; `authProvider` y `storage_provider` abstractos. |
| R16 | **RLS mal escrita = fuga entre unidades** | Suite de tests de RLS (usuario A no ve unidad B) obligatoria en CI; revisión de cada policy; negar por defecto. |
| R17 | Límite de **Storage 1 GB** | Adjuntos a R2; límite por archivo; tipos permitidos; sin adjuntos en 4a. |
| R18 | Organigrama v0.1 con nodos `needs_review` | Flujo de confirmación en la UI de unidades; no bloquea el MVP; el modelo ya soporta re-parentar auditado. |

---

## 15. Próximos pasos → Fase 3 (UX/UI)

Diseñar, con criterio institucional, minimalista y accesible (WCAG 2.1 AA):

1. Login · inscripción y *challenge* MFA · recuperación de contraseña.
2. Dashboard institucional (DPD/Superadmin) y **dashboard de unidad** (Responsable) — distintos por rol.
3. Lista de actividades (filtros, búsqueda, estado, completitud).
4. **Formulario RAT tipo wizard** (9 pasos de la Fase 1) con completitud en vivo, tooltips y ejemplos.
5. Detalle de actividad · historial de versiones · comparación.
6. Bandeja de revisión del DPD (observaciones por campo).
7. Consola de auditoría.
8. Administración: usuarios y roles · **árbol de unidades** (con `needs_review`) · catálogos · configuración institucional (DPD, responsable).
9. Módulo de seguimiento: tablero de unidades y contactos.
10. Asistente de importación (subir → mapear → vista previa → confirmar).

**Pendiente del usuario para afinar el seed:** confirmar los 7 nodos `needs_review` del catálogo de unidades (Dirección de Género y su dependencia; Unidad de Convivencia Universitaria; Oficinas de Proyectos Basales / Transformación Digital Administrativa / Seguridad Digital; ubicación de "D° de Desarrollo" y "D° de Apoyo al Estudiante" de la Carta Gantt).

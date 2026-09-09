# Fase 3 — UX / UI
## Plataforma institucional RAT · Universidad de Talca

> Continúa la [Fase 1 — Análisis](Fase1_Analisis_RAT_UTalca.md) y la [Fase 2 — Arquitectura](Fase2_Arquitectura_RAT_UTalca.md).
> Define el sistema de diseño, el inventario de pantallas con sus especificaciones, los patrones de interacción y la checklist de accesibilidad. El **mockup navegable** acompaña este documento como artifact.

Fecha: 2026-09-09 · Carácter visual pedido: **institucional · minimalista · sobrio · limpio · accesible**. Debe transmitir *seguridad + institucionalidad + simplicidad*. Evitar: interfaces cargadas, exceso de gráficos, colores excesivos, aire de app comercial.

---

## 1. Principios de diseño

1. **Es una herramienta, no un documento.** Se opera y se escanea; primero el resumen, luego el detalle. El estado se codifica en forma **y** color (pill, chip, franja), no solo en texto.
2. **Sobriedad institucional.** Un acento, usado con moderación. El color semántico (aprobado / observado / crítico) es independiente del acento.
3. **El backend manda.** La UI oculta o deshabilita lo no permitido, pero nunca es la frontera de seguridad. Toda vista existe también en su estado "sin permiso" y "sin datos".
4. **Carga cognitiva baja para usuarios no técnicos.** El formulario RAT es un asistente por pasos, con ayuda contextual y ejemplos; nunca 15+ campos en una pantalla.
5. **Trazabilidad visible.** Quién, cuándo y qué cambió está siempre a un clic (historial, auditoría, transiciones).
6. **Mejora continua a la vista.** Los nodos `needs_review` del catálogo de unidades y los vocabularios deprecados se muestran y se gestionan, no se esconden.

---

## 2. Sistema de diseño

### 2.1 Color

Neutros con leve sesgo frío (hacia el azul institucional), no gris puro.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--ground` | `#f4f6f8` | `#0f141b` | Fondo de la aplicación |
| `--surface` | `#ffffff` | `#161d27` | Tarjetas, paneles, tablas |
| `--surface-sunken` | `#eef1f4` | `#1c2530` | Encabezados de tabla, zonas de relleno |
| `--ink` | `#141b26` | `#e6e9ee` | Texto principal |
| `--ink-muted` | `#5a6675` | `#9aa7b6` | Texto secundario, etiquetas |
| `--border` | `#d7dde5` | `#2a3542` | Bordes, divisores |
| `--navy` (primario) | `#17324f` | `#7fa8cf` | Barra lateral, encabezados, texto de marca |
| `--accent` | `#2f6f9f` | `#4f97c9` | Acción primaria, navegación activa, foco |
| `--accent-weak` | `#e3eef5` | `#1e3a4d` | Fondo de estado activo / seleccionado |
| `--success` | `#2e7d5b` | `#5cba8e` | Aprobado, completo, en curso |
| `--warning` | `#b9762a` | `#d99a52` | Observado, pendiente, advertencia de import |
| `--critical` | `#b23b3b` | `#e07a7a` | Error, rechazo, intento fallido, dato sensible sin base |
| `--info` | `#4a5b8c` | `#8ea1d4` | Borrador, informativo |

Contraste objetivo: texto normal ≥ 4.5:1, texto grande y componentes ≥ 3:1 en ambos temas.

### 2.2 Tipografía

| Rol | Familia | Fallback | Uso |
|---|---|---|---|
| Títulos / display | **Spectral** (serif) | `Georgia, serif` | Encabezados de página y de sección, números de KPI. Carácter de documento oficial / "registro". |
| UI / cuerpo | **Public Sans** (sans) | `system-ui, sans-serif` | Todo el texto de interfaz, formularios, tablas. Tipografía de uso gubernamental — coherente con un registro de cumplimiento. |
| Datos / código | **IBM Plex Mono** | `ui-monospace, monospace` | `RAT-000001`, RUT, fechas en tablas, consola de auditoría, hashes. |

Escala (base 16 px, ratio ~1.2): 12 · 13 · 14 · 16 · 19 · 23 · 28 · 34.
Cuerpo 14–16 px; medida de lectura ~65–72 caracteres en textos largos (ayudas, definiciones). Etiquetas en versalitas con `letter-spacing: 0.04em`. Números tabulares (`font-variant-numeric: tabular-nums`) en toda columna numérica.

### 2.3 Espacio, forma, elevación

- Grid de espaciado de 4 px: 4 · 8 · 12 · 16 · 24 · 32 · 48.
- Radios: `2px` (inputs, chips), `6px` (tarjetas, botones), `10px` (modales). Nada más redondeado — evita el aire "comercial".
- Sombra: una sola, sutil, reservada para elementos flotantes (menús, modales, toasts). Las tarjetas se separan con borde de 1 px, no con sombra.
- Ancho máximo de contenido: 1200 px; el asistente de formulario y las vistas de lectura, 760 px.

### 2.4 Iconografía

Set lineal, trazo 1.5 px, 20 px (nav) / 16 px (inline). Sin emoji. Un ícono nunca va solo como acción: siempre con etiqueta o `aria-label`.

---

## 3. Componentes (inventario y estados)

| Componente | Estados / variantes | Notas |
|---|---|---|
| **App shell** | sidebar expandida / colapsada; barra superior con selector de unidad, badge de rol, menú de usuario | La navegación refleja permisos: los ítems sin acceso no se renderizan. |
| **Botón** | primario · secundario · fantasma · peligro · icónico; `hover` `active` `focus-visible` `disabled` `loading` | Foco: anillo `--accent` de 2 px + offset. `disabled` no solo baja opacidad: también quita del orden de tabulación con explicación en `title`/tooltip. |
| **Status pill** | `BORRADOR` (info) · `EN COMPLETADO` (info) · `EN REVISIÓN` (accent) · `OBSERVADO` (warning) · `CORREGIDO` (warning-weak) · `APROBADO` (success) · `CERRADO` (neutral, con ícono candado) | Forma + color + texto. Nunca solo color. |
| **Chip** | dato sensible · transferencia internacional · decisión automatizada · IA · NNA | Marca atributos de riesgo de una actividad de un vistazo. `dato sensible` en `--critical` si falta base reforzada. |
| **Medidor de completitud** | barra 0–100 % + lista de campos ✓ / ✗ | En el detalle y en el asistente, en vivo. Color: <60 % warning, 60–99 % accent, 100 % success. |
| **Tabla de datos** | encabezado fijo, orden por columna, densidad normal/compacta, selección, paginación, fila expandible | Sin scroll horizontal del `body`: la tabla scrollea dentro de su contenedor. Vacío: mensaje + acción sugerida. |
| **Filtros** | barra de filtros con chips activos removibles + búsqueda; "guardar vista" | Estado de filtros reflejado en la URL (compartible, pero sin datos personales en query string). |
| **Wizard / stepper** | 9 pasos, indicador de progreso, paso con error marcado, "guardar y salir" siempre disponible | Navegación libre entre pasos ya visitados; el envío exige completitud obligatoria. |
| **Campo de formulario** | label · ayuda contextual (ícono "?") · ejemplo · error inline · requerido | El error dice qué pasó y cómo corregir. Ejemplos tomados de la hoja Introducción del instrumento. |
| **Panel de observaciones** | lista por campo, severidad (obligatoria / sugerida), estado (abierta / resuelta), hilo | Usado por el DPD al observar y por el Responsable al corregir. |
| **Diff de versiones** | dos columnas (v.A / v.B), cambios resaltados por campo y por colección, "restaurar esta versión" | Restaurar crea una versión nueva; nunca sobrescribe. |
| **Timeline de auditoría** | entradas con actor, hora, acción, entidad, resultado; filtro por rango/acción/actor | Monoespaciado para IDs y hashes. Inmutable: sin acciones de edición. |
| **Toast** | éxito · error · info; auto-cierre 5 s (éxito), persistente (error) | El texto confirma el hecho consumado ("Actividad enviada a revisión"). |
| **Banner de mockup** | fijo, discreto | "Prototipo — datos de ejemplo. No es información real de la Universidad." |

---

## 4. Navegación e información

```text
┌─ Barra lateral (navy) ──────────────┐   Barra superior: [Unidad ▾]  [Rol]  [🔔]  [Usuario ▾]
│ RAT · U. de Talca                    │
│                                     │   ── Área de contenido ──────────────────────────────
│ ▸ Tablero                            │   Encabezado de página:  Título · pill de estado · acciones
│ ▸ Actividades de tratamiento         │
│ ▸ Revisión           (DPD)           │   Contenido
│ ▸ Seguimiento del levantamiento      │
│ ▸ Importación        (DPD/Admin)     │
│ ▸ Auditoría                          │
│ ─────────────                        │
│ ▸ Administración     (Superadmin)    │
│   · Usuarios y roles                 │
│   · Unidades                         │
│   · Catálogos                        │
│   · Configuración institucional      │
└─────────────────────────────────────┘
```

El menú se filtra por permisos. La barra superior fija el **contexto de unidad**: para un Responsable multi-unidad, cambia el alcance de todas las vistas; para el DPD, incluye "Todas las unidades".

---

## 5. Inventario de pantallas

Para cada una: propósito · quién la ve · elementos clave · estados vacío/carga/sin permiso.

### 5.1 Acceso

**P-01 · Inicio de sesión**
Propósito: autenticar. Todos. Elementos: logo institucional, correo, contraseña, "¿olvidó su contraseña?", aviso de uso institucional. Errores genéricos ("Credenciales inválidas") sin revelar si el correo existe. Enlace a política de privacidad. Tras N intentos: espera con contador.

**P-02 · Segundo factor (MFA)**
Dos modos:
- *Inscripción* (primer ingreso): explicación breve, QR + clave manual, campo de 6 dígitos, códigos de recuperación de un solo uso (descargables), confirmación.
- *Desafío* (ingresos siguientes): campo de 6 dígitos, "usar código de recuperación", "confiar en este equipo 30 días" (opcional, configurable).
Mensaje claro de por qué se pide MFA (protección de datos personales).

**P-03 · Recuperar contraseña**
Solicitud por correo institucional → mensaje neutro ("Si el correo existe, enviaremos instrucciones") → pantalla de nueva contraseña con medidor de fortaleza y verificación contra contraseñas filtradas.

### 5.2 Tableros (distintos por rol — §26 del brief)

**P-04 · Tablero institucional** (Superadmin / DPD)
- Fila de KPIs (tiles con número grande, tipografía Spectral): unidades totales · unidades con actividades · actividades totales · en revisión · aprobadas · observadas · **% de avance institucional**. Todos calculados desde `mv_institutional_kpis`.
- **Avance por unidad**: lista con barra horizontal por unidad (responsable, N.º actividades, completas / pendientes, % , última actualización). Ordenable. Es el corazón del tablero, no un gráfico decorativo.
- Estado de las actividades: una sola barra apilada (borrador / revisión / observado / aprobado / cerrado).
- Panel "Requiere tu atención": actividades en revisión hace > X días, unidades sin avance, actividades con dato sensible sin base reforzada.
- Sin datos: estado inicial con "Aún no hay actividades registradas. Importar o crear la primera."

**P-05 · Tablero de unidad** (Responsable / Colaborador)
- Cabecera: nombre de la unidad + barra de avance de la unidad.
- Lista de actividades de la unidad con estado y completitud.
- Acción prominente **"+ Nueva actividad de tratamiento"**.
- "Pendientes de esta unidad": campos faltantes agregados, observaciones abiertas.
- Nunca muestra datos de otra unidad. Si el usuario tiene varias, el selector de unidad conmuta.

### 5.3 Actividades de tratamiento

**P-06 · Lista de actividades**
Tabla: `ref_code` (mono) · título · unidad · estado (pill) · completitud · chips de riesgo · última modificación · responsable. Filtros: unidad, estado, completitud, dato sensible, transferencia internacional, texto. Acciones por fila según permiso (ver, editar, enviar). Exportar (XLSX/CSV) respeta filtros y alcance. Paginación server-side.

**P-07 · Asistente de nueva actividad / edición (wizard, 9 pasos)**
Pasos (de la Fase 1): 1 Identificación · 2 Finalidad y tratamiento · 3 Titulares y datos · 4 Base jurídica · 5 Destinatarios y transferencias · 6 Conservación · 7 Automatización · 8 Seguridad · 9 Revisión.
- Panel lateral con progreso y medidor de completitud en vivo.
- Cada campo: label, ayuda ("?"), ejemplo, validación. Campos obligatorios marcados.
- Paso 3: al marcar una categoría de dato sensible, el Paso 4 exige base reforzada (indicador).
- Paso 9: resumen completo de solo lectura, lista de faltantes, botón **"Enviar a revisión"** (deshabilitado con motivo si falta algo obligatorio) y "Guardar como borrador".
- "Guardar y salir" en todo momento. Autoguardado del borrador cada N s con indicador.

**P-08 · Detalle de actividad**
- Encabezado: `ref_code`, título, unidad, pill de estado, chips de riesgo, acciones (editar / enviar / revisar / exportar / historial), según permiso y estado.
- Cuerpo en secciones plegables espejo de los 15 campos legales, con valores y catálogos resueltos a etiqueta legible.
- Barra lateral: completitud + faltantes, responsable operativo, DPD y responsable del tratamiento (institucionales), fechas del ciclo de vida.
- Pestañas: **Resumen · Historial · Observaciones · Auditoría** (esta última filtrada a la entidad).
- Sin permiso sobre la unidad: 404 (no "prohibido") — no se confirma la existencia del registro.

**P-09 · Historial y comparación de versiones**
Lista de versiones (n.º, fecha, autor, motivo: envío / aprobación / manual / restauración). Seleccionar dos → diff a dos columnas, cambios por campo y por colección. "Restaurar esta versión" (con permiso) → crea versión nueva, auditada.

### 5.4 Revisión (DPD)

**P-10 · Bandeja de revisión**
Cola de actividades `EN_REVISIÓN` / `CORREGIDO`, con antigüedad, unidad, completitud. Abrir → vista de detalle con **modo revisión**: agregar observación por campo (severidad obligatoria / sugerida), y al cerrar la revisión elegir **Aprobar** (→ APROBADO) u **Observar** (→ OBSERVADO, exige ≥ 1 observación obligatoria). Registro de la decisión con comentario.

### 5.5 Auditoría

**P-11 · Consola de auditoría**
Timeline / tabla monoespaciada: hora · actor (+ correo snapshot) · IP · acción · entidad · unidad · estado ant./nuevo · resultado. Filtros: rango, actor, acción, entidad, unidad, resultado. Detalle de fila: `diff` completo, `request_id`, `row_hash`. Exportar. Para el rol Responsable: filtrada a su(s) unidad(es). Sin acciones de escritura (inmutable). Botón "Verificar integridad de la cadena" (Superadmin) → resultado de `audit-verify`.

### 5.6 Seguimiento del levantamiento (módulo separado)

**P-12 · Tablero de unidades (seguimiento)**
Tabla de las 21 unidades: etapa (`no contactada` → `levantamiento completo`), fecha de contacto, fecha de reunión, responsable de la gestión, pendientes, última actualización. Vista Kanban opcional por etapa. Editable con `tracking.manage`. Vínculo a la Carta Gantt (fases y tareas). **No** se mezcla con el formulario RAT.

**P-13 · Contactos de la unidad**
Los ~761 responsables levantados, por unidad: nombre, cargo, correo, teléfono, origen (lote de importación), notas. Es el destino de los rosters del Excel (D4). Desde aquí se puede "promover a responsable de unidad" (crea invitación de usuario) o "usar como semilla de actividad".

### 5.7 Importación

**P-14 · Asistente de importación**
1. **Subir** Excel (drag & drop, validación de tipo/tamaño).
2. **Detectar** hojas y columnas; mostrar mapa hoja → unidad (resuelto por alias, con los no resueltos marcados).
3. **Mapear** columnas Excel → campos del sistema (plantilla reutilizable).
4. **Clasificar** cada fila: semilla de actividad / contacto / nota / vacía.
5. **Validar** → **vista previa**: `785 encontradas · 612 contactos · 43 semillas de actividad · 96 notas · 34 vacías · 25 advertencias · 10 errores`.
6. **Confirmar** → crea contactos y **borradores en staging** (nunca publica). Registra quién importó.
7. Resultado con enlaces a lo creado y descarga del informe.

### 5.8 Administración

**P-15 · Usuarios y roles**
Tabla de usuarios: nombre, correo, estado, MFA (sí/no), roles, unidades. Alta = invitación por correo institucional (sin auto-registro). Editar roles (global/unidad) y asignaciones de unidad (con "incluye descendientes"). Editor de matriz **rol × permiso** (Superadmin), con aviso al tocar roles del sistema.

**P-16 · Unidades (árbol organizacional)**
Árbol expandible (semilla v0.1, 106 nodos). Cada nodo: nombre oficial, corto, sigla, tipo, campus, estado, **badge `Por revisar`** en los 7 nodos `needs_review`. Acciones: crear hijo, editar, mover (re-parentar, auditado), marcar activa/inactiva/fusionada, gestionar alias. Filtro "solo por revisar" para el trabajo de depuración. La rama **"Facultades, Institutos y Escuelas"** aparece colapsada y vacía, lista para poblarse.

**P-17 · Catálogos**
Un panel por vocabulario (bases de licitud, categorías de datos, de titulares, destinatarios, medidas de seguridad, garantías de transferencia, criterios de conservación, campus). Ítems con `code`, etiqueta, descripción, origen (`ley_21719` / `observado` / `manual`), estado (activo / deprecado → reemplazado por). No se borran: se deprecan.

**P-18 · Configuración institucional**
Datos del **Responsable del tratamiento** (Universidad: razón social, RUT, domicilio, representante legal) y del **DPD** (nombre, contacto, domicilio, historial). Umbrales de completitud, política de contraseñas, tamaño máximo de adjunto, retención de auditoría. `feature_flags`.

---

## 6. Patrones de interacción

- **Cambios de estado**: siempre desde un modal que pide comentario (obligatorio al observar / reabrir), muestra el efecto ("Esta actividad pasará a EN REVISIÓN y se notificará al DPD") y registra la transición.
- **Autoguardado**: solo borradores; indicador "Guardado hace un momento"; nunca autoguarda una actividad en revisión.
- **Confirmaciones destructivas**: reabrir, restaurar versión, desactivar unidad, deprecar catálogo → confirmación con nombre del objeto escrito.
- **Errores de permiso**: nunca un "prohibido" que confirme existencia; para registros fuera de alcance, "no encontrado".
- **Notificaciones**: campana con contador; centro de notificaciones (observación recibida, actividad aprobada, unidad sin avance, vencimiento). Digest por correo configurable (post-MVP).
- **Vacíos con acción**: cada lista vacía sugiere el siguiente paso concreto.
- **Movimiento**: transiciones de 120–160 ms en apertura de menús/modales y cambио de paso del wizard. Nada de animación ambiental. Respeta `prefers-reduced-motion`.

---

## 7. Accesibilidad (WCAG 2.1 AA)

- Contraste verificado en ambos temas (≥ 4.5:1 texto, ≥ 3:1 componentes y foco).
- Todo operable por teclado; orden de tabulación lógico; `:focus-visible` siempre visible; "saltar al contenido".
- Estado nunca solo por color: pill con texto, chips con ícono + texto, diff con marca además de color.
- Formularios: `label` asociado, `aria-describedby` para ayuda y error, `aria-invalid`, resumen de errores al inicio del paso con enlaces a cada campo.
- Tablas con `<th scope>`, `caption`, orden anunciado.
- Modales: foco atrapado, `Esc` cierra, retorno de foco al disparador, `aria-modal`.
- Live regions para toasts y para el resultado de validación de importación.
- Objetivos táctiles ≥ 44 px en móvil.
- Idioma `es-CL`; fechas `dd-MM-aaaa`; RUT con formato y validación de dígito verificador.

---

## 8. Responsive

| Rango | Comportamiento |
|---|---|
| ≥ 1200 px | Shell completa, sidebar fija, tablas densas. |
| 768–1199 px | Sidebar colapsable a íconos; tablas con columnas secundarias plegadas en fila expandible. |
| < 768 px | Sidebar en *drawer*; tablas → tarjetas apiladas; wizard a pantalla completa, un paso por vista; KPIs en 2 columnas. |

El cuerpo nunca hace scroll horizontal; el contenido ancho scrollea en su contenedor.

---

## 9. Alcance del mockup adjunto (artifact)

Prototipo navegable (datos de ejemplo, claramente rotulado) con: Login · MFA · Tablero institucional · Tablero de unidad · Lista de actividades · Wizard (paso 3 y paso 9) · Detalle de actividad · Historial/diff · Bandeja de revisión · Auditoría · Seguimiento · Importación (vista previa) · Unidades (con `needs_review`) · Usuarios y roles. Tema claro/oscuro. No conecta a backend.

---

## 10. Próximos pasos → Fase 4 (Implementación, MVP)

Incremento **4a** (según roadmap Fase 2): monorepo + migraciones base + seed (unidades v0.1 + catálogos) + Auth/MFA + RBAC/RLS + CRUD de actividades con wizard + completitud + auditoría/versión + tableros + export XLSX/CSV.

**Pendiente del usuario:** confirmar los 7 nodos `needs_review` del catálogo de unidades y validar el sistema de diseño (paleta y tipografías) sobre el mockup.

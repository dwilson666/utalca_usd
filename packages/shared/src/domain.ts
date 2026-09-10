/** Enums de dominio — coinciden con los tipos de PostgreSQL (0001_foundation.sql). */

export const ACTIVITY_STATUS = [
  'BORRADOR',
  'EN_COMPLETADO',
  'EN_REVISION',
  'OBSERVADO',
  'CORREGIDO',
  'APROBADO',
  'CERRADO',
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUS)[number];

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  BORRADOR: 'Borrador',
  EN_COMPLETADO: 'En completado',
  EN_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
  CORREGIDO: 'Corregido',
  APROBADO: 'Aprobado',
  CERRADO: 'Cerrado',
};

export const EDITABLE_ACTIVITY_STATUS: ReadonlySet<ActivityStatus> = new Set([
  'BORRADOR',
  'EN_COMPLETADO',
  'OBSERVADO',
  'CORREGIDO',
]);

export const UNIT_RAT_STATUS = [
  'PENDIENTE',
  'EN_LEVANTAMIENTO',
  'EN_REVISION',
  'CON_OBSERVACIONES',
  'COMPLETADA',
  'CERRADA',
] as const;
export type UnitRatStatus = (typeof UNIT_RAT_STATUS)[number];

export const UNIT_RAT_STATUS_LABEL: Record<UnitRatStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_LEVANTAMIENTO: 'En levantamiento',
  EN_REVISION: 'En revisión',
  CON_OBSERVACIONES: 'Con observaciones',
  COMPLETADA: 'Completada',
  CERRADA: 'Cerrada',
};

export type UnitRole = 'jefe' | 'colaborador' | 'consulta';

/** Transiciones válidas de la actividad (espejo de `workflow_transitions`). */
export const ACTIVITY_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  BORRADOR: ['EN_COMPLETADO', 'EN_REVISION'],
  EN_COMPLETADO: ['BORRADOR', 'EN_REVISION'],
  EN_REVISION: ['APROBADO', 'OBSERVADO'],
  OBSERVADO: ['CORREGIDO'],
  CORREGIDO: ['EN_REVISION'],
  APROBADO: ['OBSERVADO', 'CERRADO'],
  CERRADO: ['EN_REVISION'],
};

/** Transiciones válidas de la unidad (espejo de `unit_workflow_transitions`). */
export const UNIT_TRANSITIONS: Record<UnitRatStatus, UnitRatStatus[]> = {
  PENDIENTE: ['EN_LEVANTAMIENTO'],
  EN_LEVANTAMIENTO: ['EN_REVISION'],
  EN_REVISION: ['CON_OBSERVACIONES', 'COMPLETADA'],
  CON_OBSERVACIONES: ['EN_LEVANTAMIENTO', 'EN_REVISION'],
  COMPLETADA: ['CERRADA', 'EN_LEVANTAMIENTO'],
  CERRADA: ['EN_LEVANTAMIENTO'],
};

export const WIZARD_STEPS = [
  { n: 1, key: 'identificacion', label: 'Identificación' },
  { n: 2, key: 'finalidad', label: 'Finalidad y tratamiento' },
  { n: 3, key: 'titulares', label: 'Titulares y datos' },
  { n: 4, key: 'base_juridica', label: 'Base jurídica' },
  { n: 5, key: 'destinatarios', label: 'Destinatarios y transferencias' },
  { n: 6, key: 'conservacion', label: 'Conservación' },
  { n: 7, key: 'automatizacion', label: 'Automatización' },
  { n: 8, key: 'seguridad', label: 'Seguridad' },
  { n: 9, key: 'revision', label: 'Revisión' },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]['key'];

/** Pasos que aportan campos obligatorios (el 9 es solo resumen). */
export const WIZARD_DATA_STEPS: WizardStepKey[] = [
  'identificacion',
  'finalidad',
  'titulares',
  'base_juridica',
  'destinatarios',
  'conservacion',
  'automatizacion',
  'seguridad',
];

export const RETENTION_UNITS = ['dias', 'meses', 'anios', 'indefinido'] as const;
export type RetentionUnit = (typeof RETENTION_UNITS)[number];

export const RETENTION_UNIT_LABEL: Record<RetentionUnit, string> = {
  dias: 'días',
  meses: 'meses',
  anios: 'años',
  indefinido: 'indefinido',
};

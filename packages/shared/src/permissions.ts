/**
 * Códigos de permiso — DEBEN coincidir 1:1 con la tabla `permissions` (supabase/seed.sql).
 * El frontend los usa SOLO para pintar/ocultar (capa 1). La autorización real es
 * RLS + RPC en el backend (ver docs/Fase4a_Contrato_Autorizacion.md §2).
 */
export const PERMISSIONS = [
  'activity.read.all',
  'activity.read.own_unit',
  'activity.create',
  'activity.update.all',
  'activity.update.own_unit',
  'activity.submit',
  'activity.review',
  'activity.close',
  'activity.reopen',
  'activity.delete',
  'unit.read.all',
  'unit.manage',
  'unit.status.manage',
  'user.read',
  'user.manage',
  'role.manage',
  'config.manage',
  'import.execute',
  'export.execute',
  'audit.read',
  'audit.read.own_unit',
  'tracking.read.all',
  'tracking.read.own_unit',
  'tracking.manage',
  'institutional.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_CODES = [
  'superadmin',
  'dpd_admin',
  'auditor',
  'unit_manager',
  'collaborator',
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS: Record<RoleCode, string> = {
  superadmin: 'Superadministrador',
  dpd_admin: 'Administrador RAT / DPD',
  auditor: 'Auditor / Consulta',
  unit_manager: 'Responsable de Unidad',
  collaborator: 'Colaborador',
};

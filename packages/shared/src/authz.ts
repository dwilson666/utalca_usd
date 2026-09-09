import type { Permission } from './permissions.js';
import type { UnitRole } from './domain.js';

/** Resultado de la RPC `app.my_authz()` — lo que el frontend sabe del usuario. */
export interface MyAuthz {
  user_id: string | null;
  mfa: boolean;
  institutional: boolean;
  permissions: Permission[];
  units: Array<{
    unit_id: string;
    code: string;
    name: string;
    unit_role: UnitRole;
    includes_descendants: boolean;
  }>;
}

export const EMPTY_AUTHZ: MyAuthz = {
  user_id: null,
  mfa: false,
  institutional: false,
  permissions: [],
  units: [],
};

/** Capa 1 (UX). NUNCA es la frontera de seguridad: el backend revalida en RLS/RPC. */
export function can(authz: MyAuthz | null | undefined, perm: Permission): boolean {
  return !!authz?.mfa && !!authz?.permissions.includes(perm);
}

export function canAny(authz: MyAuthz | null | undefined, perms: Permission[]): boolean {
  return perms.some((p) => can(authz, p));
}

export function isJefeOf(authz: MyAuthz | null | undefined, unitId: string): boolean {
  return !!authz?.units.some((u) => u.unit_id === unitId && u.unit_role === 'jefe');
}

export function isMemberOf(authz: MyAuthz | null | undefined, unitId: string): boolean {
  return !!authz?.institutional || !!authz?.units.some((u) => u.unit_id === unitId);
}

/** ¿A qué "home" mandamos al usuario tras autenticarse? */
export function landingRoute(authz: MyAuthz): string {
  if (can(authz, 'institutional.view')) return '/institucional';
  const first = authz.units[0];
  return first ? `/unidad/${first.unit_id}` : '/sin-unidad';
}

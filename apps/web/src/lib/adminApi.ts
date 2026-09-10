import type { RoleCode, UnitRole } from '@rat/shared';
import { supabase } from './supabase';

// ── usuarios ────────────────────────────────────────────────────────────────
export interface AdminRoleRow {
  id: string;
  role_id: string;
  role_code: RoleCode;
  scope: 'global' | 'unit';
}
export interface AdminUnitAssignment {
  id: string;
  unit_id: string;
  unit_name: string;
  unit_role: UnitRole;
  includes_descendants: boolean;
}
export interface AdminUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  roles: AdminRoleRow[];
  assignments: AdminUnitAssignment[];
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const [profiles, roleRows, roleCatalog, assigns] = await Promise.all([
    supabase.from('profiles').select('user_id,email,full_name'),
    supabase.from('user_roles').select('id,user_id,role_id,scope').is('revoked_at', null),
    supabase.from('roles').select('id,code'),
    supabase
      .from('user_unit_assignments')
      .select('id,user_id,unit_id,unit_role,includes_descendants,organizational_units!user_unit_assignments_unit_fk(name_short)')
      .is('valid_to', null),
  ]);
  for (const r of [profiles, roleRows, roleCatalog, assigns]) if (r.error) throw r.error;

  const roleById = new Map((roleCatalog.data ?? []).map((r: any) => [r.id, r.code as RoleCode]));

  return (profiles.data ?? []).map((p: any) => ({
    user_id: p.user_id,
    email: p.email,
    full_name: p.full_name,
    roles: (roleRows.data ?? [])
      .filter((r: any) => r.user_id === p.user_id)
      .map((r: any) => ({ id: r.id, role_id: r.role_id, role_code: roleById.get(r.role_id)!, scope: r.scope })),
    assignments: (assigns.data ?? [])
      .filter((a: any) => a.user_id === p.user_id)
      .map((a: any) => ({
        id: a.id,
        unit_id: a.unit_id,
        unit_name: a.organizational_units?.name_short ?? '—',
        unit_role: a.unit_role,
        includes_descendants: a.includes_descendants,
      })),
  }));
}

export async function fetchRoleCatalog(): Promise<Array<{ id: string; code: RoleCode; name: string }>> {
  const { data, error } = await supabase.from('roles').select('id,code,name').order('code');
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; code: RoleCode; name: string }>;
}

export async function setUserRole(userId: string, roleId: string, scope: 'global' | 'unit') {
  // un rol por persona: revoca los vigentes y (re)activa el elegido
  const all = await supabase.from('user_roles').select('id,role_id,revoked_at').eq('user_id', userId);
  if (all.error) throw all.error;
  for (const r of all.data ?? []) {
    if (r.role_id !== roleId && !r.revoked_at) {
      const up = await supabase.from('user_roles').update({ revoked_at: new Date().toISOString() }).eq('id', r.id);
      if (up.error) throw up.error;
    }
  }
  const existing = (all.data ?? []).find((r: any) => r.role_id === roleId);
  if (existing) {
    const up = await supabase.from('user_roles').update({ revoked_at: null, scope }).eq('id', existing.id);
    if (up.error) throw up.error;
  } else {
    const ins = await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId, scope });
    if (ins.error) throw ins.error;
  }
}

export async function upsertUnitAssignment(input: {
  id?: string;
  user_id: string;
  unit_id: string;
  unit_role: UnitRole;
  includes_descendants: boolean;
}) {
  const patch = {
    unit_role: input.unit_role,
    includes_descendants: input.includes_descendants,
    valid_to: null as string | null,
  };
  if (input.id) {
    const { error } = await supabase.from('user_unit_assignments').update(patch).eq('id', input.id);
    if (error) throw error;
    return;
  }
  // ¿ya existe una fila (usuario, unidad), aunque esté terminada? → reactivar
  const prev = await supabase
    .from('user_unit_assignments')
    .select('id')
    .eq('user_id', input.user_id)
    .eq('unit_id', input.unit_id)
    .maybeSingle();
  if (prev.error) throw prev.error;
  if (prev.data) {
    const { error } = await supabase.from('user_unit_assignments').update(patch).eq('id', prev.data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('user_unit_assignments').insert({
      user_id: input.user_id,
      unit_id: input.unit_id,
      unit_role: input.unit_role,
      includes_descendants: input.includes_descendants,
    });
    if (error) throw error;
  }
}

export async function removeUnitAssignment(id: string) {
  const { error } = await supabase.from('user_unit_assignments').delete().eq('id', id);
  if (error) throw error;
}

// ── catálogos ───────────────────────────────────────────────────────────────
export const CATALOG_TABLES = [
  { table: 'legal_bases', label: 'Bases de licitud', flag: 'requires_reinforced', flagLabel: 'Reforzada' },
  { table: 'data_categories', label: 'Categorías de datos', flag: 'is_sensitive', flagLabel: 'Sensible' },
  { table: 'subject_categories', label: 'Categorías de titulares', flag: 'is_protected_group', flagLabel: 'Grupo protegido' },
  { table: 'recipient_types', label: 'Tipos de destinatario', flag: 'is_processor', flagLabel: 'Encargado' },
  { table: 'security_measures', label: 'Medidas de seguridad', flag: null, flagLabel: null },
  { table: 'transfer_guarantee_types', label: 'Garantías de transferencia', flag: null, flagLabel: null },
  { table: 'retention_criteria', label: 'Criterios de conservación', flag: null, flagLabel: null },
] as const;

export interface CatalogRow {
  id: string;
  code: string;
  label: string;
  description: string | null;
  status: 'active' | 'deprecated';
  sort_order: number;
  flag?: boolean;
}

export async function fetchCatalogTable(table: string, flag: string | null): Promise<CatalogRow[]> {
  const cols = `id,code,label,description,status,sort_order${flag ? ',' + flag : ''}`;
  const { data, error } = await supabase.from(table).select(cols).order('sort_order').order('label');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, flag: flag ? !!r[flag] : undefined })) as CatalogRow[];
}

export async function createCatalogItem(
  table: string,
  flag: string | null,
  input: { code: string; label: string; description: string; flag: boolean; sort_order: number },
) {
  const row: Record<string, unknown> = {
    code: input.code.trim(),
    label: input.label.trim(),
    description: input.description.trim() || null,
    sort_order: input.sort_order,
  };
  if (flag) row[flag] = input.flag;
  const { error } = await supabase.from(table).insert(row);
  if (error) throw error;
}

export async function updateCatalogItem(
  table: string,
  flag: string | null,
  id: string,
  patch: { label?: string; description?: string | null; status?: 'active' | 'deprecated'; flag?: boolean; sort_order?: number },
) {
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label.trim();
  if (patch.description !== undefined) row.description = (patch.description ?? '').trim() || null;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.sort_order !== undefined) row.sort_order = patch.sort_order;
  if (flag && patch.flag !== undefined) row[flag] = patch.flag;
  const { error } = await supabase.from(table).update(row).eq('id', id);
  if (error) throw error;
}

// ── unidades ────────────────────────────────────────────────────────────────
export interface AdminUnit {
  id: string;
  code: string;
  name_short: string;
  name_official: string;
  type: string | null;
  parent_id: string | null;
  status: string | null;
  rat_status: string;
}

export async function fetchAdminUnits(): Promise<AdminUnit[]> {
  const { data, error } = await supabase
    .from('organizational_units')
    .select('id,code,name_short,name_official,type,parent_id,status,rat_status')
    .order('name_short');
  if (error) throw error;
  return (data ?? []) as AdminUnit[];
}

export async function updateUnit(id: string, patch: { name_short?: string; name_official?: string; status?: string }) {
  const { error } = await supabase.from('organizational_units').update(patch).eq('id', id);
  if (error) throw error;
}

export async function createUnit(input: {
  code: string;
  name_short: string;
  name_official: string;
  type: string;
  parent_id: string | null;
}) {
  const { error } = await supabase.from('organizational_units').insert({
    code: input.code.trim(),
    name_short: input.name_short.trim(),
    name_official: input.name_official.trim() || input.name_short.trim(),
    type: input.type,
    parent_id: input.parent_id,
  });
  if (error) throw error;
}

import { supabase } from './supabase';

export const AUDIT_ACTIONS = [
  'login', 'login_failed', 'logout', 'mfa_enrolled',
  'create', 'update', 'delete', 'state_change', 'unit_state_change',
  'review', 'import', 'export', 'permission_grant', 'permission_revoke',
  'config_change', 'access_denied',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  create: 'Creación', update: 'Modificación', delete: 'Eliminación',
  state_change: 'Cambio de estado', unit_state_change: 'Estado de unidad',
  review: 'Revisión', import: 'Importación', export: 'Exportación',
  permission_grant: 'Permiso otorgado', permission_revoke: 'Permiso revocado',
  config_change: 'Configuración', access_denied: 'Acceso denegado',
  login: 'Inicio de sesión', login_failed: 'Inicio fallido', logout: 'Cierre de sesión',
  mfa_enrolled: 'MFA inscrito',
};

export interface AuditEntry {
  id: number;
  occurred_at: string;
  actor_email: string | null;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  unit_id: string | null;
  previous_state: string | null;
  new_state: string | null;
  changed_fields: string[] | null;
  result: string;
}

export async function fetchAudit(opts: {
  action?: string;
  entityType?: string;
  since?: string;
  limit?: number;
  before?: string;
}): Promise<AuditEntry[]> {
  let q = supabase
    .from('audit_log')
    .select('id,occurred_at,actor_email,actor_user_id,action,entity_type,entity_id,unit_id,previous_state,new_state,changed_fields,result')
    .order('occurred_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.action) q = q.eq('action', opts.action);
  if (opts.entityType) q = q.eq('entity_type', opts.entityType);
  if (opts.since) q = q.gte('occurred_at', opts.since);
  if (opts.before) q = q.lt('occurred_at', opts.before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}

export async function verifyAuditChain(): Promise<{ ok: boolean; broken_at: number | null }> {
  const { data, error } = await supabase.rpc('verify_audit_chain', { p_limit: 100000 });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: !!row?.ok, broken_at: row?.broken_at ?? null };
}

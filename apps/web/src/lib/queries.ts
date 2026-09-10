import type { ActivityStatus, UnitRatStatus } from '@rat/shared';
import { supabase } from './supabase';

/** Todas estas consultas van filtradas por RLS en el servidor: nunca devuelven
 *  información de una unidad fuera del alcance del usuario. */

export interface ActivityRow {
  id: string;
  ref_code: string;
  title: string;
  status: ActivityStatus;
  completeness_pct: number;
  responsible_unit_id: string;
  has_sensitive_data: boolean;
  has_international_transfer: boolean;
  has_automated_decision: boolean;
  updated_at: string;
}

export interface InstitutionalDashboard {
  unidades_total: number;
  unidades_con_actividades: number;
  actividades_total: number;
  por_estado: Record<string, number>;
  responsables_identificados: number;
  completitud_promedio: number;
  avance_institucional_pct: number;
  por_unidad: Array<{
    unit_id: string;
    code: string;
    name: string;
    rat_status: UnitRatStatus;
    activities: number;
    completeness_avg: number;
    contacts: number;
  }>;
}

export interface UnitDashboard {
  unit: { id: string; code: string; name: string; short: string; rat_status: UnitRatStatus };
  activities_total: number;
  by_status: Record<ActivityStatus, number>;
  completeness_avg: number;
  pending_activities: number;
  open_observations: number;
}

export async function fetchInstitutionalDashboard(): Promise<InstitutionalDashboard> {
  const { data, error } = await supabase.rpc('institutional_dashboard');
  if (error) throw error;
  return data as InstitutionalDashboard;
}

export async function fetchUnitDashboard(unitId: string): Promise<UnitDashboard> {
  const { data, error } = await supabase.rpc('unit_dashboard', { p_unit: unitId });
  if (error) throw error;
  return data as UnitDashboard;
}

export async function fetchActivities(opts: {
  unitId?: string;
  status?: ActivityStatus;
  search?: string;
  limit?: number;
}): Promise<ActivityRow[]> {
  let q = supabase
    .from('processing_activities')
    .select(
      'id,ref_code,title,status,completeness_pct,responsible_unit_id,has_sensitive_data,has_international_transfer,has_automated_decision,updated_at',
    )
    .order('updated_at', { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.unitId) q = q.eq('responsible_unit_id', opts.unitId);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.search) q = q.or(`title.ilike.%${opts.search}%,ref_code.ilike.%${opts.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

export async function fetchActivity(id: string) {
  const { data, error } = await supabase
    .from('processing_activities')
    .select(
      `*,
       responsible_unit:organizational_units!responsible_unit_id(id,code,name_official,name_short),
       data_categories:activity_data_categories(id,is_sensitive,detail,data_category:data_categories(code,label,is_sensitive)),
       subject_categories:activity_subject_categories(id,detail,subject_category:subject_categories(code,label)),
       legal_bases:activity_legal_bases(id,justification,legal_basis:legal_bases(code,label,requires_reinforced)),
       recipients:activity_recipients(id,name,is_processor,detail,recipient_type:recipient_types(code,label)),
       transfers:activity_transfers(id,country,detail),
       security_measures:activity_security_measures(id,detail,security_measure:security_measures(code,label))`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchActivityHistory(id: string) {
  const { data, error } = await supabase
    .from('activity_versions')
    .select('id,version_no,reason,created_at,created_by')
    .eq('activity_id', id)
    .order('version_no', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchOpenObservations(activityId: string) {
  const { data, error } = await supabase
    .from('review_observations')
    .select('id,field_path,severity,text,created_at,resolved_at')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface VersionDiff {
  scalar: Array<{ field: string; a: unknown; b: unknown }>;
  collections: Array<{ name: string; a: number; b: number }>;
}

const DIFF_SCALAR_FIELDS: Record<string, string> = {
  title: 'Nombre',
  purpose: 'Finalidad',
  description: 'Descripción',
  data_source: 'Origen de los datos',
  operational_owner_name: 'Responsable interno',
  retention_text: 'Conservación',
  retention_criterion_id: 'Criterio de conservación',
  has_international_transfer: 'Transferencia internacional',
  has_automated_decision: 'Decisiones automatizadas',
  uses_ai: 'Uso de IA',
  own_systems_text: 'Sistemas propios',
};

const DIFF_COLLECTIONS: Record<string, string> = {
  legal_bases: 'Bases de licitud',
  data_categories: 'Categorías de datos',
  subject_categories: 'Categorías de titulares',
  recipients: 'Destinatarios',
  transfers: 'Transferencias',
  security_measures: 'Medidas de seguridad',
  automated_decisions: 'Decisiones automatizadas',
};

/** Compara dos versiones de una actividad (usa el RPC diff_activity_versions). */
export async function fetchVersionDiff(activityId: string, a: number, b: number): Promise<VersionDiff> {
  const { data, error } = await supabase.rpc('diff_activity_versions', {
    p_activity: activityId,
    p_a: a,
    p_b: b,
  });
  if (error) throw error;
  const snap = data as { a: any; b: any };
  const actA = snap.a?.activity ?? {};
  const actB = snap.b?.activity ?? {};
  const scalar = Object.entries(DIFF_SCALAR_FIELDS)
    .filter(([f]) => JSON.stringify(actA[f] ?? null) !== JSON.stringify(actB[f] ?? null))
    .map(([field]) => ({ field: DIFF_SCALAR_FIELDS[field]!, a: actA[field], b: actB[field] }));
  const collections = Object.entries(DIFF_COLLECTIONS)
    .map(([key, name]) => ({ name, a: (snap.a?.[key] ?? []).length, b: (snap.b?.[key] ?? []).length }))
    .filter((c) => c.a !== c.b);
  return { scalar, collections };
}

export async function transitionActivity(activityId: string, to: ActivityStatus, comment?: string) {
  const { data, error } = await supabase.rpc('set_activity_status', {
    p_activity: activityId,
    p_to: to,
    p_comment: comment ?? null,
  });
  if (error) throw error;
  return data as ActivityStatus;
}

export async function transitionUnit(unitId: string, to: UnitRatStatus, comment?: string) {
  const { data, error } = await supabase.rpc('set_unit_rat_status', {
    p_unit: unitId,
    p_to: to,
    p_comment: comment ?? null,
  });
  if (error) throw error;
  return data as UnitRatStatus;
}

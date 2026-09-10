import type { ActivityStatus } from '@rat/shared';
import { supabase } from './supabase';

export interface ReviewQueueRow {
  id: string;
  ref_code: string;
  title: string;
  status: ActivityStatus;
  completeness_pct: number;
  responsible_unit_id: string;
  updated_at: string;
  unit_name: string | null;
}

export type ObservationSeverity = 'obligatoria' | 'sugerida';

export interface Observation {
  id: string;
  field_path: string;
  severity: ObservationSeverity;
  text: string;
  created_at: string;
  resolved_at: string | null;
}

/** Cola de revisión: actividades EN_REVISION visibles para el usuario (RLS filtra). */
export async function fetchReviewQueue(): Promise<ReviewQueueRow[]> {
  const { data, error } = await supabase
    .from('processing_activities')
    .select(
      'id,ref_code,title,status,completeness_pct,responsible_unit_id,updated_at,responsible_unit:organizational_units!responsible_unit_id(name_short)',
    )
    .eq('status', 'EN_REVISION')
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((a: Record<string, any>) => ({
    id: a.id,
    ref_code: a.ref_code,
    title: a.title,
    status: a.status,
    completeness_pct: a.completeness_pct,
    responsible_unit_id: a.responsible_unit_id,
    updated_at: a.updated_at,
    unit_name: a.responsible_unit?.name_short ?? null,
  }));
}

export async function fetchObservations(activityId: string): Promise<Observation[]> {
  const { data, error } = await supabase
    .from('review_observations')
    .select('id,field_path,severity,text,created_at,resolved_at')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Observation[];
}

export async function addObservation(
  activityId: string,
  field: string,
  severity: ObservationSeverity,
  text: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('review_add_observation', {
    p_activity: activityId,
    p_field: field,
    p_severity: severity,
    p_text: text,
  });
  if (error) throw error;
  return data as string;
}

export async function resolveObservation(obsId: string, resolved: boolean): Promise<void> {
  const { error } = await supabase.rpc('review_resolve_observation', {
    p_obs: obsId,
    p_resolved: resolved,
  });
  if (error) throw error;
}

export async function decideReview(
  activityId: string,
  outcome: 'approved' | 'observed',
  summary?: string,
): Promise<ActivityStatus> {
  const { data, error } = await supabase.rpc('review_decide', {
    p_activity: activityId,
    p_outcome: outcome,
    p_summary: summary ?? null,
  });
  if (error) throw error;
  return data as ActivityStatus;
}

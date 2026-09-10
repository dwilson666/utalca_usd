import { ACTIVITY_STATUS_LABEL, type ActivityStatus } from '@rat/shared';
import { supabase } from './supabase';

export interface ExportActivity {
  id: string;
  ref_code: string;
  title: string;
  status: ActivityStatus;
  completeness_pct: number;
  purpose: string | null;
  description: string | null;
  data_source: string | null;
  operational_owner_name: string | null;
  retention_text: string | null;
  has_sensitive_data: boolean;
  has_international_transfer: boolean;
  has_automated_decision: boolean;
  uses_ai: boolean;
  updated_at: string;
  responsible_unit: { name_short: string; name_official: string } | null;
  data_categories: Array<{ is_sensitive: boolean; data_category: { label: string } | null }>;
  subject_categories: Array<{ subject_category: { label: string } | null }>;
  legal_bases: Array<{ legal_basis: { label: string; requires_reinforced: boolean } | null }>;
  recipients: Array<{ name: string | null; recipient_type: { label: string } | null }>;
  transfers: Array<{ country: string }>;
  security_measures: Array<{ security_measure: { label: string } | null }>;
}

const SELECT = `
  id,ref_code,title,status,completeness_pct,purpose,description,data_source,
  operational_owner_name,retention_text,has_sensitive_data,has_international_transfer,
  has_automated_decision,uses_ai,updated_at,
  responsible_unit:organizational_units!responsible_unit_id(name_short,name_official),
  data_categories:activity_data_categories(is_sensitive,data_category:data_categories(label)),
  subject_categories:activity_subject_categories(subject_category:subject_categories(label)),
  legal_bases:activity_legal_bases(legal_basis:legal_bases(label,requires_reinforced)),
  recipients:activity_recipients(name,recipient_type:recipient_types(label)),
  transfers:activity_transfers(country),
  security_measures:activity_security_measures(security_measure:security_measures(label))`;

/** Actividades para exportar. RLS filtra por alcance del usuario; `unitId` acota más. */
export async function fetchActivitiesForExport(unitId?: string): Promise<ExportActivity[]> {
  let q = supabase.from('processing_activities').select(SELECT).order('ref_code');
  if (unitId) q = q.eq('responsible_unit_id', unitId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ExportActivity[];
}

const list = (xs: Array<string | null | undefined>) => xs.filter(Boolean).join(' · ');

export function activityToRow(a: ExportActivity): Record<string, string | number> {
  return {
    'Código': a.ref_code,
    'Actividad': a.title,
    'Unidad responsable': a.responsible_unit?.name_official ?? '',
    'Responsable interno': a.operational_owner_name ?? '',
    'Estado': ACTIVITY_STATUS_LABEL[a.status],
    'Completitud %': a.completeness_pct,
    'Finalidad': a.purpose ?? '',
    'Descripción del proceso': a.description ?? '',
    'Origen de los datos': a.data_source ?? '',
    'Categorías de titulares': list(a.subject_categories.map((x) => x.subject_category?.label)),
    'Categorías de datos': list(a.data_categories.map((x) => x.data_category?.label)),
    'Datos sensibles': a.has_sensitive_data ? 'Sí' : 'No',
    'Bases de licitud': list(a.legal_bases.map((x) => x.legal_basis?.label)),
    'Base reforzada': a.legal_bases.some((x) => x.legal_basis?.requires_reinforced) ? 'Sí' : 'No',
    'Destinatarios': list(a.recipients.map((x) => x.name || x.recipient_type?.label)),
    'Transferencia internacional': a.has_international_transfer ? 'Sí' : 'No',
    'Países de transferencia': list(a.transfers.map((x) => x.country)),
    'Conservación': a.retention_text ?? '',
    'Medidas de seguridad': list(a.security_measures.map((x) => x.security_measure?.label)),
    'Decisiones automatizadas': a.has_automated_decision ? 'Sí' : 'No',
    'Uso de IA': a.uses_ai ? 'Sí' : 'No',
    'Última modificación': new Date(a.updated_at).toLocaleDateString('es-CL'),
  };
}

/** Genera y descarga un .xlsx (una fila por actividad). xlsx se carga perezoso. */
export async function downloadXlsx(activities: ExportActivity[], filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const rows = activities.map(activityToRow);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.min(48, Math.max(12, k.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RAT');
  XLSX.writeFile(wb, filename);
}

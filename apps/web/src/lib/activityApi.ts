import {
  EMPTY_WIZARD_DRAFT,
  type ActivityStatus,
  type WizardDraft,
  type WizardStepKey,
} from '@rat/shared';
import type { Catalogs } from './catalogs';
import { supabase } from './supabase';

export interface ActivityMeta {
  id: string;
  ref_code: string;
  status: ActivityStatus;
  responsible_unit_id: string | null;
  completeness_pct: number;
  updated_at: string;
  unit_name?: string | null;
}

export interface LoadedActivity {
  meta: ActivityMeta;
  draft: WizardDraft;
}

// ── crear borrador ──────────────────────────────────────────────────────────
export async function createDraftActivity(input: {
  title: string;
  responsible_unit_id: string;
  operational_owner_name?: string;
}): Promise<ActivityMeta> {
  const { data, error } = await supabase
    .from('processing_activities')
    .insert({
      title: input.title.trim(),
      responsible_unit_id: input.responsible_unit_id,
      operational_owner_name: input.operational_owner_name?.trim() || null,
      status: 'BORRADOR',
    })
    .select('id,ref_code,status,responsible_unit_id,completeness_pct,updated_at')
    .single();
  if (error) throw error;
  return data as ActivityMeta;
}

// ── cargar borrador ─────────────────────────────────────────────────────────
export async function loadActivity(id: string): Promise<LoadedActivity> {
  const { data, error } = await supabase
    .from('processing_activities')
    .select(
      `id,ref_code,status,responsible_unit_id,completeness_pct,updated_at,
       title,operational_owner_name,purpose,description,data_source,
       retention_criterion_id,retention_value,retention_unit,retention_text,
       has_automated_decision,uses_ai,own_systems_text,has_international_transfer,
       responsible_unit:organizational_units!responsible_unit_id(name_short),
       subject_categories:activity_subject_categories(subject_category_id),
       data_categories:activity_data_categories(data_category_id),
       legal_bases:activity_legal_bases(legal_basis_id,justification),
       recipients:activity_recipients(recipient_type_id,name,is_processor,detail),
       transfers:activity_transfers(country,guarantee_type_id,detail),
       security_measures:activity_security_measures(security_measure_id),
       automated_decisions:activity_automated_decisions(description,stage,human_in_the_loop,produces_profiling)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('NOT_FOUND');
  const a = data as Record<string, any>;

  const draft: WizardDraft = {
    ...EMPTY_WIZARD_DRAFT,
    title: a.title ?? '',
    responsible_unit_id: a.responsible_unit_id ?? null,
    operational_owner_name: a.operational_owner_name ?? '',
    purpose: a.purpose ?? '',
    description: a.description ?? '',
    data_source: a.data_source ?? '',
    subject_category_ids: (a.subject_categories ?? []).map((x: any) => x.subject_category_id),
    data_category_ids: (a.data_categories ?? []).map((x: any) => x.data_category_id),
    legal_bases: (a.legal_bases ?? []).map((x: any) => ({
      legal_basis_id: x.legal_basis_id,
      justification: x.justification ?? '',
    })),
    recipients: (a.recipients ?? []).map((x: any) => ({
      recipient_type_id: x.recipient_type_id,
      name: x.name ?? '',
      is_processor: !!x.is_processor,
      detail: x.detail ?? '',
    })),
    transfers: (a.transfers ?? []).map((x: any) => ({
      country: x.country ?? '',
      guarantee_type_id: x.guarantee_type_id ?? undefined,
      detail: x.detail ?? '',
    })),
    retention_criterion_id: a.retention_criterion_id ?? null,
    retention_value: a.retention_value ?? null,
    retention_unit: a.retention_unit ?? null,
    retention_text: a.retention_text ?? '',
    has_automated_decision: !!a.has_automated_decision,
    uses_ai: !!a.uses_ai,
    automated_decisions: (a.automated_decisions ?? []).map((x: any) => ({
      description: x.description ?? '',
      stage: x.stage ?? '',
      human_in_the_loop: x.human_in_the_loop ?? true,
      produces_profiling: !!x.produces_profiling,
    })),
    own_systems_text: a.own_systems_text ?? '',
    security_measure_ids: (a.security_measures ?? []).map((x: any) => x.security_measure_id),
  };

  return {
    meta: {
      id: a.id,
      ref_code: a.ref_code,
      status: a.status,
      responsible_unit_id: a.responsible_unit_id,
      completeness_pct: a.completeness_pct,
      updated_at: a.updated_at,
      unit_name: a.responsible_unit?.name_short ?? null,
    },
    draft,
  };
}

// ── guardar un paso ─────────────────────────────────────────────────────────
async function patchCore(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('processing_activities').update(patch).eq('id', id);
  if (error) throw error;
}

async function replaceChildren(
  id: string,
  table: string,
  rows: Array<Record<string, unknown>>,
) {
  const del = await supabase.from(table).delete().eq('activity_id', id);
  if (del.error) throw del.error;
  if (rows.length) {
    const ins = await supabase
      .from(table)
      .insert(rows.map((r) => ({ ...r, activity_id: id })));
    if (ins.error) throw ins.error;
  }
}

/** Persiste SOLO lo que toca el paso indicado. El resto del borrador no se envía. */
export async function saveStep(
  id: string,
  step: WizardStepKey,
  d: WizardDraft,
  catalogs: Catalogs,
): Promise<void> {
  const sensitive = new Set(catalogs.dataCategories.filter((c) => c.is_sensitive).map((c) => c.id));
  const protectedSubj = new Set(
    catalogs.subjectCategories.filter((c) => c.is_protected_group).map((c) => c.id),
  );

  switch (step) {
    case 'identificacion':
      await patchCore(id, {
        title: d.title.trim(),
        responsible_unit_id: d.responsible_unit_id,
        operational_owner_name: d.operational_owner_name.trim() || null,
      });
      break;
    case 'finalidad':
      await patchCore(id, {
        purpose: d.purpose.trim() || null,
        description: d.description.trim() || null,
        data_source: d.data_source.trim() || null,
      });
      break;
    case 'titulares':
      await replaceChildren(
        id,
        'activity_subject_categories',
        d.subject_category_ids.map((sid) => ({
          subject_category_id: sid,
          is_protected_group: protectedSubj.has(sid),
        })),
      );
      await replaceChildren(
        id,
        'activity_data_categories',
        d.data_category_ids.map((did) => ({
          data_category_id: did,
          is_sensitive: sensitive.has(did),
        })),
      );
      break;
    case 'base_juridica':
      await replaceChildren(
        id,
        'activity_legal_bases',
        d.legal_bases.map((b) => ({
          legal_basis_id: b.legal_basis_id,
          justification: b.justification?.trim() || null,
        })),
      );
      break;
    case 'destinatarios':
      await replaceChildren(
        id,
        'activity_recipients',
        d.recipients.map((r) => ({
          recipient_type_id: r.recipient_type_id,
          name: r.name?.trim() || null,
          is_processor: r.is_processor,
          detail: r.detail?.trim() || null,
        })),
      );
      await replaceChildren(
        id,
        'activity_transfers',
        d.transfers.map((t) => ({
          country: t.country.trim(),
          guarantee_type_id: t.guarantee_type_id ?? null,
          detail: t.detail?.trim() || null,
        })),
      );
      await patchCore(id, { has_international_transfer: d.transfers.length > 0 });
      break;
    case 'conservacion':
      await patchCore(id, {
        retention_criterion_id: d.retention_criterion_id,
        retention_value: d.retention_value ?? null,
        retention_unit: d.retention_unit ?? null,
        retention_text: d.retention_text.trim() || null,
      });
      break;
    case 'automatizacion':
      await replaceChildren(
        id,
        'activity_automated_decisions',
        d.has_automated_decision
          ? d.automated_decisions.map((x) => ({
              description: x.description.trim(),
              stage: x.stage?.trim() || null,
              human_in_the_loop: x.human_in_the_loop,
              produces_profiling: x.produces_profiling,
            }))
          : [],
      );
      await patchCore(id, {
        has_automated_decision: d.has_automated_decision,
        uses_ai: d.uses_ai,
        own_systems_text: d.own_systems_text.trim() || null,
      });
      break;
    case 'seguridad':
      await replaceChildren(
        id,
        'activity_security_measures',
        d.security_measure_ids.map((mid) => ({ security_measure_id: mid })),
      );
      break;
    case 'revision':
      break;
  }
}

/** Guarda todos los pasos de datos (para "Guardar borrador" global). */
export async function saveAllSteps(id: string, d: WizardDraft, catalogs: Catalogs) {
  const steps: WizardStepKey[] = [
    'identificacion',
    'finalidad',
    'titulares',
    'base_juridica',
    'destinatarios',
    'conservacion',
    'automatizacion',
    'seguridad',
  ];
  for (const s of steps) await saveStep(id, s, d, catalogs);
}

export async function refreshMeta(id: string): Promise<ActivityMeta> {
  const { data, error } = await supabase
    .from('processing_activities')
    .select('id,ref_code,status,responsible_unit_id,completeness_pct,updated_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as ActivityMeta;
}

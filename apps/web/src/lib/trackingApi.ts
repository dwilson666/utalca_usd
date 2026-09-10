import type { EngagementStage } from '@rat/shared';
import { supabase } from './supabase';

export interface EngagementRow {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  parent_id: string | null;
  stage: EngagementStage;
  contacted_on: string | null;
  meeting_on: string | null;
  owner_user_id: string | null;
  pending_items: string | null;
  notes: string | null;
  contacts: number;
  activities: number;
}

export interface Contact {
  id: string;
  unit_id: string;
  full_name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

/** Panorama de seguimiento de todas las unidades (RLS: tracking.read.all). */
export async function fetchTracking(): Promise<EngagementRow[]> {
  const [units, engagements, contacts, activities] = await Promise.all([
    supabase
      .from('organizational_units')
      .select('id,code,name_short,parent_id,is_rat_unit,status,deferred')
      .eq('status', 'active'),
    supabase.from('unit_engagements').select('*'),
    supabase.from('engagement_contacts').select('unit_id'),
    supabase.from('processing_activities').select('responsible_unit_id'),
  ]);
  for (const r of [units, engagements, contacts, activities]) if (r.error) throw r.error;

  const engByUnit = new Map((engagements.data ?? []).map((e: any) => [e.unit_id, e]));
  const contactCount = new Map<string, number>();
  for (const c of contacts.data ?? []) contactCount.set(c.unit_id, (contactCount.get(c.unit_id) ?? 0) + 1);
  const actCount = new Map<string, number>();
  for (const a of activities.data ?? [])
    actCount.set(a.responsible_unit_id, (actCount.get(a.responsible_unit_id) ?? 0) + 1);

  return (units.data ?? [])
    .filter((u: any) => u.is_rat_unit && !u.deferred && u.parent_id)
    .map((u: any) => {
      const e = engByUnit.get(u.id);
      return {
        unit_id: u.id,
        unit_code: u.code,
        unit_name: u.name_short,
        parent_id: u.parent_id,
        stage: (e?.stage ?? 'no_contactada') as EngagementStage,
        contacted_on: e?.contacted_on ?? null,
        meeting_on: e?.meeting_on ?? null,
        owner_user_id: e?.owner_user_id ?? null,
        pending_items: e?.pending_items ?? null,
        notes: e?.notes ?? null,
        contacts: contactCount.get(u.id) ?? 0,
        activities: actCount.get(u.id) ?? 0,
      };
    })
    .sort((a, b) => a.unit_name.localeCompare(b.unit_name));
}

export async function saveEngagement(
  unitId: string,
  patch: Partial<Pick<EngagementRow, 'stage' | 'contacted_on' | 'meeting_on' | 'pending_items' | 'notes'>>,
): Promise<void> {
  const { error } = await supabase
    .from('unit_engagements')
    .upsert(
      { unit_id: unitId, ...patch, last_update_at: new Date().toISOString() },
      { onConflict: 'unit_id' },
    );
  if (error) throw error;
}

export async function fetchContacts(unitId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('engagement_contacts')
    .select('id,unit_id,full_name,position,email,phone,notes')
    .eq('unit_id', unitId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function saveContact(input: Omit<Contact, 'id'> & { id?: string }): Promise<void> {
  const row = {
    unit_id: input.unit_id,
    full_name: input.full_name.trim(),
    position: input.position?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  if (input.id) {
    const { error } = await supabase.from('engagement_contacts').update(row).eq('id', input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('engagement_contacts').insert(row);
    if (error) throw error;
  }
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('engagement_contacts').delete().eq('id', id);
  if (error) throw error;
}

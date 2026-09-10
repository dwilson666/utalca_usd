import { useQuery } from '@tanstack/react-query';
import type { MyAuthz } from '@rat/shared';
import { supabase } from './supabase';

export interface UnitOption {
  id: string;
  code: string;
  name_short: string;
  name_official: string;
  type: string | null;
  parent_id: string | null;
}

export async function fetchUnits(): Promise<UnitOption[]> {
  const { data, error } = await supabase
    .from('organizational_units')
    .select('id,code,name_short,name_official,type,parent_id')
    .order('name_short', { ascending: true });
  if (error) throw error;
  return (data ?? []) as UnitOption[];
}

export function useUnits() {
  return useQuery({ queryKey: ['units', 'flat'], queryFn: fetchUnits, staleTime: 10 * 60_000 });
}

/**
 * Unidades donde el usuario puede REGISTRAR una actividad:
 *  - rol institucional (`activity.update.all`) → cualquier unidad
 *  - resto → solo sus unidades asignadas
 * Es un filtro de UX; el backend (RLS `pa_ins`) revalida.
 */
export function selectableUnitsFor(authz: MyAuthz, all: UnitOption[]): UnitOption[] {
  if (authz.institutional || authz.permissions.includes('activity.update.all')) return all;
  const mine = new Set(authz.units.map((u) => u.unit_id));
  return all.filter((u) => mine.has(u.id));
}

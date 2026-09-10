import { supabase } from './supabase';
import type { UnitOption } from './units';

export type ImportKind = 'contact' | 'activity_seed';

export interface ParsedFile {
  sheet: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

/** Parseo perezoso: xlsx solo se carga al entrar en la importación. */
export async function parseSpreadsheet(file: File): Promise<ParsedFile[]> {
  const XLSX = await import('xlsx');
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  // CSV: leer como texto UTF-8 (evita que los acentos se rompan por codepage).
  const src = isCsv ? await file.text() : await file.arrayBuffer();
  const wb = XLSX.read(src, isCsv ? { type: 'string' } : { type: 'array' });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]!;
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    const headers = json.length ? Object.keys(json[0]!) : [];
    return { sheet: name, headers, rows: json };
  }).filter((s) => s.rows.length > 0);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Empareja el valor de una celda "unidad" con una unidad canónica. */
export function resolveUnit(value: unknown, units: UnitOption[]): string | null {
  const v = norm(String(value ?? ''));
  if (!v) return null;
  const exact = units.find((u) => norm(u.name_short) === v || norm(u.name_official) === v || norm(u.code) === v);
  if (exact) return exact.id;
  const partial = units.find((u) => norm(u.name_official).includes(v) || v.includes(norm(u.name_short)));
  return partial?.id ?? null;
}

/** Adivina qué campo destino corresponde a cada columna de origen. */
export function guessMapping(headers: string[], kind: ImportKind): Record<string, string> {
  const targets: Record<string, string[]> =
    kind === 'contact'
      ? { full_name: ['nombre', 'contacto', 'responsable', 'persona'], position: ['cargo', 'rol', 'puesto'], email: ['correo', 'email', 'mail'], phone: ['telefono', 'fono', 'celular', 'anexo'], unidad: ['unidad', 'direccion', 'area', 'departamento'], notes: ['nota', 'observ', 'comentario'] }
      : { title: ['actividad', 'nombre', 'titulo', 'proceso', 'tratamiento'], description: ['descripcion', 'detalle', 'finalidad'], unidad: ['unidad', 'direccion', 'area', 'departamento'], notes: ['nota', 'observ', 'comentario'] };
  const out: Record<string, string> = {};
  for (const h of headers) {
    const n = norm(h);
    for (const [field, keys] of Object.entries(targets)) {
      if (keys.some((k) => n.includes(k))) { out[h] = field; break; }
    }
  }
  return out;
}

export interface StagedRow {
  source_row_no: number;
  raw: Record<string, unknown>;
  mapped: Record<string, string>;
  resolved_unit_id: string | null;
  include: boolean;
}

/** Crea el lote, guarda las filas en staging y ejecuta el commit (crea contactos
 *  y BORRADORES; NUNCA publica un RAT). */
export async function runImport(input: {
  filename: string;
  sheet: string;
  kind: ImportKind;
  rows: StagedRow[];
}): Promise<{ contacts_created: number; activity_drafts_created: number }> {
  const batch = await supabase
    .from('import_batches')
    .insert({
      source_filename: input.filename,
      sheet_names: [input.sheet],
      uploaded_by: (await supabase.auth.getUser()).data.user?.id,
      status: 'previewed',
    })
    .select('id')
    .single();
  if (batch.error) throw batch.error;
  const batchId = batch.data.id as string;

  const staging = input.rows.map((r) => ({
    batch_id: batchId,
    sheet: input.sheet,
    source_row_no: r.source_row_no,
    raw: r.raw,
    mapped: r.mapped,
    classification: r.include && r.resolved_unit_id ? input.kind : 'empty',
    validation: r.include && r.resolved_unit_id ? 'valid' : 'discarded',
    resolved_unit_id: r.resolved_unit_id,
  }));
  const ins = await supabase.from('import_rows_staging').insert(staging);
  if (ins.error) throw ins.error;

  const { data, error } = await supabase.rpc('import_commit', { p_batch: batchId });
  if (error) throw error;
  return data as { contacts_created: number; activity_drafts_created: number };
}

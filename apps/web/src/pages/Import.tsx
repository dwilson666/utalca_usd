import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useUnits } from '../lib/units';
import {
  guessMapping,
  parseSpreadsheet,
  resolveUnit,
  runImport,
  type ImportKind,
  type ParsedFile,
  type StagedRow,
} from '../lib/importApi';
import { PageHeader } from '../components/ui';

const FIELDS: Record<ImportKind, Array<{ key: string; label: string; required?: boolean }>> = {
  contact: [
    { key: 'full_name', label: 'Nombre', required: true },
    { key: 'position', label: 'Cargo' },
    { key: 'email', label: 'Correo' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'notes', label: 'Notas' },
    { key: 'unidad', label: 'Unidad (texto)', required: true },
  ],
  activity_seed: [
    { key: 'title', label: 'Nombre de la actividad', required: true },
    { key: 'description', label: 'Descripción' },
    { key: 'notes', label: 'Notas' },
    { key: 'unidad', label: 'Unidad (texto)', required: true },
  ],
};

export function ImportPage() {
  const unitsQ = useUnits();
  const units = unitsQ.data ?? [];
  const [kind, setKind] = useState<ImportKind>('contact');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [filename, setFilename] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<StagedRow[]>([]);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ contacts_created: number; activity_drafts_created: number } | null>(null);

  async function onFile(file: File) {
    setParseErr(null); setResult(null);
    try {
      const sheets = await parseSpreadsheet(file);
      const s = sheets[0];
      if (!s) throw new Error('El archivo no tiene filas.');
      setFilename(file.name);
      setParsed(s);
      const g = guessMapping(s.headers, kind);
      setMapping(g);
      rebuildRows(s, g);
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    }
  }

  function rebuildRows(s: ParsedFile, m: Record<string, string>) {
    const unitCol = Object.entries(m).find(([, f]) => f === 'unidad')?.[0];
    setRows(
      s.rows.map((raw, i) => {
        const mapped: Record<string, string> = {};
        for (const [col, field] of Object.entries(m)) {
          if (field && field !== 'unidad') mapped[field] = String(raw[col] ?? '').trim();
        }
        const unitVal = unitCol ? raw[unitCol] : '';
        return {
          source_row_no: i + 2,
          raw,
          mapped,
          resolved_unit_id: resolveUnit(unitVal, units),
          include: true,
        };
      }),
    );
  }

  function setColMap(col: string, field: string) {
    const m = { ...mapping, [col]: field };
    setMapping(m);
    if (parsed) rebuildRows(parsed, m);
  }

  const importMut = useMutation({
    mutationFn: () => runImport({ filename, sheet: parsed!.sheet, kind, rows }),
    onSuccess: (r) => { setResult(r); setParsed(null); setRows([]); },
  });

  const okRows = useMemo(() => rows.filter((r) => r.include && r.resolved_unit_id).length, [rows]);
  const unresolved = useMemo(() => rows.filter((r) => r.include && !r.resolved_unit_id).length, [rows]);

  return (
    <>
      <PageHeader
        eyebrow="Importación"
        title="Importar desde planilla"
        sub="Crea contactos de seguimiento y BORRADORES de actividad para curación. Nunca publica un RAT."
      />

      <div className="callout" style={{ marginBottom: 16, fontSize: 12.5 }}>
        La importación de actividades genera <b>borradores en estado BORRADOR</b>. Cada uno debe
        completarse y enviarse a revisión con el asistente RAT; la importación por sí sola no
        registra ni aprueba nada.
      </div>

      {result && (
        <div className="callout" style={{ marginBottom: 16 }}>
          Importación completada: <b>{result.contacts_created}</b> contacto(s) y{' '}
          <b>{result.activity_drafts_created}</b> borrador(es) de actividad creados.{' '}
          <Link to={kind === 'contact' ? '/seguimiento' : '/actividades'}>Ver resultado →</Link>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__b" style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tipo de datos</span>
            <select value={kind} onChange={(e) => { setKind(e.target.value as ImportKind); setParsed(null); setRows([]); }}>
              <option value="contact">Contactos de seguimiento</option>
              <option value="activity_seed">Actividades (a borrador)</option>
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Archivo (.xlsx / .csv)</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        </div>
        {parseErr && <div className="callout callout--crit" style={{ margin: '0 16px 16px' }}>{parseErr}</div>}
      </div>

      {parsed && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card__h"><h3>Correspondencia de columnas</h3></div>
            <div className="card__b" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))' }}>
              {parsed.headers.map((h) => (
                <label key={h} style={{ fontSize: 12 }}>
                  <span className="mono" style={{ display: 'block', marginBottom: 3 }}>{h}</span>
                  <select value={mapping[h] ?? ''} onChange={(e) => setColMap(h, e.target.value)} style={{ width: '100%' }}>
                    <option value="">— ignorar —</option>
                    {FIELDS[kind].map((f) => (
                      <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="pill pill--success">{okRows} listas</span>
            {unresolved > 0 && <span className="pill pill--warning">{unresolved} sin unidad resuelta</span>}
            <span style={{ flex: 1 }} />
            <button
              className="btn btn--primary"
              disabled={okRows === 0 || importMut.isPending}
              onClick={() => importMut.mutate()}
            >
              {importMut.isPending ? 'Importando…' : `Importar ${okRows} fila(s)`}
            </button>
          </div>
          {importMut.error && (
            <div className="callout callout--crit" style={{ marginBottom: 12 }}>
              {(importMut.error as Error).message}
            </div>
          )}

          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Incluir</th>
                  {FIELDS[kind].filter((f) => f.key !== 'unidad').map((f) => <th key={f.key}>{f.label}</th>)}
                  <th>Unidad resuelta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={!r.include ? { opacity: 0.4 } : undefined}>
                    <td className="mono">{r.source_row_no}</td>
                    <td>
                      <input type="checkbox" checked={r.include} style={{ width: 'auto' }}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
                    </td>
                    {FIELDS[kind].filter((f) => f.key !== 'unidad').map((f) => (
                      <td key={f.key} style={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.mapped[f.key] || <span className="muted">—</span>}
                      </td>
                    ))}
                    <td>
                      <select
                        value={r.resolved_unit_id ?? ''}
                        style={{ borderColor: r.include && !r.resolved_unit_id ? 'var(--critical)' : undefined, maxWidth: 200 }}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, resolved_unit_id: e.target.value || null } : x)))}
                      >
                        <option value="">— sin resolver —</option>
                        {units.map((u) => <option key={u.id} value={u.id}>{u.name_short}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

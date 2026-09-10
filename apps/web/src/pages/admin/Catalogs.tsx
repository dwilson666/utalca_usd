import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CATALOG_TABLES,
  createCatalogItem,
  fetchCatalogTable,
  updateCatalogItem,
  type CatalogRow,
} from '../../lib/adminApi';
import { PageHeader, QueryState } from '../../components/ui';

export function AdminCatalogs() {
  const [tab, setTab] = useState(0);
  const cfg = CATALOG_TABLES[tab]!;
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['admin', 'catalog', cfg.table],
    queryFn: () => fetchCatalogTable(cfg.table, cfg.flag),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', cfg.table] });

  const updateMut = useMutation({
    mutationFn: (v: { id: string; patch: Parameters<typeof updateCatalogItem>[3] }) =>
      updateCatalogItem(cfg.table, cfg.flag, v.id, v.patch),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo guardar.'),
  });
  const createMut = useMutation({
    mutationFn: (v: Parameters<typeof createCatalogItem>[2]) => createCatalogItem(cfg.table, cfg.flag, v),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo crear.'),
  });

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Catálogos"
        sub="Vocabularios controlados de la Ley 21.719. Los valores en uso no se borran: se desactivan."
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {CATALOG_TABLES.map((c, i) => (
          <button
            key={c.table}
            className={`btn${i === tab ? ' btn--primary' : ''}`}
            style={{ fontSize: 12 }}
            onClick={() => { setTab(i); setErr(null); }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {err && <div className="callout callout--crit" style={{ marginBottom: 12 }}>{err}</div>}

      <QueryState isLoading={q.isLoading} error={q.error}>
        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr>
                <th>Código</th>
                <th>Etiqueta</th>
                <th>Descripción</th>
                {cfg.flag && <th>{cfg.flagLabel}</th>}
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((row) => (
                <CatalogRowEditor
                  key={row.id}
                  row={row}
                  hasFlag={!!cfg.flag}
                  flagLabel={cfg.flagLabel}
                  busy={updateMut.isPending}
                  onSave={(patch) => { setErr(null); updateMut.mutate({ id: row.id, patch }); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>

      <NewItem
        hasFlag={!!cfg.flag}
        flagLabel={cfg.flagLabel}
        nextOrder={((q.data ?? []).reduce((m, r) => Math.max(m, r.sort_order), 0) || 0) + 1}
        busy={createMut.isPending}
        onCreate={(v) => { setErr(null); createMut.mutate(v); }}
      />
    </>
  );
}

function CatalogRowEditor({
  row,
  hasFlag,
  flagLabel,
  busy,
  onSave,
}: {
  row: CatalogRow;
  hasFlag: boolean;
  flagLabel: string | null;
  busy: boolean;
  onSave: (patch: { label?: string; description?: string | null; status?: 'active' | 'deprecated'; flag?: boolean }) => void;
}) {
  const [label, setLabel] = useState(row.label);
  const [desc, setDesc] = useState(row.description ?? '');
  const dirty = label !== row.label || desc !== (row.description ?? '');
  const deprecated = row.status === 'deprecated';

  return (
    <tr style={deprecated ? { opacity: 0.55 } : undefined}>
      <td className="mono" style={{ fontSize: 12 }}>{row.code}</td>
      <td><input value={label} onChange={(e) => setLabel(e.target.value)} style={{ minWidth: 160 }} /></td>
      <td><input value={desc} onChange={(e) => setDesc(e.target.value)} style={{ minWidth: 200 }} /></td>
      {hasFlag && (
        <td>
          <input type="checkbox" checked={!!row.flag} disabled={busy}
            onChange={(e) => onSave({ flag: e.target.checked })} style={{ width: 'auto' }} />
        </td>
      )}
      <td>
        <span className={`pill ${deprecated ? 'pill--neutral' : 'pill--success'}`}>
          {deprecated ? 'Desactivado' : 'Activo'}
        </span>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {dirty && (
          <button className="btn btn--primary" style={{ fontSize: 12, padding: '3px 8px', marginRight: 6 }}
            disabled={busy} onClick={() => onSave({ label, description: desc })}>
            Guardar
          </button>
        )}
        <button className="btn btn--ghost" style={{ fontSize: 12, padding: '3px 8px' }} disabled={busy}
          onClick={() => onSave({ status: deprecated ? 'active' : 'deprecated' })}>
          {deprecated ? 'Reactivar' : 'Desactivar'}
        </button>
      </td>
    </tr>
  );
}

function NewItem({
  hasFlag,
  flagLabel,
  nextOrder,
  busy,
  onCreate,
}: {
  hasFlag: boolean;
  flagLabel: string | null;
  nextOrder: number;
  busy: boolean;
  onCreate: (v: { code: string; label: string; description: string; flag: boolean; sort_order: number }) => void;
}) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [flag, setFlag] = useState(false);
  const ok = /^[a-z0-9_]{2,}$/.test(code) && label.trim().length >= 2;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card__h"><h3>Agregar valor</h3></div>
      <div className="card__b" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Código</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} placeholder="minusculas_guionbajo" />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
          <label>Etiqueta</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
          <label>Descripción</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        {hasFlag && (
          <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', paddingBottom: 8 }}>
            <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} style={{ width: 'auto' }} />
            {flagLabel}
          </label>
        )}
        <button
          className="btn btn--primary"
          disabled={!ok || busy}
          onClick={() => { onCreate({ code: code.trim(), label, description: desc, flag, sort_order: nextOrder }); setCode(''); setLabel(''); setDesc(''); setFlag(false); }}
        >
          Agregar
        </button>
      </div>
    </div>
  );
}

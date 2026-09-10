import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createUnit,
  fetchAdminUnits,
  updateUnit,
  type AdminUnit,
} from '../../lib/adminApi';
import { PageHeader, QueryState } from '../../components/ui';

const UNIT_TYPES = ['rectoria', 'vicerrectoria', 'direccion', 'departamento', 'unidad', 'contraloria', 'otro'];

export function AdminUnits() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'units'], queryFn: fetchAdminUnits });
  const [err, setErr] = useState<string | null>(null);
  const [addUnder, setAddUnder] = useState<string | null>(null);
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'units'] });
    void qc.invalidateQueries({ queryKey: ['units'] });
  };

  const updateMut = useMutation({
    mutationFn: (v: { id: string; patch: Parameters<typeof updateUnit>[1] }) => updateUnit(v.id, v.patch),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo guardar.'),
  });
  const createMut = useMutation({
    mutationFn: createUnit,
    onSuccess: () => { invalidate(); setAddUnder(null); },
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo crear la unidad.'),
  });

  const byParent = useMemo(() => {
    const m = new Map<string | null, AdminUnit[]>();
    for (const u of q.data ?? []) {
      const k = u.parent_id;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(u);
    }
    for (const list of m.values()) list.sort((a, b) => a.name_short.localeCompare(b.name_short));
    return m;
  }, [q.data]);

  const needsReview = (q.data ?? []).filter((u) => u.status === 'needs_review');

  function renderTree(parentId: string | null, depth: number): React.ReactNode {
    return (byParent.get(parentId) ?? []).map((u) => (
      <div key={u.id}>
        <UnitRow
          u={u}
          depth={depth}
          busy={updateMut.isPending}
          onSave={(patch) => { setErr(null); updateMut.mutate({ id: u.id, patch }); }}
          onAddChild={() => setAddUnder(u.id)}
        />
        {addUnder === u.id && (
          <NewUnitForm parentName={u.name_short} busy={createMut.isPending}
            onCancel={() => setAddUnder(null)}
            onCreate={(v) => { setErr(null); createMut.mutate({ ...v, parent_id: u.id }); }} />
        )}
        {renderTree(u.id, depth + 1)}
      </div>
    ));
  }

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Unidades"
        sub="Árbol organizacional. La reasignación de unidad padre se gestiona con la Dirección de Comunicaciones."
      />

      {needsReview.length > 0 && (
        <div className="callout callout--warn" style={{ marginBottom: 14 }}>
          {needsReview.length} nodo(s) marcados «por revisar»: {needsReview.map((u) => u.name_short).join(', ')}.
          Verifíquelos y márquelos como confirmados.
        </div>
      )}
      {err && <div className="callout callout--crit" style={{ marginBottom: 12 }}>{err}</div>}

      <QueryState isLoading={q.isLoading} error={q.error}>
        <div className="card">
          <div className="card__b" style={{ display: 'grid', gap: 2 }}>
            {renderTree(null, 0)}
          </div>
        </div>
      </QueryState>
    </>
  );
}

function UnitRow({
  u,
  depth,
  busy,
  onSave,
  onAddChild,
}: {
  u: AdminUnit;
  depth: number;
  busy: boolean;
  onSave: (patch: { name_short?: string; name_official?: string; status?: string }) => void;
  onAddChild: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [short, setShort] = useState(u.name_short);
  const [official, setOfficial] = useState(u.name_official);

  return (
    <div
      style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        padding: '7px 8px', paddingLeft: 8 + depth * 18,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {editing ? (
        <>
          <input value={short} onChange={(e) => setShort(e.target.value)} style={{ width: 180 }} />
          <input value={official} onChange={(e) => setOfficial(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <button className="btn btn--primary" style={{ fontSize: 12, padding: '3px 8px' }} disabled={busy}
            onClick={() => { onSave({ name_short: short, name_official: official }); setEditing(false); }}>
            Guardar
          </button>
          <button className="btn btn--ghost" style={{ fontSize: 12, padding: '3px 8px' }}
            onClick={() => { setShort(u.name_short); setOfficial(u.name_official); setEditing(false); }}>
            Cancelar
          </button>
        </>
      ) : (
        <>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', minWidth: 54 }}>{u.code}</span>
          <b style={{ fontSize: 13 }}>{u.name_short}</b>
          <span className="muted" style={{ fontSize: 12 }}>{u.type}</span>
          {u.status === 'needs_review' && <span className="pill pill--warning">por revisar</span>}
          <span style={{ flex: 1 }} />
          {u.status === 'needs_review' && (
            <button className="btn btn--ghost" style={{ fontSize: 12, padding: '3px 8px' }} disabled={busy}
              onClick={() => onSave({ status: 'active' })}>
              Confirmar
            </button>
          )}
          <button className="btn btn--ghost" style={{ fontSize: 12, padding: '3px 8px' }} onClick={() => setEditing(true)}>
            Renombrar
          </button>
          <button className="btn btn--ghost" style={{ fontSize: 12, padding: '3px 8px' }} onClick={onAddChild}>
            + Subunidad
          </button>
        </>
      )}
    </div>
  );
}

function NewUnitForm({
  parentName,
  busy,
  onCreate,
  onCancel,
}: {
  parentName: string;
  busy: boolean;
  onCreate: (v: { code: string; name_short: string; name_official: string; type: string }) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState('');
  const [nameShort, setNameShort] = useState('');
  const [nameOfficial, setNameOfficial] = useState('');
  const [type, setType] = useState('unidad');
  const ok = /^[A-Za-z0-9_-]{2,}$/.test(code) && nameShort.trim().length >= 2;

  return (
    <div style={{ padding: '10px 12px', background: 'var(--sunken)', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
      <span className="muted" style={{ fontSize: 12, flexBasis: '100%' }}>Nueva subunidad de <b>{parentName}</b></span>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Código</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SIGLA" />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Nombre corto</label>
        <input value={nameShort} onChange={(e) => setNameShort(e.target.value)} />
      </div>
      <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
        <label>Nombre oficial</label>
        <input value={nameOfficial} onChange={(e) => setNameOfficial(e.target.value)} placeholder="(por defecto = nombre corto)" />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Tipo</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <button className="btn btn--primary" disabled={!ok || busy}
        onClick={() => onCreate({ code: code.trim(), name_short: nameShort, name_official: nameOfficial, type })}>
        Crear
      </button>
      <button className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
    </div>
  );
}

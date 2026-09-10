import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS, type UnitRole } from '@rat/shared';
import {
  fetchAdminUsers,
  fetchRoleCatalog,
  removeUnitAssignment,
  setUserRole,
  upsertUnitAssignment,
  type AdminUnitAssignment,
  type AdminUser,
} from '../../lib/adminApi';
import { useUnits } from '../../lib/units';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader, QueryState } from '../../components/ui';

const UNIT_ROLE_LABEL: Record<UnitRole, string> = {
  jefe: 'Jefe (edita RAT + estado de la unidad)',
  colaborador: 'Colaborador (edita RAT)',
  consulta: 'Consulta (solo lectura)',
};

export function AdminUsers() {
  const qc = useQueryClient();
  const { authz } = useAuth();
  const usersQ = useQuery({ queryKey: ['admin', 'users'], queryFn: fetchAdminUsers });
  const rolesQ = useQuery({ queryKey: ['admin', 'roles'], queryFn: fetchRoleCatalog });
  const unitsQ = useUnits();
  const [err, setErr] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });

  const roleMut = useMutation({
    mutationFn: ({ userId, roleId, scope }: { userId: string; roleId: string; scope: 'global' | 'unit' }) =>
      setUserRole(userId, roleId, scope),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo cambiar el rol.'),
  });
  const assignMut = useMutation({
    mutationFn: upsertUnitAssignment,
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo guardar la asignación.'),
  });
  const removeMut = useMutation({
    mutationFn: removeUnitAssignment,
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo quitar la asignación.'),
  });

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios y roles"
        sub="El rol define qué puede hacer una persona; la asignación a una unidad, dónde."
      />

      <div className="callout" style={{ marginBottom: 16, fontSize: 12.5 }}>
        Para que alguien pueda <b>crear y editar los RAT de una unidad</b> sin ser Superadministrador:
        asígnele el rol <b>Colaborador</b> y agréguele esa unidad con <b>unit_role “Colaborador”</b>.
        Con <b>“Consulta”</b> solo verá los RAT. Solo <b>“Jefe”</b> cambia el estado general de la unidad.
      </div>

      {err && <div className="callout callout--crit" style={{ marginBottom: 12 }}>{err}</div>}

      <QueryState isLoading={usersQ.isLoading || rolesQ.isLoading} error={usersQ.error || rolesQ.error}>
        <div style={{ display: 'grid', gap: 12 }}>
          {(usersQ.data ?? []).map((u) => (
            <UserCard
              key={u.user_id}
              u={u}
              isSelf={u.user_id === authz.user_id}
              roles={rolesQ.data ?? []}
              units={unitsQ.data ?? []}
              onRole={(roleId, scope) => { setErr(null); roleMut.mutate({ userId: u.user_id, roleId, scope }); }}
              onAssign={(a) => { setErr(null); assignMut.mutate({ ...a, user_id: u.user_id }); }}
              onRemove={(id) => { setErr(null); removeMut.mutate(id); }}
              busy={roleMut.isPending || assignMut.isPending || removeMut.isPending}
            />
          ))}
        </div>
      </QueryState>
    </>
  );
}

function UserCard({
  u,
  isSelf,
  roles,
  units,
  onRole,
  onAssign,
  onRemove,
  busy,
}: {
  u: AdminUser;
  isSelf: boolean;
  roles: Array<{ id: string; code: string; name: string }>;
  units: Array<{ id: string; name_short: string }>;
  onRole: (roleId: string, scope: 'global' | 'unit') => void;
  onAssign: (a: { id?: string; unit_id: string; unit_role: UnitRole; includes_descendants: boolean }) => void;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  const currentRole = u.roles[0];
  const [adding, setAdding] = useState(false);

  return (
    <div className="card">
      <div className="card__b" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 14 }}>{u.full_name || u.email || u.user_id}</b>
          <span className="muted mono" style={{ fontSize: 12 }}>{u.email}</span>
          {isSelf && <span className="pill pill--neutral">usted</span>}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 12 }}>Rol:</span>
          <select
            disabled={isSelf || busy}
            value={currentRole?.role_id ?? ''}
            onChange={(e) => {
              const scope = e.target.selectedOptions[0]?.dataset.scope as 'global' | 'unit';
              onRole(e.target.value, scope);
            }}
          >
            <option value="" disabled>— Sin rol —</option>
            {roles.map((r) => (
              <option
                key={r.id}
                value={r.id}
                data-scope={r.code === 'superadmin' || r.code === 'dpd_admin' || r.code === 'auditor' ? 'global' : 'unit'}
              >
                {ROLE_LABELS[r.code as keyof typeof ROLE_LABELS] ?? r.name}
              </option>
            ))}
          </select>
          {isSelf && <span className="muted" style={{ fontSize: 11 }}>No puede cambiar su propio rol.</span>}
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Unidades asignadas</div>
          {u.assignments.length === 0 && (
            <span className="muted" style={{ fontSize: 12 }}>Ninguna.</span>
          )}
          <div style={{ display: 'grid', gap: 6 }}>
            {u.assignments.map((a) => (
              <AssignmentRow key={a.id} a={a} isSelf={isSelf} busy={busy}
                onChange={(patch) => onAssign({ id: a.id, unit_id: a.unit_id, unit_role: patch.unit_role, includes_descendants: patch.includes_descendants })}
                onRemove={() => onRemove(a.id)} />
            ))}
          </div>

          {!isSelf && (adding ? (
            <NewAssignment units={units.filter((x) => !u.assignments.some((a) => a.unit_id === x.id))}
              busy={busy}
              onCancel={() => setAdding(false)}
              onAdd={(a) => { onAssign(a); setAdding(false); }} />
          ) : (
            <button className="btn" style={{ marginTop: 8 }} disabled={busy} onClick={() => setAdding(true)}>
              + Asignar unidad
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssignmentRow({
  a,
  isSelf,
  busy,
  onChange,
  onRemove,
}: {
  a: AdminUnitAssignment;
  isSelf: boolean;
  busy: boolean;
  onChange: (patch: { unit_role: UnitRole; includes_descendants: boolean }) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '7px 9px' }}>
      <b style={{ fontSize: 13, minWidth: 140 }}>{a.unit_name}</b>
      <select
        disabled={isSelf || busy}
        value={a.unit_role}
        onChange={(e) => onChange({ unit_role: e.target.value as UnitRole, includes_descendants: a.includes_descendants })}
      >
        {(Object.keys(UNIT_ROLE_LABEL) as UnitRole[]).map((r) => (
          <option key={r} value={r}>{UNIT_ROLE_LABEL[r]}</option>
        ))}
      </select>
      <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
        <input
          type="checkbox"
          disabled={isSelf || busy}
          checked={a.includes_descendants}
          onChange={(e) => onChange({ unit_role: a.unit_role, includes_descendants: e.target.checked })}
          style={{ width: 'auto' }}
        />
        incluye subunidades
      </label>
      {!isSelf && (
        <button className="btn btn--ghost" style={{ fontSize: 12, padding: '3px 8px' }} disabled={busy} onClick={onRemove}>
          Quitar
        </button>
      )}
    </div>
  );
}

function NewAssignment({
  units,
  busy,
  onAdd,
  onCancel,
}: {
  units: Array<{ id: string; name_short: string }>;
  busy: boolean;
  onAdd: (a: { unit_id: string; unit_role: UnitRole; includes_descendants: boolean }) => void;
  onCancel: () => void;
}) {
  const [unitId, setUnitId] = useState('');
  const [role, setRole] = useState<UnitRole>('colaborador');
  const [desc, setDesc] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
      <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ minWidth: 180 }}>
        <option value="">— Unidad —</option>
        {units.map((x) => <option key={x.id} value={x.id}>{x.name_short}</option>)}
      </select>
      <select value={role} onChange={(e) => setRole(e.target.value as UnitRole)}>
        {(Object.keys(UNIT_ROLE_LABEL) as UnitRole[]).map((r) => (
          <option key={r} value={r}>{UNIT_ROLE_LABEL[r]}</option>
        ))}
      </select>
      <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
        <input type="checkbox" checked={desc} onChange={(e) => setDesc(e.target.checked)} style={{ width: 'auto' }} />
        incluye subunidades
      </label>
      <button className="btn btn--primary" disabled={!unitId || busy}
        onClick={() => onAdd({ unit_id: unitId, unit_role: role, includes_descendants: desc })}>
        Agregar
      </button>
      <button className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
    </div>
  );
}

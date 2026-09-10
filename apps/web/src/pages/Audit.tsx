import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AUDIT_ACTION_LABEL,
  AUDIT_ACTIONS,
  fetchAudit,
  verifyAuditChain,
  type AuditEntry,
} from '../lib/auditApi';
import { PageHeader, QueryState } from '../components/ui';

const ENTITY_LABEL: Record<string, string> = {
  processing_activities: 'Actividad',
  organizational_units: 'Unidad',
  user_roles: 'Rol de usuario',
  user_unit_assignments: 'Asignación a unidad',
  activity_legal_bases: 'Base de licitud (actividad)',
  activity_data_categories: 'Datos (actividad)',
  activity_subject_categories: 'Titulares (actividad)',
  legal_bases: 'Catálogo · bases',
  data_categories: 'Catálogo · datos',
  subject_categories: 'Catálogo · titulares',
  import_batches: 'Lote de importación',
};

export function Audit() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [days, setDays] = useState('30');

  const since = days === 'all' ? undefined : new Date(Date.now() - Number(days) * 864e5).toISOString();
  const q = useQuery({
    queryKey: ['audit', action, entityType, days],
    queryFn: () => fetchAudit({ action: action || undefined, entityType: entityType || undefined, since, limit: 200 }),
  });

  const verify = useMutation({ mutationFn: verifyAuditChain });

  return (
    <>
      <PageHeader
        eyebrow="Trazabilidad"
        title="Consola de auditoría"
        sub="Registro append-only con cadena de hash. No se puede modificar ni borrar."
        actions={
          <button className="btn" disabled={verify.isPending} onClick={() => verify.mutate()}>
            {verify.isPending ? 'Verificando…' : 'Verificar integridad'}
          </button>
        }
      />

      {verify.data && (
        <div className={`callout ${verify.data.ok ? '' : 'callout--crit'}`} style={{ marginBottom: 14 }}>
          {verify.data.ok
            ? 'Cadena de auditoría íntegra: ningún registro fue alterado.'
            : `⚠ Cadena rota en el registro #${verify.data.broken_at}.`}
        </div>
      )}
      {verify.error && (
        <div className="callout callout--crit" style={{ marginBottom: 14 }}>
          {(verify.error as Error).message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Acción: todas</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>{AUDIT_ACTION_LABEL[a] ?? a}</option>
          ))}
        </select>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">Entidad: todas</option>
          {Object.entries(ENTITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
          <option value="all">Todo</option>
        </select>
      </div>

      <QueryState isLoading={q.isLoading} error={q.error}>
        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actor</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Cambio</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((e) => <AuditRow key={e.id} e={e} />)}
              {q.data?.length === 0 && (
                <tr><td colSpan={6} className="muted" style={{ padding: 20 }}>Sin registros para el filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(q.data?.length ?? 0) >= 200 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Se muestran los 200 registros más recientes. Refine el filtro para ver más atrás.
          </p>
        )}
      </QueryState>
    </>
  );
}

function AuditRow({ e }: { e: AuditEntry }) {
  const change =
    e.previous_state || e.new_state
      ? `${e.previous_state ?? '—'} → ${e.new_state ?? '—'}`
      : e.changed_fields?.length
        ? e.changed_fields.slice(0, 4).join(', ') + (e.changed_fields.length > 4 ? '…' : '')
        : '—';
  return (
    <tr>
      <td className="mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        {new Date(e.occurred_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
      </td>
      <td style={{ fontSize: 12 }}>{e.actor_email ?? <span className="muted">sistema</span>}</td>
      <td><span className="pill pill--neutral">{AUDIT_ACTION_LABEL[e.action] ?? e.action}</span></td>
      <td style={{ fontSize: 12 }}>
        {ENTITY_LABEL[e.entity_type ?? ''] ?? e.entity_type ?? '—'}
        {e.entity_id && <span className="muted mono" style={{ fontSize: 11, display: 'block' }}>{e.entity_id.slice(0, 12)}</span>}
      </td>
      <td style={{ fontSize: 12 }}>{change}</td>
      <td>
        <span className={`pill ${e.result === 'success' ? 'pill--success' : e.result === 'denied' ? 'pill--warning' : 'pill--critical'}`}>
          {e.result === 'success' ? 'OK' : e.result === 'denied' ? 'Denegado' : 'Error'}
        </span>
      </td>
    </tr>
  );
}

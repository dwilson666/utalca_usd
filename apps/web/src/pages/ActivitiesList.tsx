import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ACTIVITY_STATUS, ACTIVITY_STATUS_LABEL, type ActivityStatus } from '@rat/shared';
import { fetchActivities } from '../lib/queries';
import { ActivityStatusPill, PageHeader, QueryState } from '../components/ui';

export function ActivitiesList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ActivityStatus | ''>('');

  const q = useQuery({
    queryKey: ['activities', 'all', search, status],
    queryFn: () =>
      fetchActivities({
        search: search || undefined,
        status: status || undefined,
        limit: 100,
      }),
  });

  return (
    <>
      <PageHeader
        title="Actividades de tratamiento"
        sub="Solo se listan las actividades de las unidades a las que usted tiene acceso"
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar por nombre o código…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 11px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface)',
            color: 'var(--ink)',
            font: 'inherit',
          }}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ActivityStatus | '')}
          style={{
            padding: '8px 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface)',
            color: 'var(--ink)',
          }}
        >
          <option value="">Estado: todos</option>
          {ACTIVITY_STATUS.map((s) => (
            <option key={s} value={s}>
              {ACTIVITY_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <QueryState isLoading={q.isLoading} error={q.error}>
        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr>
                <th>Código</th>
                <th>Actividad</th>
                <th>Estado</th>
                <th>Compl.</th>
                <th>Atributos</th>
                <th>Modificado</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.ref_code}</td>
                  <td>
                    <Link to={`/actividades/${a.id}`}>{a.title || '(sin nombre)'}</Link>
                  </td>
                  <td>
                    <ActivityStatusPill status={a.status} />
                  </td>
                  <td className="mono">{a.completeness_pct}%</td>
                  <td>
                    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {a.has_sensitive_data && <Tag tone="crit">sensible</Tag>}
                      {a.has_international_transfer && <Tag tone="warn">transf. int.</Tag>}
                      {a.has_automated_decision && <Tag tone="info">decisión auto.</Tag>}
                    </span>
                  </td>
                  <td className="mono">{new Date(a.updated_at).toLocaleDateString('es-CL')}</td>
                </tr>
              ))}
              {q.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 24 }}>
                    No hay actividades que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </QueryState>
    </>
  );
}

function Tag({ tone, children }: { tone: 'crit' | 'warn' | 'info'; children: ReactNode }) {
  const bg = { crit: 'var(--critical-weak)', warn: 'var(--warning-weak)', info: 'var(--info-weak)' }[tone];
  const fg = { crit: 'var(--critical)', warn: 'var(--warning)', info: 'var(--info)' }[tone];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 2, background: bg, color: fg }}>
      {children}
    </span>
  );
}

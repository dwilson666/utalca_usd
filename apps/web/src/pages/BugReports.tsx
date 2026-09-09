import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { PageHeader, QueryState } from '../components/ui';

type BugStatus = 'nuevo' | 'en_revision' | 'resuelto' | 'descartado';

interface Bug {
  id: string;
  reporter_email: string | null;
  title: string;
  description: string;
  route: string | null;
  url: string | null;
  user_agent: string | null;
  viewport: string | null;
  role_hint: string | null;
  console_errors: unknown[];
  app_commit: string | null;
  status: BugStatus;
  resolution_note: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<BugStatus, string> = {
  nuevo: 'Nuevo',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  descartado: 'Descartado',
};
const STATUS_TONE: Record<BugStatus, string> = {
  nuevo: 'warning',
  en_revision: 'accent',
  resuelto: 'success',
  descartado: 'neutral',
};

async function fetchBugs(status: BugStatus | 'todos'): Promise<Bug[]> {
  let q = supabase
    .from('bug_reports')
    .select(
      'id,reporter_email,title,description,route,url,user_agent,viewport,role_hint,console_errors,app_commit,status,resolution_note,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'todos') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Bug[];
}

export function BugReports() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<BugStatus | 'todos'>('nuevo');
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['bugs', filter], queryFn: () => fetchBugs(filter) });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: BugStatus; note?: string }) => {
      const patch: Record<string, unknown> = { status };
      if (status === 'resuelto' || status === 'descartado') {
        patch.resolved_at = new Date().toISOString();
        if (note) patch.resolution_note = note;
      }
      const { error } = await supabase.from('bug_reports').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bugs'] }),
  });

  return (
    <>
      <PageHeader
        title="Reportes de errores"
        sub="Enviados por los usuarios desde el botón 🐞 de la barra superior"
        actions={
          <select
            className="btn"
            value={filter}
            onChange={(e) => setFilter(e.target.value as BugStatus | 'todos')}
          >
            <option value="nuevo">Nuevos</option>
            <option value="en_revision">En revisión</option>
            <option value="resuelto">Resueltos</option>
            <option value="descartado">Descartados</option>
            <option value="todos">Todos</option>
          </select>
        }
      />

      <QueryState isLoading={q.isLoading} error={q.error}>
        {(q.data ?? []).length === 0 ? (
          <div className="callout">No hay reportes {filter !== 'todos' ? `«${STATUS_LABEL[filter]}»` : ''}.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {(q.data ?? []).map((bug) => (
              <div key={bug.id} className="card">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(openId === bug.id ? null : bug.id)}
                  onKeyDown={(e) =>
                    (e.key === 'Enter' || e.key === ' ') &&
                    setOpenId(openId === bug.id ? null : bug.id)
                  }
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                  }}
                >
                  <span>
                    <span className={`pill pill--${STATUS_TONE[bug.status]}`}>
                      {STATUS_LABEL[bug.status]}
                    </span>{' '}
                    <b style={{ fontWeight: 600 }}>{bug.title}</b>
                  </span>
                  <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {bug.reporter_email ?? '—'} · {new Date(bug.created_at).toLocaleString('es-CL')}
                  </span>
                </div>

                {openId === bug.id && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 12 }}>{bug.description}</p>
                    <div
                      className="mono"
                      style={{ fontSize: 11.5, color: 'var(--ink-muted)', display: 'grid', gap: 2, marginTop: 8 }}
                    >
                      <span>ruta: {bug.route ?? '—'}</span>
                      <span>rol: {bug.role_hint ?? '—'} · viewport: {bug.viewport ?? '—'}</span>
                      <span>commit: {bug.app_commit ?? '—'}</span>
                      <span style={{ wordBreak: 'break-all' }}>ua: {bug.user_agent ?? '—'}</span>
                    </div>
                    {Array.isArray(bug.console_errors) && bug.console_errors.length > 0 && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: 'pointer', fontSize: 12 }}>
                          {bug.console_errors.length} error(es) de consola
                        </summary>
                        <pre
                          style={{
                            fontSize: 11,
                            background: 'var(--sunken)',
                            padding: 10,
                            borderRadius: 6,
                            overflowX: 'auto',
                          }}
                        >
                          {JSON.stringify(bug.console_errors, null, 2)}
                        </pre>
                      </details>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {bug.status !== 'en_revision' && (
                        <button
                          className="btn btn--sm"
                          onClick={() => setStatus.mutate({ id: bug.id, status: 'en_revision' })}
                        >
                          Marcar en revisión
                        </button>
                      )}
                      {bug.status !== 'resuelto' && (
                        <button
                          className="btn btn--sm btn--primary"
                          onClick={() => setStatus.mutate({ id: bug.id, status: 'resuelto' })}
                        >
                          Resuelto
                        </button>
                      )}
                      {bug.status !== 'descartado' && (
                        <button
                          className="btn btn--sm"
                          onClick={() => setStatus.mutate({ id: bug.id, status: 'descartado' })}
                        >
                          Descartar
                        </button>
                      )}
                    </div>
                    {bug.resolution_note && (
                      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                        Nota: {bug.resolution_note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}

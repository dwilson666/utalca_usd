import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_TRANSITIONS,
  can,
  type ActivityStatus,
  type Permission,
} from '@rat/shared';
import {
  fetchActivity,
  fetchActivityHistory,
  fetchOpenObservations,
  fetchVersionDiff,
  transitionActivity,
} from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { ActivityStatusPill, PageHeader, QueryState } from '../components/ui';
import { ObservationItem } from '../components/Observations';

// Qué permiso exige cada transición (espejo de workflow_transitions).
const TRANSITION_PERM: Record<string, string> = {
  EN_COMPLETADO: 'activity.update.own_unit',
  BORRADOR: 'activity.update.own_unit',
  EN_REVISION: 'activity.submit',
  APROBADO: 'activity.review',
  OBSERVADO: 'activity.review',
  CORREGIDO: 'activity.update.own_unit',
  CERRADO: 'activity.close',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ActivityDetail() {
  const { id = '' } = useParams();
  const { authz } = useAuth();
  const qc = useQueryClient();

  const validId = UUID_RE.test(id);
  const act = useQuery({
    queryKey: ['activity', id],
    queryFn: () => fetchActivity(id),
    enabled: validId,
  });
  const history = useQuery({ queryKey: ['activity', id, 'history'], queryFn: () => fetchActivityHistory(id) });
  const obs = useQuery({ queryKey: ['activity', id, 'obs'], queryFn: () => fetchOpenObservations(id) });

  const a = act.data as any;
  const status: ActivityStatus | undefined = a?.status;

  const allowed = useMemo(() => {
    if (!status) return [];
    return ACTIVITY_TRANSITIONS[status].filter((to) => {
      const perm = TRANSITION_PERM[to];
      return perm ? can(authz, perm as Permission) : true;
    });
  }, [status, authz]);

  const mut = useMutation({
    mutationFn: ({ to, comment }: { to: ActivityStatus; comment?: string }) =>
      transitionActivity(id, to, comment),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activity', id] });
      void qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  if (!validId || (!act.isLoading && !act.error && !a)) {
    return (
      <>
        <PageHeader title="Actividad no encontrada" sub="El recurso no existe o no está dentro de su alcance." />
        <Link className="btn" to="/actividades">Volver a actividades</Link>
      </>
    );
  }

  return (
    <QueryState isLoading={act.isLoading} error={act.error}>
      {!a ? (
        <div className="callout">Actividad no encontrada.</div>
      ) : (
        <>
          <PageHeader
            eyebrow={`${a.ref_code} · ${a.responsible_unit?.name_short ?? ''}`}
            title={a.title || '(sin nombre)'}
            sub={
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <ActivityStatusPill status={a.status} />
                <span className="muted">Completitud {a.completeness_pct}%</span>
              </span>
            }
            actions={
              can(authz, 'activity.update.own_unit') && (
                <Link className="btn" to={`/actividades/${id}/editar`}>
                  Editar
                </Link>
              )
            }
          />

          {a.has_sensitive_data &&
            !(a.legal_bases ?? []).some((lb: any) => lb.legal_basis?.requires_reinforced) && (
              <div className="callout callout--warn" style={{ marginBottom: 14 }}>
                Trata datos sensibles y aún no declara una base de licitud reforzada.
              </div>
            )}

          <div className="split split--aside-narrow">
            <div style={{ display: 'grid', gap: 10 }}>
              <Section title="Finalidad y tratamiento">
                <KV k="Finalidad" v={a.purpose} />
                <KV k="Descripción" v={a.description} />
                <KV k="Origen de los datos" v={a.data_source} />
              </Section>
              <Section title="Titulares y datos">
                <KV
                  k="Categorías de titulares"
                  v={(a.subject_categories ?? []).map((x: any) => x.subject_category?.label).join(' · ')}
                />
                <KV
                  k="Categorías de datos"
                  v={(a.data_categories ?? [])
                    .map((x: any) => (x.is_sensitive ? `${x.data_category?.label} (sensible)` : x.data_category?.label))
                    .join(' · ')}
                />
              </Section>
              <Section title="Base jurídica">
                <KV
                  k="Bases de licitud"
                  v={(a.legal_bases ?? []).map((x: any) => x.legal_basis?.label).join(' · ') || '—'}
                />
              </Section>
              <Section title="Destinatarios · Transferencias · Conservación · Seguridad">
                <KV k="Destinatarios" v={(a.recipients ?? []).map((x: any) => x.name || x.recipient_type?.label).join(' · ')} />
                <KV k="Transferencia internacional" v={a.has_international_transfer ? 'Sí' : 'No'} />
                <KV k="Conservación" v={a.retention_text} />
                <KV k="Medidas de seguridad" v={(a.security_measures ?? []).map((x: any) => x.security_measure?.label).join(' · ')} />
              </Section>
            </div>

            <div>
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card__b">
                  <div className="eyebrow">Cambiar estado</div>
                  {allowed.length === 0 ? (
                    <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                      No hay transiciones disponibles para su rol.
                    </p>
                  ) : (
                    <TransitionControl
                      allowed={allowed}
                      pending={mut.isPending}
                      error={mut.error as Error | null}
                      onGo={(to, comment) => mut.mutate({ to, comment })}
                    />
                  )}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card__b">
                  <div className="eyebrow">Observaciones</div>
                  {(obs.data ?? []).length === 0 ? (
                    <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Ninguna.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      {(obs.data ?? []).map((o) => (
                        <ObservationItem key={o.id} o={o} />
                      ))}
                    </div>
                  )}
                  {(a.status === 'OBSERVADO' || a.status === 'CORREGIDO') &&
                    can(authz, 'activity.update.own_unit') && (
                      <Link className="btn btn--primary" to={`/actividades/${id}/editar`} style={{ marginTop: 10 }}>
                        Corregir y reenviar
                      </Link>
                    )}
                </div>
              </div>

              <div className="card">
                <div className="card__b">
                  <div className="eyebrow">Versiones</div>
                  <VersionHistory id={id} versions={history.data ?? []} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </QueryState>
  );
}

function VersionHistory({
  id,
  versions,
}: {
  id: string;
  versions: Array<{ id: string; version_no: number; reason: string; created_at: string }>;
}) {
  const [pair, setPair] = useState<[number, number] | null>(null);
  const diff = useQuery({
    queryKey: ['activity', id, 'diff', pair?.[0], pair?.[1]],
    queryFn: () => fetchVersionDiff(id, pair![0], pair![1]),
    enabled: !!pair,
  });

  const REASON: Record<string, string> = { submit: 'envío a revisión', approve: 'aprobación', manual: 'guardado manual', restore: 'restauración' };

  if (versions.length === 0) return <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Sin versiones aún.</p>;

  return (
    <div style={{ marginTop: 6 }}>
      {versions.map((v, i) => {
        const prev = versions[i + 1];
        return (
          <div key={v.id} style={{ fontSize: 12, marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="mono">v{v.version_no}</span>
            <span className="muted">{REASON[v.reason] ?? v.reason} · {new Date(v.created_at).toLocaleDateString('es-CL')}</span>
            {prev && (
              <button
                className="btn btn--ghost"
                style={{ fontSize: 11, padding: '1px 6px' }}
                onClick={() => setPair(pair && pair[0] === prev.version_no && pair[1] === v.version_no ? null : [prev.version_no, v.version_no])}
              >
                {pair && pair[0] === prev.version_no && pair[1] === v.version_no ? 'ocultar' : `↔ v${prev.version_no}`}
              </button>
            )}
          </div>
        );
      })}

      {pair && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: 12 }}>
          <b>v{pair[0]} → v{pair[1]}</b>
          {diff.isLoading && <p className="muted">Comparando…</p>}
          {diff.data && diff.data.scalar.length === 0 && diff.data.collections.length === 0 && (
            <p className="muted">Sin cambios en los campos comparados.</p>
          )}
          {diff.data?.scalar.map((c) => (
            <div key={c.field} style={{ marginTop: 4 }}>
              <span className="muted">{c.field}: </span>
              <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{String(c.a ?? '—')}</span>{' → '}
              <b>{String(c.b ?? '—')}</b>
            </div>
          ))}
          {diff.data?.collections.map((c) => (
            <div key={c.name} style={{ marginTop: 4 }}>
              <span className="muted">{c.name}: </span>{c.a} → <b>{c.b}</b> ítem(s)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="card" open>
      <summary style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
        {title}
      </summary>
      <div style={{ padding: 14, display: 'grid', gap: 10, borderTop: '1px solid var(--border)' }}>
        {children}
      </div>
    </details>
  );
}

function KV({ k, v }: { k: string; v?: string | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, fontSize: 13 }}>
      <span className="muted" style={{ fontSize: 12 }}>{k}</span>
      <span>{v || <span className="muted">—</span>}</span>
    </div>
  );
}

function TransitionControl({
  allowed,
  pending,
  error,
  onGo,
}: {
  allowed: ActivityStatus[];
  pending: boolean;
  error: Error | null;
  onGo: (to: ActivityStatus, comment?: string) => void;
}) {
  const [to, setTo] = useState<ActivityStatus>(allowed[0]!);
  const [comment, setComment] = useState('');
  const needsComment = to === 'OBSERVADO' || to === 'EN_REVISION';
  return (
    <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
      <select
        value={to}
        onChange={(e) => setTo(e.target.value as ActivityStatus)}
        style={{ padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--ground)', color: 'var(--ink)' }}
      >
        {allowed.map((s) => (
          <option key={s} value={s}>
            {ACTIVITY_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <input
        placeholder={needsComment ? 'Comentario (obligatorio)' : 'Comentario (opcional)'}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--ground)', color: 'var(--ink)' }}
      />
      <button
        className="btn btn--primary"
        disabled={pending || (needsComment && !comment.trim())}
        onClick={() => onGo(to, comment || undefined)}
      >
        {pending ? 'Aplicando…' : 'Aplicar transición'}
      </button>
      {error && <div className="callout callout--crit">{error.message}</div>}
    </div>
  );
}

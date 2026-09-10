import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WIZARD_STEPS } from '@rat/shared';
import { fetchActivity } from '../lib/queries';
import {
  addObservation,
  decideReview,
  fetchObservations,
  resolveObservation,
  type ObservationSeverity,
} from '../lib/reviewApi';
import { PageHeader, QueryState } from '../components/ui';
import { RatReadView } from '../components/RatReadView';
import { ObservationItem } from '../components/Observations';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ReviewDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const valid = UUID_RE.test(id);

  const act = useQuery({ queryKey: ['activity', id], queryFn: () => fetchActivity(id), enabled: valid });
  const obs = useQuery({ queryKey: ['activity', id, 'obs'], queryFn: () => fetchObservations(id), enabled: valid });

  const [field, setField] = useState('general');
  const [severity, setSeverity] = useState<ObservationSeverity>('obligatoria');
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const a = act.data as Record<string, any> | null;

  const openObligatory = useMemo(
    () => (obs.data ?? []).filter((o) => o.severity === 'obligatoria' && !o.resolved_at).length,
    [obs.data],
  );

  const addMut = useMutation({
    mutationFn: () => addObservation(id, field, severity, text.trim()),
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({ queryKey: ['activity', id, 'obs'] });
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo agregar la observación.'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ obsId, resolved }: { obsId: string; resolved: boolean }) =>
      resolveObservation(obsId, resolved),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['activity', id, 'obs'] }),
  });

  const decideMut = useMutation({
    mutationFn: (outcome: 'approved' | 'observed') => decideReview(id, outcome, summary.trim() || undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['review', 'queue'] });
      void qc.invalidateQueries({ queryKey: ['activity', id] });
      nav('/revision');
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo aplicar la decisión.'),
  });

  if (!valid || (!act.isLoading && !act.error && !a)) {
    return (
      <>
        <PageHeader title="Actividad no encontrada" sub="No existe o no está dentro de su alcance." />
        <Link className="btn" to="/revision">Volver a la bandeja</Link>
      </>
    );
  }

  return (
    <QueryState isLoading={act.isLoading} error={act.error}>
      {a && (
        <>
          <PageHeader
            eyebrow={`${a.ref_code} · ${a.responsible_unit?.name_short ?? ''} · revisión`}
            title={a.title || '(sin nombre)'}
            sub={<span className="muted">Completitud {a.completeness_pct}%</span>}
            actions={<Link className="btn btn--ghost" to={`/actividades/${id}`}>Ver ficha completa</Link>}
          />

          {a.status !== 'EN_REVISION' && (
            <div className="callout callout--warn" style={{ marginBottom: 14 }}>
              Esta actividad ya no está en revisión (estado {a.status}).
            </div>
          )}

          <div className="split">
            <RatReadView a={a} />

            <div style={{ display: 'grid', gap: 14 }}>
              {/* observaciones */}
              <div className="card">
                <div className="card__h"><h3>Observaciones</h3></div>
                <div className="card__b" style={{ display: 'grid', gap: 10 }}>
                  {(obs.data ?? []).length === 0 && (
                    <p className="muted" style={{ fontSize: 12, margin: 0 }}>Sin observaciones.</p>
                  )}
                  {(obs.data ?? []).map((o) => (
                    <ObservationItem
                      key={o.id}
                      o={o}
                      busy={toggleMut.isPending}
                      onToggle={(resolved) => toggleMut.mutate({ obsId: o.id, resolved })}
                    />
                  ))}

                  {a.status === 'EN_REVISION' && (
                    <div style={{ display: 'grid', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      <select value={field} onChange={(e) => setField(e.target.value)}>
                        <option value="general">General</option>
                        {WIZARD_STEPS.filter((s) => s.key !== 'revision').map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                      <select value={severity} onChange={(e) => setSeverity(e.target.value as ObservationSeverity)}>
                        <option value="obligatoria">Obligatoria (bloquea la aprobación)</option>
                        <option value="sugerida">Sugerida</option>
                      </select>
                      <textarea
                        rows={3}
                        placeholder="Describa qué debe corregirse"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        style={{ resize: 'vertical' }}
                      />
                      <button
                        className="btn"
                        disabled={text.trim().length < 3 || addMut.isPending}
                        onClick={() => { setErr(null); addMut.mutate(); }}
                      >
                        {addMut.isPending ? 'Agregando…' : '+ Agregar observación'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* decisión */}
              {a.status === 'EN_REVISION' && (
                <div className="card">
                  <div className="card__h"><h3>Decisión</h3></div>
                  <div className="card__b" style={{ display: 'grid', gap: 8 }}>
                    <textarea
                      rows={2}
                      placeholder="Resumen de la revisión (opcional)"
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                    <button
                      className="btn btn--primary"
                      disabled={decideMut.isPending || openObligatory > 0}
                      onClick={() => { setErr(null); decideMut.mutate('approved'); }}
                    >
                      Aprobar
                    </button>
                    {openObligatory > 0 && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        Hay {openObligatory} observación(es) obligatoria(s) sin resolver.
                      </span>
                    )}
                    <button
                      className="btn"
                      disabled={decideMut.isPending || openObligatory === 0}
                      onClick={() => { setErr(null); decideMut.mutate('observed'); }}
                    >
                      Devolver con observaciones
                    </button>
                    {openObligatory === 0 && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        Para observar, registre al menos una observación obligatoria.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {err && <div className="callout callout--crit">{err}</div>}
            </div>
          </div>
        </>
      )}
    </QueryState>
  );
}

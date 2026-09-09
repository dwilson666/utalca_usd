import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACTIVITY_STATUS_LABEL,
  UNIT_TRANSITIONS,
  UNIT_RAT_STATUS_LABEL,
  can,
  isJefeOf,
  type ActivityStatus,
  type UnitRatStatus,
} from '@rat/shared';
import { fetchActivities, fetchUnitDashboard, transitionUnit } from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import {
  ActivityStatusPill,
  PageHeader,
  ProgressBar,
  QueryState,
  UnitStatusPill,
} from '../components/ui';

export function UnitDashboard() {
  const { unitId = '' } = useParams();
  const { authz } = useAuth();
  const qc = useQueryClient();

  const dash = useQuery({
    queryKey: ['dash', 'unit', unitId],
    queryFn: () => fetchUnitDashboard(unitId),
  });
  const acts = useQuery({
    queryKey: ['activities', unitId],
    queryFn: () => fetchActivities({ unitId, limit: 100 }),
  });

  const canChangeState = isJefeOf(authz, unitId) || can(authz, 'unit.status.manage');
  const nextStates: UnitRatStatus[] = useMemo(
    () => (dash.data ? UNIT_TRANSITIONS[dash.data.unit.rat_status] : []),
    [dash.data],
  );

  return (
    <>
      <PageHeader
        eyebrow={dash.data?.unit.name}
        title="Tablero de la unidad"
        sub={
          dash.data
            ? `${dash.data.activities_total} actividades · ${dash.data.pending_activities} con campos pendientes`
            : undefined
        }
      />

      <QueryState isLoading={dash.isLoading} error={dash.error}>
        {dash.data && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div
                className="card__b"
                style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <div>
                  <div className="eyebrow">Estado de la unidad</div>
                  <div style={{ marginTop: 4 }}>
                    <UnitStatusPill status={dash.data.unit.rat_status} />
                  </div>
                </div>
                <div>
                  <div className="eyebrow">Avance</div>
                  <div style={{ fontFamily: 'var(--f-display)', fontSize: 24, fontWeight: 600 }}>
                    {dash.data.completeness_avg}%
                  </div>
                </div>
                <div className="bar ok" style={{ flex: 1, minWidth: 200, height: 12 }}>
                  <i style={{ width: `${dash.data.completeness_avg}%` }} />
                </div>
              </div>

              {canChangeState && nextStates.length > 0 && (
                <div className="card__b" style={{ borderTop: '1px solid var(--border)' }}>
                  <ChangeUnitState
                    unitId={unitId}
                    from={dash.data.unit.rat_status}
                    options={nextStates}
                    onDone={() => {
                      void qc.invalidateQueries({ queryKey: ['dash', 'unit', unitId] });
                      void qc.invalidateQueries({ queryKey: ['dash', 'inst'] });
                    }}
                  />
                </div>
              )}
            </div>

            <div className="kpis" style={{ marginBottom: 16 }}>
              {(Object.keys(dash.data.by_status) as ActivityStatus[])
                .filter((s) => dash.data!.by_status[s] > 0)
                .map((s) => (
                  <div className="kpi" key={s}>
                    <div className="n">{dash.data!.by_status[s]}</div>
                    <div className="l">{ACTIVITY_STATUS_LABEL[s]}</div>
                  </div>
                ))}
            </div>
          </>
        )}
      </QueryState>

      <QueryState isLoading={acts.isLoading} error={acts.error}>
        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr>
                <th>Código</th>
                <th>Actividad</th>
                <th>Estado</th>
                <th>Completitud</th>
              </tr>
            </thead>
            <tbody>
              {(acts.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.ref_code}</td>
                  <td>
                    <a href={`/actividades/${a.id}`}>{a.title || '(sin nombre)'}</a>
                  </td>
                  <td>
                    <ActivityStatusPill status={a.status} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ProgressBar pct={a.completeness_pct} />
                      <span className="mono">{a.completeness_pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {acts.data?.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ padding: 24 }}>
                    Esta unidad aún no registra actividades de tratamiento.
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

function ChangeUnitState({
  unitId,
  from,
  options,
  onDone,
}: {
  unitId: string;
  from: UnitRatStatus;
  options: UnitRatStatus[];
  onDone: () => void;
}) {
  const [to, setTo] = useState<UnitRatStatus>(options[0]!);
  const [comment, setComment] = useState('');
  const m = useMutation({
    mutationFn: () => transitionUnit(unitId, to, comment || undefined),
    onSuccess: onDone,
  });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Cambiar estado de la unidad (desde {UNIT_RAT_STATUS_LABEL[from]})</label>
        <select value={to} onChange={(e) => setTo(e.target.value as UnitRatStatus)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {UNIT_RAT_STATUS_LABEL[o]}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
        <label>Comentario (opcional)</label>
        <input value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <button className="btn btn--primary" disabled={m.isPending} onClick={() => m.mutate()}>
        {m.isPending ? 'Aplicando…' : 'Aplicar'}
      </button>
      {m.error && (
        <div className="callout callout--crit" style={{ flexBasis: '100%' }}>
          {(m.error as Error).message}
        </div>
      )}
    </div>
  );
}

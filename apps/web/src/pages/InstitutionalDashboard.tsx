import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchInstitutionalDashboard } from '../lib/queries';
import { PageHeader, ProgressBar, QueryState, UnitStatusPill } from '../components/ui';

export function InstitutionalDashboard() {
  const q = useQuery({ queryKey: ['dash', 'inst'], queryFn: fetchInstitutionalDashboard });

  return (
    <>
      <PageHeader
        eyebrow="Responsabilidad proactiva · Ley 21.719"
        title="Tablero institucional"
        sub="Avance del Registro de Actividades de Tratamiento"
      />
      <QueryState isLoading={q.isLoading} error={q.error}>
        {q.data && (
          <>
            <div className="kpis" style={{ marginBottom: 18 }}>
              <Kpi n={q.data.unidades_total} l="Unidades / direcciones" />
              <Kpi n={q.data.unidades_con_actividades} l="Con actividades" />
              <Kpi n={q.data.actividades_total} l="Actividades" />
              <Kpi n={q.data.por_estado?.['EN_REVISION'] ?? 0} l="En revisión" />
              <Kpi n={q.data.por_estado?.['APROBADO'] ?? 0} l="Aprobadas" />
              <Kpi n={`${q.data.avance_institucional_pct}%`} l="Avance institucional" accent />
            </div>

            <div className="card">
              <div className="card__h">
                <h3 style={{ fontSize: 15 }}>Avance por unidad</h3>
              </div>
              <div className="card__b">
                <div className="tablewrap" style={{ border: 0 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Unidad</th>
                        <th>Estado</th>
                        <th>Actividades</th>
                        <th>Completitud</th>
                        <th>Contactos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.data.por_unidad.map((u) => (
                        <tr key={u.unit_id}>
                          <td>
                            <Link to={`/unidad/${u.unit_id}`}>{u.name}</Link>
                          </td>
                          <td>
                            <UnitStatusPill status={u.rat_status} />
                          </td>
                          <td className="mono">{u.activities}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <ProgressBar pct={u.completeness_avg} />
                              <span className="mono">{u.completeness_avg}%</span>
                            </div>
                          </td>
                          <td className="mono">{u.contacts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}

function Kpi({ n, l, accent }: { n: number | string; l: string; accent?: boolean }) {
  return (
    <div className="kpi">
      <div className="n" style={accent ? { color: 'var(--accent)' } : undefined}>
        {n}
      </div>
      <div className="l">{l}</div>
    </div>
  );
}

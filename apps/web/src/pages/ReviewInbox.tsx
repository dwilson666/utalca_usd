import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchReviewQueue } from '../lib/reviewApi';
import { PageHeader, ProgressBar, QueryState } from '../components/ui';

export function ReviewInbox() {
  const q = useQuery({ queryKey: ['review', 'queue'], queryFn: fetchReviewQueue });

  return (
    <>
      <PageHeader
        eyebrow="Delegado de Protección de Datos"
        title="Bandeja de revisión"
        sub="Actividades enviadas a revisión, en orden de llegada"
      />
      <QueryState isLoading={q.isLoading} error={q.error}>
        {q.data && q.data.length === 0 ? (
          <div className="callout">No hay actividades pendientes de revisión.</div>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Actividad</th>
                  <th>Unidad</th>
                  <th>Completitud</th>
                  <th>Enviada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(q.data ?? []).map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.ref_code}</td>
                    <td>{a.title || '(sin nombre)'}</td>
                    <td>{a.unit_name ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ProgressBar pct={a.completeness_pct} />
                        <span className="mono">{a.completeness_pct}%</span>
                      </div>
                    </td>
                    <td className="mono">{new Date(a.updated_at).toLocaleDateString('es-CL')}</td>
                    <td>
                      <Link className="btn btn--primary" style={{ padding: '4px 10px', fontSize: 12 }} to={`/revision/${a.id}`}>
                        Revisar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </>
  );
}

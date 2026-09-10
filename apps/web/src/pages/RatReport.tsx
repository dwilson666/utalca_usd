import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ACTIVITY_STATUS_LABEL, can } from '@rat/shared';
import { downloadXlsx, fetchActivitiesForExport, type ExportActivity } from '../lib/exportApi';
import { selectableUnitsFor, useUnits } from '../lib/units';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader, QueryState } from '../components/ui';

export function RatReport() {
  const { authz } = useAuth();
  const unitsQ = useUnits();
  const institutional = can(authz, 'institutional.view');
  const scopeUnits = useMemo(
    () => (unitsQ.data ? selectableUnitsFor(authz, unitsQ.data) : []),
    [authz, unitsQ.data],
  );
  const [unitId, setUnitId] = useState<string>('');

  const q = useQuery({
    queryKey: ['export', 'activities', unitId],
    queryFn: () => fetchActivitiesForExport(unitId || undefined),
  });

  const xlsxMut = useMutation({
    mutationFn: () => {
      const scope = unitId
        ? (scopeUnits.find((u) => u.id === unitId)?.name_short ?? 'unidad')
        : 'institucional';
      return downloadXlsx(q.data ?? [], `RAT_UTalca_${scope}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    },
  });

  const scopeLabel = unitId
    ? scopeUnits.find((u) => u.id === unitId)?.name_official ?? ''
    : 'Universidad de Talca — consolidado institucional';

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="Entregable · Ley 21.719"
          title="Reporte del Registro de Actividades de Tratamiento"
          sub="Exportación consolidada o por unidad, según su alcance."
          actions={
            <>
              <button className="btn" disabled={!q.data?.length || xlsxMut.isPending} onClick={() => xlsxMut.mutate()}>
                {xlsxMut.isPending ? 'Generando…' : 'Descargar Excel'}
              </button>
              <button className="btn btn--primary" disabled={!q.data?.length} onClick={() => window.print()}>
                Imprimir / Guardar PDF
              </button>
            </>
          }
        />

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="muted" style={{ fontSize: 12 }}>Alcance:</label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {institutional && <option value="">Todas las unidades (institucional)</option>}
            {scopeUnits.map((u) => <option key={u.id} value={u.id}>{u.name_short}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 12 }}>
            {q.data ? `${q.data.length} actividad(es)` : ''}
          </span>
        </div>
        {xlsxMut.error && (
          <div className="callout callout--crit" style={{ marginBottom: 12 }}>
            {(xlsxMut.error as Error).message}
          </div>
        )}
      </div>

      <QueryState isLoading={q.isLoading} error={q.error}>
        <div className="printable">
          <header style={{ marginBottom: 20, borderBottom: '2px solid var(--brand)', paddingBottom: 10 }}>
            <div className="eyebrow">Registro de Actividades de Tratamiento de Datos Personales</div>
            <h1 style={{ fontSize: 20, margin: '4px 0' }}>{scopeLabel}</h1>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Generado el {new Date().toLocaleString('es-CL')} · {q.data?.length ?? 0} actividad(es) ·
              Responsable del tratamiento: Universidad de Talca (RUT 70.885.500-6)
            </p>
          </header>

          {(q.data ?? []).map((a, i) => <ActivityBlock key={a.id} a={a} n={i + 1} />)}
          {q.data?.length === 0 && (
            <p className="muted">No hay actividades registradas en este alcance.</p>
          )}
        </div>
      </QueryState>
    </>
  );
}

const j = (xs: Array<string | null | undefined>) => xs.filter(Boolean).join(' · ') || '—';

function ActivityBlock({ a, n }: { a: ExportActivity; n: number }) {
  return (
    <section
      style={{
        border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
        padding: 14, marginBottom: 14, breakInside: 'avoid',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--brand)' }}>{a.ref_code}</span>
        <b style={{ fontSize: 15 }}>{n}. {a.title}</b>
        <span className="muted" style={{ fontSize: 12 }}>
          {a.responsible_unit?.name_short} · {ACTIVITY_STATUS_LABEL[a.status]} · {a.completeness_pct}%
        </span>
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '4px 12px', fontSize: 12.5, margin: 0 }}>
        <Row k="Responsable interno" v={a.operational_owner_name} />
        <Row k="Finalidad" v={a.purpose} />
        <Row k="Descripción del proceso" v={a.description} />
        <Row k="Origen de los datos" v={a.data_source} />
        <Row k="Categorías de titulares" v={j(a.subject_categories.map((x) => x.subject_category?.label))} />
        <Row k="Categorías de datos" v={j(a.data_categories.map((x) => (x.is_sensitive ? `${x.data_category?.label} (sensible)` : x.data_category?.label)))} />
        <Row k="Bases de licitud" v={j(a.legal_bases.map((x) => (x.legal_basis?.requires_reinforced ? `${x.legal_basis?.label} (reforzada)` : x.legal_basis?.label)))} />
        <Row k="Destinatarios" v={j(a.recipients.map((x) => x.name || x.recipient_type?.label))} />
        <Row k="Transferencia internacional" v={a.has_international_transfer ? j(a.transfers.map((t) => t.country)) : 'No'} />
        <Row k="Conservación" v={a.retention_text} />
        <Row k="Medidas de seguridad" v={j(a.security_measures.map((x) => x.security_measure?.label))} />
        <Row k="Decisiones automatizadas" v={a.has_automated_decision ? 'Sí' : 'No'} />
        <Row k="Uso de IA" v={a.uses_ai ? 'Sí' : 'No'} />
      </dl>
    </section>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <>
      <dt className="muted">{k}</dt>
      <dd style={{ margin: 0 }}>{v || <span className="muted">—</span>}</dd>
    </>
  );
}

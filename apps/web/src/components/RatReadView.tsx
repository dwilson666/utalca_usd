import type { ReactNode } from 'react';

/** Vista de solo lectura de una actividad (resultado de `fetchActivity`). */
export function RatReadView({ a }: { a: Record<string, any> }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Section title="Identificación y finalidad">
        <KV k="Unidad responsable" v={a.responsible_unit?.name_short} />
        <KV k="Responsable interno" v={a.operational_owner_name} />
        <KV k="Finalidad" v={a.purpose} />
        <KV k="Descripción del proceso" v={a.description} />
        <KV k="Origen de los datos" v={a.data_source} />
      </Section>

      <Section title="Titulares y datos">
        <KV
          k="Categorías de titulares"
          v={join((a.subject_categories ?? []).map((x: any) => x.subject_category?.label))}
        />
        <KV
          k="Categorías de datos"
          v={join(
            (a.data_categories ?? []).map((x: any) =>
              x.is_sensitive ? `${x.data_category?.label} (sensible)` : x.data_category?.label,
            ),
          )}
        />
      </Section>

      <Section title="Base jurídica">
        <KV
          k="Bases de licitud"
          v={join(
            (a.legal_bases ?? []).map((x: any) =>
              x.legal_basis?.requires_reinforced
                ? `${x.legal_basis?.label} (reforzada)`
                : x.legal_basis?.label,
            ),
          )}
        />
      </Section>

      <Section title="Destinatarios · Transferencias · Conservación · Seguridad">
        <KV
          k="Destinatarios"
          v={join((a.recipients ?? []).map((x: any) => x.name || x.recipient_type?.label))}
        />
        <KV
          k="Transferencia internacional"
          v={a.has_international_transfer ? join((a.transfers ?? []).map((t: any) => t.country)) || 'Sí' : 'No'}
        />
        <KV k="Conservación" v={a.retention_text} />
        <KV
          k="Medidas de seguridad"
          v={join((a.security_measures ?? []).map((x: any) => x.security_measure?.label))}
        />
      </Section>

      <Section title="Automatización">
        <KV k="Decisiones automatizadas" v={a.has_automated_decision ? 'Sí' : 'No'} />
        <KV k="Uso de IA" v={a.uses_ai ? 'Sí' : 'No'} />
        <KV k="Sistemas propios" v={a.own_systems_text} />
      </Section>
    </div>
  );
}

function join(xs: Array<string | null | undefined>): string {
  return xs.filter(Boolean).join(' · ');
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
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, fontSize: 13 }}>
      <span className="muted" style={{ fontSize: 12 }}>{k}</span>
      <span>{v || <span className="muted">—</span>}</span>
    </div>
  );
}

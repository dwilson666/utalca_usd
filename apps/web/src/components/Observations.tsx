import { WIZARD_STEPS } from '@rat/shared';
import type { Observation } from '../lib/reviewApi';

const STEP_LABEL: Record<string, string> = Object.fromEntries(
  WIZARD_STEPS.map((s) => [s.key, s.label]),
);
STEP_LABEL['general'] = 'General';

export function fieldLabel(path: string): string {
  const [step] = path.split('.');
  return STEP_LABEL[step ?? 'general'] ?? path;
}

export function ObservationItem({
  o,
  onToggle,
  busy,
}: {
  o: Observation;
  onToggle?: (resolved: boolean) => void;
  busy?: boolean;
}) {
  const resolved = !!o.resolved_at;
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${o.severity === 'obligatoria' ? 'var(--critical)' : 'var(--warning)'}`,
        borderRadius: 'var(--r-sm)',
        padding: '9px 11px',
        opacity: resolved ? 0.6 : 1,
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          className="pill"
          style={{
            background: o.severity === 'obligatoria' ? 'var(--critical-weak)' : 'var(--warning-weak)',
            color: o.severity === 'obligatoria' ? 'var(--critical)' : 'var(--warning)',
          }}
        >
          {o.severity === 'obligatoria' ? 'Obligatoria' : 'Sugerida'}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>{fieldLabel(o.field_path)}</span>
        {resolved && <span className="pill pill--success">Resuelta</span>}
        <span style={{ flex: 1 }} />
        {onToggle && (
          <button
            className="btn btn--ghost"
            style={{ fontSize: 12, padding: '3px 8px' }}
            disabled={busy}
            onClick={() => onToggle(!resolved)}
          >
            {resolved ? 'Reabrir' : 'Marcar resuelta'}
          </button>
        )}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 13 }}>{o.text}</p>
    </div>
  );
}

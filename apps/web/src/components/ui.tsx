import type { ReactNode } from 'react';
import {
  ACTIVITY_STATUS_LABEL,
  UNIT_RAT_STATUS_LABEL,
  type ActivityStatus,
  type UnitRatStatus,
} from '@rat/shared';

const ACT_TONE: Record<ActivityStatus, string> = {
  BORRADOR: 'info',
  EN_COMPLETADO: 'info',
  EN_REVISION: 'accent',
  OBSERVADO: 'warning',
  CORREGIDO: 'warning',
  APROBADO: 'success',
  CERRADO: 'neutral',
};

const UNIT_TONE: Record<UnitRatStatus, string> = {
  PENDIENTE: 'neutral',
  EN_LEVANTAMIENTO: 'info',
  EN_REVISION: 'accent',
  CON_OBSERVACIONES: 'warning',
  COMPLETADA: 'success',
  CERRADA: 'neutral',
};

export function ActivityStatusPill({ status }: { status: ActivityStatus }) {
  return <span className={`pill pill--${ACT_TONE[status]}`}>{ACTIVITY_STATUS_LABEL[status]}</span>;
}

export function UnitStatusPill({ status }: { status: UnitRatStatus }) {
  return <span className={`pill pill--${UNIT_TONE[status]}`}>{UNIT_RAT_STATUS_LABEL[status]}</span>;
}

export function ProgressBar({ pct }: { pct: number }) {
  const tone = pct >= 100 ? 'ok' : pct < 60 ? 'lo' : '';
  return (
    <div className={`bar ${tone}`} style={{ width: 90 }}>
      <i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: string;
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="pagehead">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{sub}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function QueryState({
  isLoading,
  error,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
}) {
  if (isLoading) return <p className="muted">Cargando…</p>;
  if (error) {
    const msg = error instanceof Error ? error.message : 'Error al cargar';
    return <div className="callout callout--crit">{msg}</div>;
  }
  return <>{children}</>;
}

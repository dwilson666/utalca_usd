import type { ReactNode } from 'react';

export type FieldErrors = Record<string, string>;

export function firstError(errors: FieldErrors, prefix: string): string | undefined {
  if (errors[prefix]) return errors[prefix];
  const hit = Object.keys(errors).find((k) => k === prefix || k.startsWith(prefix + '.'));
  return hit ? errors[hit] : undefined;
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field" style={{ marginBottom: 16 }}>
      <label>
        {label}{' '}
        {required ? (
          <span style={{ color: 'var(--critical)' }} title="Obligatorio para enviar a revisión">
            *
          </span>
        ) : (
          <span className="muted" style={{ fontWeight: 400 }}>
            (opcional)
          </span>
        )}
      </label>
      {hint && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          {hint}
        </div>
      )}
      {children}
      {error && <div className="errmsg">{error}</div>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  invalid?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={invalid ? { borderColor: 'var(--critical)' } : undefined}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={invalid ? { borderColor: 'var(--critical)', resize: 'vertical' } : { resize: 'vertical' }}
    />
  );
}

export interface Option {
  id: string;
  label: string;
  hint?: string;
  flag?: string;
}

export function CheckList({
  options,
  selected,
  onToggle,
  columns = 2,
}: {
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
  columns?: number;
}) {
  const set = new Set(selected);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`,
        gap: 6,
      }}
    >
      {options.map((o) => (
        <label
          key={o.id}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            padding: '7px 9px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            background: set.has(o.id) ? 'var(--brand-weak)' : 'var(--surface)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={set.has(o.id)}
            onChange={() => onToggle(o.id)}
            style={{ width: 'auto', marginTop: 2 }}
          />
          <span>
            {o.label}
            {o.flag && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--warning)',
                  textTransform: 'uppercase',
                }}
              >
                {o.flag}
              </span>
            )}
            {o.hint && (
              <span className="muted" style={{ display: 'block', fontSize: 11 }}>
                {o.hint}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 'auto' }}
      />
      {label}
    </label>
  );
}

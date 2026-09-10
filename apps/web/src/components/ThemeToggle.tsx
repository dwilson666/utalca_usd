import { useEffect, useState } from 'react';
import {
  getUserChoice,
  onThemeChange,
  setUserChoice,
  type ThemeChoice,
} from '../lib/theme';

const OPTIONS: Array<{ value: ThemeChoice; label: string; glyph: string }> = [
  { value: 'light', label: 'Tema claro', glyph: '☀' },
  { value: 'system', label: 'Según el sistema', glyph: '◐' },
  { value: 'dark', label: 'Tema oscuro', glyph: '☾' },
];

/**
 * Selector de tema. La elección se guarda por persona (localStorage);
 * si no hay elección propia se sigue el predeterminado institucional.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(getUserChoice() ?? 'system');

  useEffect(() => onThemeChange(() => setChoice(getUserChoice() ?? 'system')), []);

  return (
    <div className="theme-seg" role="group" aria-label="Tema de la interfaz">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          aria-label={o.label}
          aria-pressed={choice === o.value}
          onClick={() => setUserChoice(o.value)}
        >
          {o.glyph}
        </button>
      ))}
    </div>
  );
}

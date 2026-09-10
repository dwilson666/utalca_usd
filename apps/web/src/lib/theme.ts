/**
 * Tema claro / oscuro.
 *   - Preferencia del usuario: localStorage['rat.theme']  ('system' | 'light' | 'dark')
 *   - Predeterminado institucional: app_settings['ui.default_theme'] (vía auth_policy)
 *   - Resolución: usuario → institucional → 'system'
 * "system" no fija data-theme (manda prefers-color-scheme); 'light'/'dark' sí.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'rat.theme';
let institutionalDefault: ThemeChoice = 'system';
const listeners = new Set<() => void>();

function readStored(): ThemeChoice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : null;
  } catch {
    return null;
  }
}

/** Lo que el usuario eligió explícitamente (o null = seguir el institucional). */
export function getUserChoice(): ThemeChoice | null {
  return readStored();
}

/** El tema efectivo a aplicar. */
export function getEffectiveChoice(): ThemeChoice {
  return readStored() ?? institutionalDefault;
}

export function applyTheme() {
  const choice = getEffectiveChoice();
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  listeners.forEach((fn) => fn());
}

export function setUserChoice(choice: ThemeChoice | null) {
  try {
    if (choice === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* almacenamiento no disponible */
  }
  applyTheme();
}

export function setInstitutionalDefault(choice: ThemeChoice) {
  institutionalDefault = choice;
  applyTheme();
}

export function onThemeChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** ¿el tema resuelto se ve oscuro ahora mismo? */
export function isDark(): boolean {
  const c = getEffectiveChoice();
  if (c === 'dark') return true;
  if (c === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

// mantener sincronizado si el SO cambia y estamos en "system"
if (typeof window !== 'undefined') {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (getEffectiveChoice() === 'system') listeners.forEach((fn) => fn());
  });
}

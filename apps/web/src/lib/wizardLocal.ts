import type { WizardDraft } from '@rat/shared';

/**
 * Respaldo local del borrador en curso (defensa ante recarga accidental o
 * corte de red). NO sustituye al guardado en el servidor: es una red de
 * seguridad de corta vida por dispositivo.
 */
const PREFIX = 'rat.wizard.';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface Stored {
  draft: WizardDraft;
  step: number;
  savedAt: number;
  serverUpdatedAt: string;
}

export function saveLocal(id: string, draft: WizardDraft, step: number, serverUpdatedAt: string) {
  try {
    localStorage.setItem(
      PREFIX + id,
      JSON.stringify({ draft, step, savedAt: Date.now(), serverUpdatedAt } satisfies Stored),
    );
  } catch {
    /* almacenamiento no disponible */
  }
}

export function readLocal(id: string): Stored | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s.savedAt || Date.now() - s.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + id);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearLocal(id: string) {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    /* noop */
  }
}

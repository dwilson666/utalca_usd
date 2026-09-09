/** Guarda los últimos errores de la sesión para adjuntarlos a un reporte de bug. */
type Entry = { t: string; kind: string; message: string; source?: string };

const MAX = 10;
const buffer: Entry[] = [];

function push(kind: string, message: string, source?: string) {
  buffer.push({ t: new Date().toISOString(), kind, message: String(message).slice(0, 1000), source });
  if (buffer.length > MAX) buffer.shift();
}

export function installErrorBuffer() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    push('error', e.message || 'error', e.filename ? `${e.filename}:${e.lineno}` : undefined);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    push('unhandledrejection', r?.message ?? (typeof r === 'string' ? r : JSON.stringify(r)));
  });
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    push('console.error', args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    origError(...args);
  };
}

export function getRecentErrors(): Entry[] {
  return [...buffer];
}

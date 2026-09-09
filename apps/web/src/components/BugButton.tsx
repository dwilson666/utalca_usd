import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getRecentErrors } from '../lib/errorBuffer';
import { useAuth } from '../auth/AuthProvider';

const APP_COMMIT = (import.meta.env.VITE_APP_COMMIT as string | undefined) ?? 'dev';

export function BugButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="iconbtn"
        title="Reportar un problema"
        aria-label="Reportar un problema"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 8V6a3 3 0 0 1 6 0v2M5 12h14M6 8h12v6a6 6 0 0 1-12 0V8ZM12 12v8M4 9 6 8M20 9l-2-1M4 16l2 1M20 16l-2 1" />
        </svg>
      </button>
      {open && <BugModal onClose={() => setOpen(false)} />}
    </>
  );
}

function BugModal({ onClose }: { onClose: () => void }) {
  const loc = useLocation();
  const { authz, session } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'done' | 'error'>('form');
  const [emailed, setEmailed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    dialogRef.current?.querySelector<HTMLElement>('input,textarea')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const roleHint =
    document.querySelector('.rolebadge')?.textContent?.trim() ??
    (authz.institutional ? 'institucional' : authz.units[0]?.unit_role ?? 'usuario');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!session?.user) return;
    setState('sending');

    const payload = {
      reporter_user_id: session.user.id,
      reporter_email: session.user.email ?? null,
      title: title.trim(),
      description: description.trim(),
      url: window.location.href,
      route: loc.pathname + loc.search,
      user_agent: navigator.userAgent,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      role_hint: roleHint,
      console_errors: getRecentErrors(),
      app_commit: APP_COMMIT,
    };

    // 1) guardar siempre en la tabla (RLS permite el insert propio)
    const { data: row, error } = await supabase
      .from('bug_reports')
      .insert(payload)
      .select('id')
      .single();
    if (error || !row) {
      setState('error');
      return;
    }

    // 2) notificar por correo (si la Edge Function está desplegada; si no, no pasa nada)
    try {
      const { data } = await supabase.functions.invoke('report-bug-notify', {
        body: { id: (row as { id: string }).id },
      });
      setEmailed(!!(data as { emailed?: boolean } | null)?.emailed);
    } catch {
      setEmailed(false);
    }
    setState('done');
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reportar un problema"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,14,20,.55)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        ref={dialogRef}
        className="card"
        style={{ width: '100%', maxWidth: 460, boxShadow: 'var(--shadow)' }}
      >
        <div className="card__h">
          <h3 style={{ fontSize: 15 }}>Reportar un problema</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="card__b">
          {state === 'done' ? (
            <div className="callout" style={{ background: 'var(--success-weak)', color: 'var(--success)', borderColor: 'transparent' }}>
              Reporte enviado. Queda registrado{emailed ? ' y se notificó por correo' : ''}. Gracias.
            </div>
          ) : state === 'error' ? (
            <div className="callout callout--crit">
              No se pudo enviar el reporte. Intente de nuevo en un momento.
              <button className="btn btn--sm" style={{ marginTop: 8 }} onClick={() => setState('form')}>
                Reintentar
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="bug-title">¿Qué pasó? (resumen)</label>
                <input
                  id="bug-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                  placeholder="Ej. la lista de actividades no carga"
                />
              </div>
              <div className="field">
                <label htmlFor="bug-desc">Detalle</label>
                <textarea
                  id="bug-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={8000}
                  required
                  placeholder="Pasos para reproducirlo, qué esperaba ver, mensajes de error…"
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--ground)',
                    color: 'var(--ink)',
                    font: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>
              <p className="muted" style={{ fontSize: 11.5, margin: '0 0 12px' }}>
                Se adjunta automáticamente: la página actual, su usuario ({session?.user.email}), el
                navegador y los últimos errores técnicos detectados.
              </p>
              <button
                className="btn btn--primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={state === 'sending'}
              >
                {state === 'sending' ? 'Enviando…' : 'Enviar reporte'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

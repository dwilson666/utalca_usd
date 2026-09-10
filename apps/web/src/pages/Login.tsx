import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { Wordmark } from '../components/Logo';

const DOMAIN = '@utalca.cl';

/** Normaliza lo que el usuario escribe a un correo institucional completo. */
function toInstitutionalEmail(input: string): string {
  const v = input.trim().toLowerCase();
  if (!v) return v;
  return v.includes('@') ? v : v + DOMAIN;
}

export function Login() {
  const { session, loading } = useAuth();
  const loc = useLocation();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) {
    const from = (loc.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: toInstitutionalEmail(user),
      password,
    });
    setBusy(false);
    if (error) {
      setError('Credenciales inválidas.'); // mensaje genérico: no revela si el usuario existe
    }
  }

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={submit}>
        <div className="authbrand">
          <Wordmark size={38} />
        </div>
        <h2 style={{ fontSize: 19, marginBottom: 4 }}>Iniciar sesión</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 20 }}>
          Acceso exclusivo con cuenta institucional. Esta plataforma trata datos personales bajo la
          Ley 21.719.
        </p>

        <div className="field">
          <label htmlFor="user">Usuario institucional</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              overflow: 'hidden',
              background: 'var(--ground)',
            }}
          >
            <input
              id="user"
              autoComplete="username"
              autoFocus
              value={user}
              onChange={(e) => setUser(e.target.value)}
              required
              style={{ border: 0, background: 'transparent', flex: 1 }}
            />
            {!user.includes('@') && (
              <span
                aria-hidden
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  padding: '0 11px',
                  color: 'var(--ink-muted)',
                  fontSize: 13,
                  borderLeft: '1px solid var(--border)',
                }}
              >
                {DOMAIN}
              </span>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="errmsg">{error}</div>}
        </div>

        <button
          className="btn btn--primary"
          style={{ width: '100%', justifyContent: 'center' }}
          disabled={busy}
        >
          {busy ? 'Verificando…' : 'Continuar'}
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
          ¿Olvidó su contraseña? Contacte a la Oficina de Seguridad Digital.
        </p>
      </form>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

export function Login() {
  const { session, loading } = useAuth();
  const loc = useLocation();
  const [email, setEmail] = useState('');
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      // Mensaje genérico: no revelar si el correo existe.
      setError('Credenciales inválidas.');
      return;
    }
    // onAuthStateChange en AuthProvider hidrata la sesión y decide MFA.
  }

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={submit}>
        <h2 style={{ fontSize: 19, marginBottom: 4 }}>Iniciar sesión</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 20 }}>
          Acceso exclusivo con cuenta institucional. Esta plataforma trata datos personales bajo la
          Ley 21.719.
        </p>
        <div className="field">
          <label htmlFor="email">Correo institucional</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
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
        <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
          {busy ? 'Verificando…' : 'Continuar'}
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
          ¿Olvidó su contraseña? Contacte a la Oficina de Seguridad Digital.
        </p>
      </form>
    </div>
  );
}

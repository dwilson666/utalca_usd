import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

export function MfaChallenge() {
  const { session, mfa, refreshAuthz } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) return <Navigate to="/login" replace />;
  if (mfa === 'verified' || mfa === 'not_required') return <Navigate to="/" replace />;
  if (mfa === 'not_enrolled') return <Navigate to="/mfa/inscribir" replace />;

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.[0];
    if (!totp) {
      setBusy(false);
      return setError('No hay un segundo factor inscrito.');
    }
    const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
    if (cErr || !chal) {
      setBusy(false);
      return setError('No se pudo generar el desafío.');
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: totp.id,
      challengeId: chal.id,
      code,
    });
    setBusy(false);
    if (vErr) return setError('Código incorrecto.');
    await refreshAuthz();
    const from = (loc.state as { from?: string } | null)?.from ?? '/';
    nav(from, { replace: true });
  }

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={verify}>
        <h2 style={{ fontSize: 19, marginBottom: 4 }}>Verificación en dos pasos</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Ingrese el código de 6 dígitos de su aplicación de autenticación.
        </p>
        <div className="field">
          <label htmlFor="code">Código</label>
          <input
            id="code"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          {error && <div className="errmsg">{error}</div>}
        </div>
        <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy || code.length !== 6}>
          {busy ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

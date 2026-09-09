import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

export function MfaEnroll() {
  const { session, mfa, refreshAuthz } = useAuth();
  const nav = useNavigate();
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !session) return;
    started.current = true;
    supabase.auth.mfa
      .enroll({ factorType: 'totp', friendlyName: 'RAT UTalca' })
      .then(({ data, error }) => {
        if (error || !data) {
          setError('No se pudo iniciar la inscripción del segundo factor.');
          return;
        }
        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
      });
  }, [session]);

  if (!session) return <Navigate to="/login" replace />;
  if (mfa === 'verified' || mfa === 'not_required') return <Navigate to="/" replace />;

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !chal) return setError('No se pudo generar el desafío.');
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: chal.id,
      code,
    });
    if (vErr) return setError('Código incorrecto. Intente nuevamente.');
    await refreshAuthz();
    nav('/', { replace: true });
  }

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={verify}>
        <h2 style={{ fontSize: 19, marginBottom: 4 }}>Configurar segundo factor</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Protege el acceso a datos personales. Escanee el código con Microsoft Authenticator, Google
          Authenticator o similar.
        </p>
        {qr ? (
          <img src={qr} alt="Código QR para el segundo factor" width={160} height={160} style={{ background: '#fff', borderRadius: 4, padding: 6 }} />
        ) : (
          <p className="muted">Generando código…</p>
        )}
        {secret && (
          <p className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
            Clave manual: {secret}
          </p>
        )}
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="code">Código de 6 dígitos</label>
          <input
            id="code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          {error && <div className="errmsg">{error}</div>}
        </div>
        <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!factorId || code.length !== 6}>
          Verificar y continuar
        </button>
      </form>
    </div>
  );
}

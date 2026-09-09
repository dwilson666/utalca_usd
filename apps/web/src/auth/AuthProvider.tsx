import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { EMPTY_AUTHZ, type MyAuthz } from '@rat/shared';
import { supabase } from '../lib/supabase';

type MfaState = 'unknown' | 'not_required' | 'not_enrolled' | 'needs_challenge' | 'verified';
const SATISFIED: MfaState[] = ['verified', 'not_required'];

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  mfa: MfaState;
  mfaSatisfied: boolean;
  authz: MyAuthz;
  refreshAuthz: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let mfaRequiredCache: boolean | null = null;
async function mfaRequired(): Promise<boolean> {
  if (mfaRequiredCache !== null) return mfaRequiredCache;
  try {
    const { data } = await supabase.rpc('auth_policy');
    mfaRequiredCache = (data as { require_mfa?: boolean } | null)?.require_mfa !== false;
  } catch {
    mfaRequiredCache = true;
  }
  return mfaRequiredCache;
}

async function readMfaState(): Promise<MfaState> {
  if (!(await mfaRequired())) return 'not_required';
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return 'unknown';
  if (data.currentLevel === 'aal2') return 'verified';
  if (data.nextLevel === 'aal2') return 'needs_challenge';
  return 'not_enrolled';
}

/** Resuelve mfa + authz para una sesión, sin tocar estado. */
async function resolve(session: Session | null): Promise<{ mfa: MfaState; authz: MyAuthz }> {
  if (!session) return { mfa: 'unknown', authz: EMPTY_AUTHZ };
  const mfa = await readMfaState();
  if (!SATISFIED.includes(mfa)) return { mfa, authz: EMPTY_AUTHZ };
  const { data } = await supabase.rpc('my_authz');
  return { mfa, authz: (data as MyAuthz) ?? EMPTY_AUTHZ };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [mfa, setMfa] = useState<MfaState>('unknown');
  const [authz, setAuthz] = useState<MyAuthz>(EMPTY_AUTHZ);

  useEffect(() => {
    let alive = true;
    async function hydrate(next: Session | null) {
      const { mfa, authz } = await resolve(next);
      if (!alive) return;
      // Un solo bloque síncrono tras los await → React agrupa: sin renders intermedios.
      setSession(next);
      setMfa(mfa);
      setAuthz(authz);
      setLoading(false);
    }
    supabase.auth.getSession().then(({ data }) => void hydrate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => void hydrate(s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      mfa,
      mfaSatisfied: SATISFIED.includes(mfa),
      authz,
      refreshAuthz: async () => {
        const r = await resolve(session);
        setMfa(r.mfa);
        setAuthz(r.authz);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [loading, session, mfa, authz],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de <AuthProvider>');
  return ctx;
}

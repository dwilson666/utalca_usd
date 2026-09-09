import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { EMPTY_AUTHZ, type MyAuthz } from '@rat/shared';
import { supabase } from '../lib/supabase';

type MfaState = 'unknown' | 'not_enrolled' | 'needs_challenge' | 'verified';

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  /** aal2 alcanzado (segundo factor verificado en esta sesión). */
  mfa: MfaState;
  authz: MyAuthz;
  refreshAuthz: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readMfaState(): Promise<MfaState> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return 'unknown';
  if (data.currentLevel === 'aal2') return 'verified';
  // nextLevel aal2 → hay un factor inscrito pendiente de challenge
  if (data.nextLevel === 'aal2') return 'needs_challenge';
  return 'not_enrolled';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [mfa, setMfa] = useState<MfaState>('unknown');
  const [authz, setAuthz] = useState<MyAuthz>(EMPTY_AUTHZ);

  async function hydrate(next: Session | null) {
    setSession(next);
    if (!next) {
      setMfa('unknown');
      setAuthz(EMPTY_AUTHZ);
      setLoading(false);
      return;
    }
    const m = await readMfaState();
    setMfa(m);
    if (m === 'verified') {
      const { data } = await supabase.rpc('my_authz');
      setAuthz((data as MyAuthz) ?? EMPTY_AUTHZ);
    } else {
      setAuthz(EMPTY_AUTHZ);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => void hydrate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => void hydrate(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      mfa,
      authz,
      refreshAuthz: async () => {
        const m = await readMfaState();
        setMfa(m);
        if (m === 'verified') {
          const { data } = await supabase.rpc('my_authz');
          setAuthz((data as MyAuthz) ?? EMPTY_AUTHZ);
        }
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

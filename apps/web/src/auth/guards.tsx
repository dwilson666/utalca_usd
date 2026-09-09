import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { can, isMemberOf, type Permission } from '@rat/shared';
import { useAuth } from './AuthProvider';

function Splash({ label }: { label: string }) {
  return <div className="authwrap"><p className="muted">{label}</p></div>;
}

/** Sesión + MFA (aal2) obligatorios para TODA la app autenticada. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { loading, session, mfa } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash label="Cargando…" />;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (mfa === 'not_enrolled') return <Navigate to="/mfa/inscribir" replace />;
  if (mfa === 'needs_challenge') return <Navigate to="/mfa/verificar" replace state={{ from: loc.pathname }} />;
  if (mfa !== 'verified') return <Splash label="Verificando segundo factor…" />;
  return <>{children}</>;
}

/** Capa 1 (UX): oculta la ruta si falta el permiso. El backend igual revalida. */
export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { authz } = useAuth();
  if (!can(authz, perm)) return <Navigate to="/no-autorizado" replace />;
  return <>{children}</>;
}

/** Acceso a una unidad concreta (miembro o institucional). El :unitId viene de la URL. */
export function RequireUnitAccess({ children }: { children: ReactNode }) {
  const { authz } = useAuth();
  const { unitId } = useParams();
  // No confiamos en esto para seguridad: si el usuario fuerza la URL, el RPC
  // app.unit_dashboard() responde 404 y las consultas RLS devuelven 0 filas.
  if (!unitId || !isMemberOf(authz, unitId)) return <Navigate to="/no-encontrado" replace />;
  return <>{children}</>;
}

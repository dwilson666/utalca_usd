import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { can, ROLE_LABELS, type RoleCode } from '@rat/shared';
import { useAuth } from '../auth/AuthProvider';
import { BugButton } from './BugButton';
import { ThemeToggle } from './ThemeToggle';
import { AppMark } from './Logo';

/** Sin selector de rol (D13): el rol y la vista se derivan del usuario autenticado. */
export function AppShell() {
  const { authz, session, signOut } = useAuth();
  const institutional = can(authz, 'institutional.view');
  const roleLabel = deriveRoleLabel(authz);
  const loc = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // cerrar el cajón al navegar y con la tecla Escape
  useEffect(() => setMenuOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="shell">
      <div
        className={`sidebar-scrim${menuOpen ? ' is-open' : ''}`}
        onClick={closeMenu}
        aria-hidden
      />

      <aside className={`sidebar${menuOpen ? ' is-open' : ''}`} id="nav-cajon">
        <div className="brand">
          <AppMark />
        </div>

        {institutional && (
          <NavLink to="/institucional" className={navcls} onClick={closeMenu}>
            Tablero institucional
          </NavLink>
        )}

        {authz.units.length > 0 && <div className="grp">Mis unidades</div>}
        {authz.units.map((u) => (
          <NavLink key={u.unit_id} to={`/unidad/${u.unit_id}`} className={navcls} onClick={closeMenu}>
            {u.name}
            {u.unit_role === 'jefe' && <span className="muted"> · jefe</span>}
          </NavLink>
        ))}

        <div className="grp">RAT</div>
        <NavLink to="/actividades" className={navcls} onClick={closeMenu}>Actividades</NavLink>
        {can(authz, 'activity.review') && (
          <NavLink to="/revision" className={navcls} onClick={closeMenu}>Revisión</NavLink>
        )}
        {can(authz, 'audit.read') && (
          <NavLink to="/auditoria" className={navcls} onClick={closeMenu}>Auditoría</NavLink>
        )}
        {can(authz, 'tracking.read.all') && (
          <NavLink to="/seguimiento" className={navcls} onClick={closeMenu}>Seguimiento</NavLink>
        )}
        {authz.institutional && (
          <NavLink to="/reportes" className={navcls} onClick={closeMenu}>Reportes de errores</NavLink>
        )}

        {can(authz, 'user.manage') && (
          <>
            <div className="grp">Administración</div>
            <NavLink to="/admin/usuarios" className={navcls} onClick={closeMenu}>Usuarios y roles</NavLink>
            {can(authz, 'unit.manage') && (
              <NavLink to="/admin/unidades" className={navcls} onClick={closeMenu}>Unidades</NavLink>
            )}
            {can(authz, 'config.manage') && (
              <NavLink to="/admin/catalogos" className={navcls} onClick={closeMenu}>Catálogos</NavLink>
            )}
          </>
        )}

        <div className="sidebar-foot">
          <span className="grp" style={{ padding: '0 0 6px' }}>Tema</span>
          <ThemeToggle />
        </div>
      </aside>

      <div>
        <div className="topbar">
          <button
            type="button"
            className="navtoggle"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="nav-cajon"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
          <span className="rolebadge">{roleLabel}</span>
          <div className="spacer" />
          <ThemeToggle />
          <BugButton />
          <span className="topbar-email mono">{session?.user.email}</span>
          <button className="btn btn--ghost" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const navcls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

function deriveRoleLabel(authz: ReturnType<typeof useAuth>['authz']): string {
  // Deducido de los permisos (no de un claim manipulable).
  const p = new Set(authz.permissions);
  const order: Array<[RoleCode, () => boolean]> = [
    ['superadmin', () => p.has('role.manage') && p.has('unit.manage')],
    ['dpd_admin', () => p.has('activity.review') && p.has('institutional.view')],
    ['auditor', () => p.has('institutional.view') && !p.has('activity.create')],
    ['unit_manager', () => authz.units.some((u) => u.unit_role === 'jefe')],
    ['collaborator', () => true],
  ];
  for (const [code, test] of order) if (test()) return ROLE_LABELS[code];
  return 'Usuario';
}

import { NavLink, Outlet } from 'react-router-dom';
import { can, ROLE_LABELS, type RoleCode } from '@rat/shared';
import { useAuth } from '../auth/AuthProvider';

/** Sin selector de rol (D13): el rol y la vista se derivan del usuario autenticado. */
export function AppShell() {
  const { authz, session, signOut } = useAuth();
  const institutional = can(authz, 'institutional.view');
  const roleLabel = deriveRoleLabel(authz);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">R</div>
          <div>
            <b style={{ display: 'block' }}>RAT</b>
            <span style={{ fontSize: 11, color: 'rgba(233,238,244,.65)' }}>Universidad de Talca</span>
          </div>
        </div>

        {institutional && (
          <NavLink to="/institucional" className={navcls}>
            Tablero institucional
          </NavLink>
        )}

        {authz.units.length > 0 && <div className="grp">Mis unidades</div>}
        {authz.units.map((u) => (
          <NavLink key={u.unit_id} to={`/unidad/${u.unit_id}`} className={navcls}>
            {u.name}
            {u.unit_role === 'jefe' && <span className="muted"> · jefe</span>}
          </NavLink>
        ))}

        <div className="grp">RAT</div>
        <NavLink to="/actividades" className={navcls}>Actividades</NavLink>
        {can(authz, 'activity.review') && (
          <NavLink to="/revision" className={navcls}>Revisión</NavLink>
        )}
        {can(authz, 'audit.read') && <NavLink to="/auditoria" className={navcls}>Auditoría</NavLink>}
        {can(authz, 'tracking.read.all') && (
          <NavLink to="/seguimiento" className={navcls}>Seguimiento</NavLink>
        )}

        {can(authz, 'user.manage') && (
          <>
            <div className="grp">Administración</div>
            <NavLink to="/admin/usuarios" className={navcls}>Usuarios y roles</NavLink>
            {can(authz, 'unit.manage') && (
              <NavLink to="/admin/unidades" className={navcls}>Unidades</NavLink>
            )}
            {can(authz, 'config.manage') && (
              <NavLink to="/admin/catalogos" className={navcls}>Catálogos</NavLink>
            )}
          </>
        )}
      </aside>

      <div>
        <div className="topbar">
          <span className="rolebadge">{roleLabel}</span>
          <div className="spacer" />
          <span className="muted mono" style={{ fontSize: 12 }}>{session?.user.email}</span>
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

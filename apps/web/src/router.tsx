import { Navigate, createBrowserRouter } from 'react-router-dom';
import { landingRoute } from '@rat/shared';
import { AppShell } from './components/AppShell';
import { RequirePermission, RequireSession, RequireUnitAccess } from './auth/guards';
import { useAuth } from './auth/AuthProvider';
import { Login } from './pages/Login';
import { MfaEnroll } from './pages/MfaEnroll';
import { MfaChallenge } from './pages/MfaChallenge';
import { InstitutionalDashboard } from './pages/InstitutionalDashboard';
import { UnitDashboard } from './pages/UnitDashboard';
import { ActivitiesList } from './pages/ActivitiesList';
import { ActivityDetail } from './pages/ActivityDetail';
import { ActivityWizard } from './pages/ActivityWizard';
import { ReviewInbox } from './pages/ReviewInbox';
import { ReviewDetail } from './pages/ReviewDetail';
import { BugReports } from './pages/BugReports';
import { AdminUsers } from './pages/admin/Users';
import { AdminCatalogs } from './pages/admin/Catalogs';
import { AdminUnits } from './pages/admin/Units';
import { NoUnit, NotFound, SimplePage, Unauthorized } from './pages/Misc';

function Home() {
  const { authz, loading } = useAuth();
  if (loading || !authz.user_id) {
    return <div className="authwrap"><p className="muted">Cargando…</p></div>;
  }
  return <Navigate to={landingRoute(authz)} replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/mfa/inscribir', element: <MfaEnroll /> },
  { path: '/mfa/verificar', element: <MfaChallenge /> },
  { path: '/sin-unidad', element: <NoUnit /> },
  {
    path: '/',
    element: (
      <RequireSession>
        <AppShell />
      </RequireSession>
    ),
    children: [
      { index: true, element: <Home /> },
      {
        path: 'institucional',
        element: (
          <RequirePermission perm="institutional.view">
            <InstitutionalDashboard />
          </RequirePermission>
        ),
      },
      {
        path: 'unidad/:unitId',
        element: (
          <RequireUnitAccess>
            <UnitDashboard />
          </RequireUnitAccess>
        ),
      },
      { path: 'actividades', element: <ActivitiesList /> },
      {
        path: 'actividades/nueva',
        element: (
          <RequirePermission perm="activity.create">
            <ActivityWizard />
          </RequirePermission>
        ),
      },
      { path: 'actividades/:id', element: <ActivityDetail /> },
      {
        path: 'actividades/:id/editar',
        element: (
          <RequirePermission perm="activity.update.own_unit">
            <ActivityWizard />
          </RequirePermission>
        ),
      },
      {
        path: 'revision',
        element: (
          <RequirePermission perm="activity.review">
            <ReviewInbox />
          </RequirePermission>
        ),
      },
      {
        path: 'revision/:id',
        element: (
          <RequirePermission perm="activity.review">
            <ReviewDetail />
          </RequirePermission>
        ),
      },
      {
        path: 'auditoria',
        element: (
          <RequirePermission perm="audit.read">
            <SimplePage title="Consola de auditoría" note="Registro inmutable." />
          </RequirePermission>
        ),
      },
      {
        path: 'seguimiento',
        element: (
          <RequirePermission perm="tracking.read.all">
            <SimplePage title="Seguimiento del levantamiento" note="Módulo separado del RAT." />
          </RequirePermission>
        ),
      },
      {
        path: 'reportes',
        element: (
          <RequirePermission perm="institutional.view">
            <BugReports />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/usuarios',
        element: (
          <RequirePermission perm="user.manage">
            <AdminUsers />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/unidades',
        element: (
          <RequirePermission perm="unit.manage">
            <AdminUnits />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/catalogos',
        element: (
          <RequirePermission perm="config.manage">
            <AdminCatalogs />
          </RequirePermission>
        ),
      },
      { path: 'no-autorizado', element: <Unauthorized /> },
      { path: 'no-encontrado', element: <NotFound /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

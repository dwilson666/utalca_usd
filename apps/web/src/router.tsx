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
import { NoUnit, NotFound, SimplePage, Unauthorized, WizardStub } from './pages/Misc';

function Home() {
  const { authz } = useAuth();
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
      { path: 'actividades/:id', element: <ActivityDetail /> },
      { path: 'actividades/:id/editar', element: <WizardStub /> },
      {
        path: 'revision',
        element: (
          <RequirePermission perm="activity.review">
            <SimplePage title="Bandeja de revisión" note="Cola de actividades EN_REVISION / CORREGIDO." />
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
        path: 'admin/usuarios',
        element: (
          <RequirePermission perm="user.manage">
            <SimplePage title="Usuarios y roles" note="Alta por invitación (Edge Function users-invite)." />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/unidades',
        element: (
          <RequirePermission perm="unit.manage">
            <SimplePage title="Unidades" note="Árbol organizacional · nodos por revisar." />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/catalogos',
        element: (
          <RequirePermission perm="config.manage">
            <SimplePage title="Catálogos" note="Vocabularios controlados." />
          </RequirePermission>
        ),
      },
      { path: 'no-autorizado', element: <Unauthorized /> },
      { path: 'no-encontrado', element: <NotFound /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

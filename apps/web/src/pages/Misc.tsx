import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';

export function NoUnit() {
  return (
    <div className="authwrap">
      <div className="authcard">
        <h2 style={{ fontSize: 18 }}>Sin unidad asignada</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Su cuenta aún no está asociada a ninguna unidad. Contacte a la Oficina de Seguridad Digital
          para que le asignen una.
        </p>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <>
      <PageHeader title="No encontrado" sub="El recurso no existe o no está dentro de su alcance." />
      <Link className="btn" to="/">
        Volver al inicio
      </Link>
    </>
  );
}

export function Unauthorized() {
  return (
    <>
      <PageHeader
        title="Sin autorización"
        sub="Su rol no permite acceder a esta sección."
      />
      <Link className="btn" to="/">
        Volver al inicio
      </Link>
    </>
  );
}

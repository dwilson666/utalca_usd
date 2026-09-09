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

/** Marcador — el asistente de 9 pasos se implementa en el siguiente incremento. */
export function WizardStub() {
  return (
    <>
      <PageHeader
        title="Editor de actividad (asistente)"
        sub="Pendiente — incremento 4a.2. El detalle de solo lectura y las transiciones ya funcionan."
      />
      <div className="callout">
        El formulario tipo wizard de 9 pasos (Fase 3 §5.7) se conecta a las tablas
        <code> activity_* </code> con validación Zod compartida (<code>@rat/shared</code>).
      </div>
    </>
  );
}

export function SimplePage({ title, note }: { title: string; note: string }) {
  return (
    <>
      <PageHeader title={title} sub={note} />
      <div className="callout">Módulo pendiente en este incremento.</div>
    </>
  );
}

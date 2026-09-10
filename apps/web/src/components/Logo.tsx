/**
 * Marca Universidad de Talca — reconstrucción vectorial del manual de marca.
 *   Isotipo: escudo (U) con el negativo en forma de T.
 *   El color se toma de `currentColor`: en superficies claras se usa el rojo
 *   institucional; en fondos oscuros, blanco monocromático
 *   ("en fondos oscuros sólo esta opción de Marca es válida", manual p.11).
 */

const SHIELD = (
  <>
    {/* barra superior */}
    <rect x="0" y="0" width="100" height="29" />
    {/* cuerpo en U con el hueco vertical de la T (fill-rule evenodd) */}
    <path
      fillRule="evenodd"
      d="M0 37 L0 68 Q0 102 34 102 L66 102 Q100 102 100 68 L100 37 Z
         M34 37 L34 74 Q34 80 40 80 L60 80 Q66 80 66 74 L66 37 Z"
    />
  </>
);

/** Isotipo solo. Hereda el color de `currentColor` salvo que se pase `color`. */
export function Isotype({ size = 28, color }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size * 1.02}
      viewBox="0 0 100 102"
      role="img"
      aria-label="Universidad de Talca"
      fill={color ?? 'currentColor'}
    >
      {SHIELD}
    </svg>
  );
}

/** Lockup completo: isotipo + TALCA / UNIVERSIDAD. Hereda `currentColor`. */
export function Wordmark({ size = 40 }: { size?: number }) {
  const w = size * 2.9;
  return (
    <svg
      width={w}
      height={size * 1.55}
      viewBox="0 0 290 155"
      role="img"
      aria-label="Universidad de Talca"
      fill="currentColor"
    >
      <g transform="translate(96 0)">{SHIELD}</g>
      <text
        x="145"
        y="128"
        textAnchor="middle"
        fontFamily="var(--f-display)"
        fontWeight="700"
        fontSize="34"
        letterSpacing="3"
      >
        TALCA
      </text>
      <text
        x="145"
        y="146"
        textAnchor="middle"
        fontFamily="var(--f-display)"
        fontWeight="700"
        fontSize="15.5"
        letterSpacing="4.6"
      >
        UNIVERSIDAD
      </text>
    </svg>
  );
}

/** Marca de la app: isotipo + "RAT" + subtítulo. Para la barra lateral. */
export function AppMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <Isotype size={26} />
      <div style={{ lineHeight: 1.15 }}>
        <b style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15, letterSpacing: '.06em' }}>
          RAT
        </b>
        <span style={{ display: 'block', fontSize: 10.5, opacity: 0.7, letterSpacing: '.02em' }}>
          Universidad de Talca
        </span>
      </div>
    </div>
  );
}

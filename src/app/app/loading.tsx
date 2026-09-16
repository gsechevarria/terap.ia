/**
 * Cubre toda la app del paciente. Sin esto, tocar una pestaña en el móvil deja
 * la pantalla anterior congelada hasta que responde el servidor: con datos
 * móviles se percibe como que la aplicación se ha quedado colgada.
 *
 * El esqueleto imita la composición real —saludo, bloque de sesión, filas— en
 * lugar de una rueda girando, para que el salto al contenido no mueva la
 * página entera.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="tp-sr-only">Cargando…</span>

      <div className="tp-greeting">
        <div style={{ flex: 1 }}>
          <div className="tp-skeleton" style={{ height: 11, width: 130 }} />
          <div
            className="tp-skeleton"
            style={{ height: 32, width: "62%", marginTop: 12 }}
          />
        </div>
        <div
          className="tp-skeleton"
          style={{ height: 43, width: 43, borderRadius: "50%" }}
        />
      </div>

      <div className="tp-skeleton" style={{ height: 210, borderRadius: 21 }} />

      <div style={{ marginTop: 32 }}>
        <div className="tp-skeleton" style={{ height: 19, width: 170 }} />
        <div
          className="tp-skeleton"
          style={{ height: 75, marginTop: 22, borderRadius: 14 }}
        />
      </div>

      <div style={{ marginTop: 32 }}>
        <div className="tp-skeleton" style={{ height: 19, width: 150 }} />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="tp-skeleton"
            style={{ height: 60, marginTop: 16, borderRadius: 13 }}
          />
        ))}
      </div>
    </div>
  );
}

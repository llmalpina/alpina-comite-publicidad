import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import RutaAlpina from "./RutaAlpina.jsx";

/**
 * Indicador de carga con el logo de Alpina, anillo animado y mensajes que van
 * rotando para que la espera no se sienta congelada.
 *
 * Debajo va la RUTA: el recorrido de la leche de la finca al punto de venta. Una
 * vuelta completa del recorrido dura lo mismo que una vuelta de los mensajes
 * (`mensajes x rotateMs`), asi el camion y el texto cuentan lo mismo. Cuando hay un
 * solo mensaje (prop `text`) no hay ciclo de mensajes del cual colgarse y se usa un
 * ciclo fijo de 9s.
 *
 * `variant="page"`  -> carga de una pagina completa (logo grande, mas aire)
 * `variant="panel"` -> carga de una seccion dentro de un panel (compacto)
 *
 * `ruta={false}` la desactiva en sitios muy angostos.
 */
const MENSAJES_POR_DEFECTO = [
  "Cargando datos de acopio…",
  "Preparando series por quincena…",
  "Calculando litros por día…",
  "Casi listo…",
];

export default function Loader({
  text,
  messages,
  variant = "panel",
  rotateMs = 1300,
  ruta = true,
  logoSrc = `${import.meta.env.BASE_URL}assets/logos/Logo_azul_oscuro_alpina.png`,
}) {
  const msgs = text ? [text] : (messages?.length ? messages : MENSAJES_POR_DEFECTO);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (msgs.length < 2) return undefined;
    const id = setInterval(() => setIdx(i => (i + 1) % msgs.length), rotateMs);
    return () => clearInterval(id);
  }, [msgs.length, rotateMs]);

  return (
    <div className={`loader loader--${variant}`} role="status" aria-live="polite">
      <div className="loader__mark">
        <svg className="loader__ring" viewBox="0 0 50 50" aria-hidden="true">
          <circle className="loader__ring-track" cx="25" cy="25" r="21" />
          <circle className="loader__ring-arc" cx="25" cy="25" r="21" />
        </svg>
        {logoSrc && <img className="loader__logo" src={logoSrc} alt="" aria-hidden="true" />}
      </div>
      <div className="loader__msg" key={idx}>{msgs[idx]}</div>
      {msgs.length > 1 && (
        <div className="loader__dots" aria-hidden="true">
          {msgs.map((_, i) => (
            <span key={i} className={i === idx ? "is-active" : ""} />
          ))}
        </div>
      )}
      {ruta && (
        <RutaAlpina
          variant={variant}
          cicloMs={msgs.length > 1 ? msgs.length * rotateMs : 5000}
        />
      )}
    </div>
  );
}

Loader.propTypes = {
  text: PropTypes.string,
  messages: PropTypes.arrayOf(PropTypes.string),
  variant: PropTypes.oneOf(["page", "panel"]),
  rotateMs: PropTypes.number,
  /** Recorrido de la leche bajo el loader. Solo se apaga en sitios muy angostos. */
  ruta: PropTypes.bool,
  logoSrc: PropTypes.string,
};

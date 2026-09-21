import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import RutaAlpina from "./RutaAlpina.jsx";

/**
 * Bloqueo global de pantalla (validando sesion, "Conectando con el portal...").
 * Lleva el mismo recorrido de la leche que el Loader: es la PRIMERA pantalla que ve
 * el usuario al entrar, asi que es donde mas rinde la identidad de marca.
 */
export function LoadingOverlay({
  open = true,
  text,
  messages,
  rotateMs = 1300,
  ruta = true,
  // BASE_URL y no una ruta relativa: con la app servida desde un subpath, "./assets/..."
  // se resuelve contra la URL actual y el logo desaparece.
  logoSrc = `${import.meta.env.BASE_URL}assets/logos/Logo_azul_oscuro_alpina.png`,
}) {
  // Acepta `text` (un solo mensaje) o `messages` (rotativos). open por defecto true:
  // las paginas lo usan como `return <LoadingOverlay text="..." />` mientras cargan.
  const msgs = text ? [text] : (messages && messages.length ? messages : ["Cargando..."]);
  const [idx, setIdx] = useState(0);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (!open || msgs.length < 2) return;
    const id = setInterval(() => {
      setOpacity(0);
      setTimeout(() => {
        setIdx((i) => (i + 1) % msgs.length);
        setOpacity(1);
      }, 200);
    }, rotateMs);
    return () => clearInterval(id);
  }, [open, msgs, rotateMs]);

  if (!open) return null;
  const node = (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-overlay__card">
        {logoSrc && <img className="loading-overlay__logo" src={logoSrc} alt="Alpina" />}
        <svg className="loading-spinner" viewBox="0 0 50 50" aria-label="Cargando">
          <circle className="spinner-track" cx="25" cy="25" r="20" />
          <circle className="spinner-arc" cx="25" cy="25" r="20" />
        </svg>
        <div className="loading-overlay__msg" style={{ opacity }}>
          {msgs[idx]}
        </div>
        {ruta && (
          <RutaAlpina
            variant="page"
            cicloMs={msgs.length > 1 ? msgs.length * rotateMs : 5000}
          />
        )}
      </div>
    </div>
  );
  return createPortal(node, document.body);
}

LoadingOverlay.propTypes = {
  open: PropTypes.bool,
  text: PropTypes.string,
  messages: PropTypes.arrayOf(PropTypes.string),
  rotateMs: PropTypes.number,
  ruta: PropTypes.bool,
  logoSrc: PropTypes.string,
};

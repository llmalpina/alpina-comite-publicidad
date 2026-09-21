import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Recorrido animado de la leche — de la finca al punto de venta — que acompana al
 * Loader mientras llegan los datos.
 *
 * La narrativa es la del negocio: el camion de ACOPIO recorre la via dejando la finca
 * y la leche cruda, llega a la PLANTA y ahi el relevo lo toma el camion de
 * DISTRIBUCION, que deja los productos terminados y remata en la tienda. Cada hito
 * aparece cuando el camion ya paso por el y la via se va pintando detras: eso es lo
 * que hace las veces de barra de progreso.
 *
 * SINCRONIA CON EL LOADER: un ciclo completo del recorrido dura exactamente lo que
 * dura una vuelta de los mensajes rotativos (`cicloMs`), asi el camion y el texto
 * cuentan lo mismo. El avance es continuo, no a saltos por mensaje, para que se vea
 * al camion dejando cada cosa a su paso.
 *
 * POR QUE TODO SE ANIMA EN CSS: el unico valor que cambia por frame es la variable
 * `--p` (0..1), que se escribe sobre el nodo con requestAnimationFrame. La aparicion
 * de cada hito sale de `clamp(0, (var(--p) - var(--x)) * k, 1)`, que la propia CSS
 * resuelve. Asi la animacion corre a 60fps sin re-renderizar React ni una sola vez
 * (un setState por frame en un loader -que se monta en cada carga- se siente).
 *
 * En movil el lienzo es mas ancho que la pantalla y se desplaza en sentido contrario
 * al camion (camara que lo sigue): se ven 3-4 hitos grandes en vez de 6 diminutos, y
 * la pagina nunca gana scroll horizontal.
 */
const BASE = `${import.meta.env.BASE_URL}assets/proceso/`;

/**
 * `x` es la posicion sobre la via, de 0 (salida) a 1 (tienda).
 * `esc` compensa que los assets no comparten proporcion: los productos son fotos de
 * envase (altos y con mucho detalle) y al mismo alto que la vaca o la planta se
 * comian el recorrido. Es un factor sobre `--figura`, no un tamano absoluto, para
 * que siga escalando solo entre escritorio, panel y movil.
 */
const HITOS = [
  { id: 'vaca',     archivo: 'vaca.png',     etiqueta: 'Finca',       x: 0.12, esc: 1 },
  { id: 'leche',    archivo: 'leche.png',    etiqueta: 'Leche cruda', x: 0.28, esc: 0.82 },
  { id: 'planta',   archivo: 'planta.png',   etiqueta: 'Planta',      x: 0.48, esc: 0.95 },
  { id: 'arequipe', archivo: 'arequipe.png', etiqueta: 'Arequipe',    x: 0.65, esc: 0.68 },
  { id: 'bonyurt',  archivo: 'bonyurt.png',  etiqueta: 'Bon Yurt',    x: 0.79, esc: 0.78 },
  // La tienda NO puede ir en x=1: su aparicion es (--p - --x), y con --p llegando
  // justo a 1 esa resta nunca se vuelve positiva -> la tienda no se veia NUNCA.
  // Medido: quedaba en opacidad 0 y desplazada 12px hacia abajo, pisando la via.
  { id: 'tienda',   archivo: 'tienda.png',   etiqueta: 'Tienda',      x: 0.93, esc: 0.95 },
];

/* En la planta se hace el relevo de camion. Debe coincidir con el 0.5 del CSS. */
const X_PLANTA = 0.5;

const prefiereQuietud = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function RutaAlpina({ cicloMs = 5200, variant = 'page' }) {
  const ref = useRef(null);
  // Las imagenes son assets de marca servidos desde /public. Si alguna todavia no
  // esta cargada en el proyecto, el hito no debe verse roto: cae a un punto de color
  // y el recorrido se sigue entendiendo.
  const [fallidas, setFallidas] = useState({});
  const marcarFallo = id => setFallidas(f => (f[id] ? f : { ...f, [id]: true }));

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return undefined;

    // Sin movimiento: se muestra el recorrido completo, que es informativo por si solo.
    if (prefiereQuietud()) {
      nodo.style.setProperty('--p', '1');
      return undefined;
    }

    const ciclo = Math.max(2000, cicloMs);
    let raf = 0;
    let t0 = null;
    const paso = (t) => {
      if (t0 === null) t0 = t;
      nodo.style.setProperty('--p', String(((t - t0) % ciclo) / ciclo));
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [cicloMs]);

  const figura = (id, archivo, extra = '') => (
    fallidas[id]
      ? <span className={`ruta__punto ${extra}`} />
      : <img src={`${BASE}${archivo}`} alt="" onError={() => marcarFallo(id)} />
  );

  return (
    <div className={`ruta ruta--${variant}`} ref={ref} aria-hidden="true">
      <div className="ruta__lienzo">
        <div className="ruta__via" />
        <div className="ruta__avance" />

        {/* --x va como String a proposito: es una custom property y debe viajar sin
            unidades; no conviene depender de como React serialice un number. */}
        {HITOS.map(h => (
          <div
            key={h.id}
            className="ruta__hito"
            style={{ '--x': String(h.x), '--esc': String(h.esc) }}
          >
            <div className="ruta__figura">{figura(h.id, h.archivo)}</div>
            <span className="ruta__etiqueta">{h.etiqueta}</span>
          </div>
        ))}

        {/* Los dos camiones se montan siempre y se cruzan por opacidad en la planta:
            cambiar el `src` a mitad de animacion provocaria un parpadeo mientras el
            navegador decodifica la otra imagen. */}
        <div className="ruta__camion">
          <span className="ruta__camion-cara ruta__camion-cara--acopio">
            {figura('camion-acopio', 'camion-acopio.png', 'ruta__punto--camion')}
          </span>
          <span className="ruta__camion-cara ruta__camion-cara--dist">
            {figura('camion-distribucion', 'camion-distribucion.png', 'ruta__punto--camion')}
          </span>
        </div>
      </div>
    </div>
  );
}

RutaAlpina.propTypes = {
  /** Duracion de una vuelta completa. El Loader manda `mensajes * rotateMs`. */
  cicloMs: PropTypes.number,
  variant: PropTypes.oneOf(['page', 'panel']),
};

/* Se exporta de las dos formas a proposito: este proyecto importa por defecto y el kit
   de la skill `diseno-dashboard-alpina` reexporta por nombre desde components/ui. Asi
   el archivo es EL MISMO en ambos y no hay que mantener dos versiones. */
export { RutaAlpina, X_PLANTA };

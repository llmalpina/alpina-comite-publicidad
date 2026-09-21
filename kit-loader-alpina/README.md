# Kit Loader Alpina — pantalla de carga con el recorrido de la leche

Indicador de carga de marca: logo Alpina, anillo animado, mensajes rotativos y, debajo,
el **recorrido de la leche** — el camión de acopio deja la finca y la leche cruda, llega a
la planta, ahí lo releva el camión de distribución, que deja los productos terminados y
remata en la tienda. La vía se pinta de azul detrás del camión: **ese trazo es la barra de
progreso**.

Stack: **React 18 + CSS plano**. No usa Tailwind, ni librerías de animación, ni de UI.

---

## Son tres piezas, no una

| Archivo | Qué es | ¿Obligatorio? |
|---|---|---|
| `RutaAlpina.jsx` | **Solo el recorrido**: la vía, las figuras y el camión. No sabe nada de "cargando". | Sí |
| `Loader.jsx` | El **cargando** completo: logo + anillo + mensajes rotativos, y monta la ruta adentro. Es el que se usa en las páginas y paneles. | Sí |
| `LoadingOverlay.jsx` | El mismo cargando pero **a pantalla completa con fondo**, para bloqueos globales (validando sesión, "Conectando con el portal…"). | Opcional |

`RutaAlpina` por sí sola no muestra ningún mensaje. Si solo copian ese archivo, tendrán la
animación pero no el indicador de carga.

---

## Instalación

1. **Dependencia:** `npm install prop-types` (lo único que hace falta, además de React).

2. **Componentes:** copiar `src/*.jsx` a la carpeta de componentes del proyecto
   (p. ej. `src/components/ui/`). Los tres archivos deben quedar **juntos**: `Loader` y
   `LoadingOverlay` importan `./RutaAlpina.jsx`.

3. **Estilos:** pegar `loader-alpina.css` al final del CSS global, o importarlo una vez
   desde `main.jsx`. Si el proyecto ya tiene la paleta Alpina, borrar el bloque `:root`
   del inicio del archivo y dejar el resto.

4. **Imágenes:** copiar `public/assets/` completo a la carpeta `public/` del proyecto.
   Los nombres son parte del contrato — si alguno no coincide, ese hito se dibuja como un
   punto azul en vez de romperse:

   ```
   public/assets/proceso/   vaca.png  leche.png  planta.png
                            camion-acopio.png  camion-distribucion.png
                            arequipe.png  bonyurt.png  tienda.png
   public/assets/logos/     Logo_azul_oscuro_alpina.png
   ```

---

## Uso

```jsx
import Loader from "./components/ui/Loader.jsx";

// Página completa, mientras llega el primer dataset
if (!data) return <Loader variant="page" messages={[
  "Cargando datos de acopio…",
  "Preparando series por quincena…",
  "Calculando litros por día…",
]} />;

// Dentro de un panel o una tabla (versión compacta, sin etiquetas)
{cargando ? <Loader text="Cargando el detalle…" /> : <Tabla … />}
```

```jsx
import { LoadingOverlay } from "./components/ui/LoadingOverlay.jsx";

// Bloqueo global: tapa la pantalla
if (validandoSesion) return <LoadingOverlay text="Conectando con el portal…" />;
```

| Prop | Default | Para qué |
|---|---|---|
| `messages` | 4 mensajes genéricos | Los que rotan. Deben describir **el paso real**, no "Cargando…" repetido. |
| `text` | — | Un solo mensaje fijo (excluyente con `messages`). |
| `variant` | `"panel"` | `"page"` para pantalla completa, `"panel"` para dentro de una tarjeta. |
| `rotateMs` | `1300` | Cada cuánto cambia el mensaje. Un ciclo del recorrido = `mensajes × rotateMs`. |
| `ruta` | `true` | `false` apaga el recorrido en sitios muy angostos. |

**El recorrido va sincronizado con los mensajes**: una vuelta completa dura lo mismo que una
vuelta de los textos, así el camión y lo que se lee cuentan lo mismo. El avance es continuo,
no a saltos, para que se vea al camión soltando cada cosa al pasar por ella.

---

## Cómo ajustarlo

Todo está en dos lugares:

- **Posición y tamaño de cada figura:** el array `HITOS` en `RutaAlpina.jsx`. `x` es la
  posición sobre la vía (0 = salida, 1 = final) y `esc` el factor de tamaño sobre la base.
- **Escala general, colores y separaciones:** las variables al inicio del bloque `.ruta` en
  `loader-alpina.css` — `--figura` (alto base), `--via-y` (altura de la vía), `--margen`
  (aire a los lados) y `--nitidez` (qué tan brusco entra un hito).

---

## Cuatro cosas que parecen de más y no lo son

Las cuatro salieron de medir en un navegador real. **No las "simplifiquen"**, cada una
corrige un defecto concreto:

1. **La imagen va `position: absolute; inset: 0` + `object-fit: contain`.** Ni
   `max-height: 100%` ni `height: 100%` contienen el alto de un `<img>` dentro de una caja
   definida: manda el ancho y el alto crece libre por proporción. Medido, el Bon Yurt
   (78×122 nativo) se dibujaba 36.9×57.7 en una caja de 27px y colgaba **17px por debajo de
   la vía**. Con `inset: 0` la caja de la imagen **es** la del hito.

2. **El último hito no puede ir en `x: 1`.** Su aparición se calcula como `(progreso − x)`,
   y como el progreso llega justo a 1, esa resta nunca se vuelve positiva: la tienda quedaba
   invisible y además desplazada hacia abajo, pisando la vía. Va en `x: 0.93`.

3. **`--margen` a los lados.** Los hitos van centrados en su posición, así que el primero y
   el último dejan media figura fuera y el `overflow: hidden` (necesario para la cámara de
   móvil) se la come.

4. **Figuras arriba de la vía, etiquetas abajo, cada una anclada por su cuenta.** Si se
   maqueta como columna flex con un `gap` calculado, basta que el alto real de una imagen no
   coincida con el previsto para que la línea termine cruzando por la mitad de las figuras.

**Rendimiento:** toda la animación cuelga de una sola variable CSS `--p` (0→1) que se escribe
con `requestAnimationFrame`. La aparición de cada hito la resuelve el propio CSS con
`clamp()`. Corre a 60fps **sin un solo re-render de React** — un `setState` por frame en un
componente que se monta en cada carga se siente.

**Responsive:** por debajo de 768px el lienzo mide 170% del contenedor y se desplaza en
sentido contrario al camión (cámara que lo sigue). Se ven 3-4 hitos grandes en vez de 6
diminutos, y la página nunca gana scroll horizontal.

**Accesibilidad:** el recorrido es decorativo (`aria-hidden`); quien anuncia el estado es el
mensaje del `Loader`, que va en un `role="status"`. Con `prefers-reduced-motion` el camión
deja de trepidar y el recorrido se muestra completo y quieto.

---

## Si la app se sirve desde un subpath

Las rutas de las imágenes se arman con `import.meta.env.BASE_URL` (Vite). Si el proyecto no
usa Vite, hay que reemplazar esa constante por la base correspondiente en `RutaAlpina.jsx`
(`const BASE = …`) y en el `logoSrc` de `Loader.jsx` / `LoadingOverlay.jsx`. **No usar rutas
relativas `./assets/…`**: se resuelven contra la URL actual y las imágenes desaparecen al
navegar.

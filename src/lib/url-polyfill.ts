/**
 * Polyfill para URL.parse() y URL.canParse().
 *
 * react-router-dom v7 usa URL.parse() internamente. Ese método estático es muy
 * reciente (Chrome/Edge 126+, Firefox 126+, Safari 17+, todos de 2024). En
 * navegadores más antiguos no existe y provoca el error:
 *   "URL.parse is not a function"
 * que rompía el render (pantalla en blanco).
 *
 * Este polyfill recrea ambos métodos con `new URL()` (soportado desde hace años),
 * devolviendo null cuando la URL es inválida — exactamente el contrato del método
 * nativo. Se importa como lo PRIMERO en main.tsx para que esté disponible antes
 * de cargar react-router.
 */
(() => {
  if (typeof URL === 'undefined') return;

  // URL.parse(url, base?) -> URL | null
  if (typeof (URL as any).parse !== 'function') {
    (URL as any).parse = function (url: string | URL, base?: string | URL): URL | null {
      try {
        return base !== undefined ? new URL(url as any, base as any) : new URL(url as any);
      } catch {
        return null;
      }
    };
  }

  // URL.canParse(url, base?) -> boolean
  if (typeof (URL as any).canParse !== 'function') {
    (URL as any).canParse = function (url: string | URL, base?: string | URL): boolean {
      try {
        // eslint-disable-next-line no-new
        base !== undefined ? new URL(url as any, base as any) : new URL(url as any);
        return true;
      } catch {
        return false;
      }
    };
  }
})();

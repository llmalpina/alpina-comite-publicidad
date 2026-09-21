/**
 * Tipos para el kit de loader de marca (componentes .jsx con PropTypes).
 * Permite importarlos desde archivos .tsx con tipado básico.
 */
declare module '*/components/ui/Loader' {
  import * as React from 'react';
  export interface LoaderProps {
    text?: string;
    messages?: string[];
    variant?: 'page' | 'panel';
    rotateMs?: number;
    ruta?: boolean;
    logoSrc?: string;
  }
  const Loader: React.FC<LoaderProps>;
  export default Loader;
}

declare module '*/components/ui/LoadingOverlay' {
  import * as React from 'react';
  export interface LoadingOverlayProps {
    open?: boolean;
    text?: string;
    messages?: string[];
    rotateMs?: number;
    ruta?: boolean;
    logoSrc?: string;
  }
  export const LoadingOverlay: React.FC<LoadingOverlayProps>;
}

declare module '*/components/ui/RutaAlpina' {
  import * as React from 'react';
  export interface RutaAlpinaProps {
    cicloMs?: number;
    variant?: 'page' | 'panel';
  }
  const RutaAlpina: React.FC<RutaAlpinaProps>;
  export default RutaAlpina;
  export { RutaAlpina };
  export const X_PLANTA: number;
}

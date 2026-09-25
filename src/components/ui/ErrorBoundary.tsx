import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Callback opcional al reintentar (ej: recargar datos) */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  online: boolean;
}

/**
 * Captura errores de render para evitar la "pantalla en blanco".
 *
 * Si el navegador está sin conexión (o el error parece de red), muestra un
 * mensaje de "señal de internet baja" con opción de reintentar. Para otros
 * errores muestra un mensaje genérico y permite recargar.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, online: navigator.onLine };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log para diagnóstico (visible en consola del navegador del usuario)
    console.error('[ErrorBoundary] Error de render capturado:', error, info?.componentStack);
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  handleOnline = () => this.setState({ online: true });
  handleOffline = () => this.setState({ online: false });

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  handleReload = () => window.location.reload();

  /** Heurística: ¿el error parece relacionado con red/conexión? */
  private looksLikeNetworkError(): boolean {
    if (!this.state.online) return true;
    const msg = (this.state.error?.message || '').toLowerCase();
    return /network|fetch|failed to fetch|load|chunk|timeout|conexi|internet/.test(msg);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isNetwork = this.looksLikeNetworkError();

    return (
      <div className="flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
          <div className={
            'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ' +
            (isNetwork ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30')
          }>
            {isNetwork
              ? <WifiOff className="text-amber-600 dark:text-amber-400" size={30} />
              : <AlertTriangle className="text-red-600 dark:text-red-400" size={30} />}
          </div>

          {isNetwork ? (
            <>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Problema de conexión
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Parece que tu señal de internet está baja o inestable. Revisa tu conexión
                e intenta de nuevo. La información no se perdió.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Algo salió mal al mostrar esta página
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Ocurrió un error inesperado. Puedes reintentar o recargar la página.
                Si el problema continúa, avísale al equipo de soporte.
              </p>
            </>
          )}

          <div className="flex gap-2 justify-center">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#16293f] transition-colors"
            >
              <RefreshCw size={16} /> Reintentar
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Recargar página
            </button>
          </div>

          {/* Detalle técnico colapsable, útil para soporte */}
          {this.state.error && !isNetwork && (
            <details className="mt-5 text-left">
              <summary className="text-xs text-slate-400 cursor-pointer">Detalle técnico</summary>
              <pre className="mt-2 text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

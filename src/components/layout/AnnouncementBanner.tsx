/**
 * AnnouncementBanner — popup de anuncios/mensajes globales configurables.
 *
 * Muestra un modal al ingresar cuando el anuncio está activo (según la ventana
 * de fechas/horario/días configurada en Admin → Configuración → Anuncios) y el
 * usuario no lo ha marcado como "no volver a mostrar" para esta versión.
 *
 * "No volver a mostrar" se guarda por versión del mensaje en localStorage
 * (`alpina_announcement_seen_<version>`), así que si el admin edita el mensaje y
 * cambia la versión, el popup vuelve a aparecer para todos.
 *
 * Se puede reabrir desde la campana del Header disparando el evento
 * `window` 'alpina:open-announcement'.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Megaphone, AlertTriangle, Wrench, X } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';

const seenKey = (sig: string) => `alpina_announcement_seen_${sig}`;

const TYPE_STYLES = {
  info:        { icon: Megaphone,      accent: '#1450C9', bg: 'bg-blue-50 dark:bg-blue-900/20',   ring: 'border-blue-200' },
  warning:     { icon: AlertTriangle,  accent: '#d97706', bg: 'bg-amber-50 dark:bg-amber-900/20', ring: 'border-amber-200' },
  maintenance: { icon: Wrench,         accent: '#7c3aed', bg: 'bg-violet-50 dark:bg-violet-900/20', ring: 'border-violet-200' },
} as const;

const AnnouncementBanner: React.FC = () => {
  const { announcementConfig, isAnnouncementActive, announcementSignature, loadingConfig } = useConfig();
  const [open, setOpen] = useState(false);
  // Firma del contenido: clave estable para el "no volver a mostrar".
  const sig = announcementSignature();
  const active = !loadingConfig && isAnnouncementActive();
  // Evita reabrir el popup si el usuario ya lo cerró en esta sesión, aunque la
  // config se recargue (localStorage → DynamoDB) y dispare el efecto de nuevo.
  const dismissedThisSession = useRef<Record<string, boolean>>({});

  // Al cargar / cambiar el anuncio: abrir si está activo y no fue descartado.
  useEffect(() => {
    if (!active) { setOpen(false); return; }
    if (dismissedThisSession.current[sig]) return;
    let seen = false;
    try { seen = localStorage.getItem(seenKey(sig)) === '1'; } catch {}
    if (!seen) setOpen(true);
  }, [active, sig]);

  // Permite reabrir desde la campana del Header.
  useEffect(() => {
    const reopen = () => { if (isAnnouncementActive()) setOpen(true); };
    window.addEventListener('alpina:open-announcement', reopen);
    return () => window.removeEventListener('alpina:open-announcement', reopen);
  }, [isAnnouncementActive]);

  if (!open || !active) return null;

  const style = TYPE_STYLES[announcementConfig.type] || TYPE_STYLES.info;
  const Icon = style.icon;

  const close = () => setOpen(false);
  const dismissForever = () => {
    try { localStorage.setItem(seenKey(sig), '1'); } catch {}
    dismissedThisSession.current[sig] = true;
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className={`w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border ${style.ring} overflow-hidden`}>
        <div className={`flex items-start gap-3 p-5 ${style.bg}`}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow" style={{ backgroundColor: style.accent }}>
            <Icon size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white break-words">{announcementConfig.title || 'Aviso'}</h2>
          </div>
          <button onClick={close} className="p-1 rounded-lg text-slate-400 hover:bg-black/10" title="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{announcementConfig.message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          {announcementConfig.dismissible && (
            <button onClick={dismissForever} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              No volver a mostrar
            </button>
          )}
          <button onClick={close} className="px-4 py-2 text-xs font-bold text-white rounded-lg" style={{ backgroundColor: style.accent }}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementBanner;

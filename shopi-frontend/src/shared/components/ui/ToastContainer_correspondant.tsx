/*
 * ════════════════════════════════════════════════════════
 * FICHIER : src/shared/components/ui/ToastContainer.tsx
 * ORDRE   : 6 — Composant UI partagé, monté une seule
 *           fois dans CorrespondantApp.tsx
 * RÔLE    : Affiche les notifications toast en bas à
 *           droite de l'écran. Reçoit le tableau de
 *           toasts depuis le hook useToast.
 * ════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import type { Toast } from '../../hooks/useToast_correspondant';

const ICONS: Record<string, string> = {
  s: 'fa-check-circle',
  i: 'fa-circle-info',
  w: 'fa-triangle-exclamation',
  e: 'fa-circle-xmark',
};

/** Un seul toast animé */
const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Double rAF pour déclencher la transition CSS après le mount
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setVisible(true))
    );
    const timeout = setTimeout(() => setVisible(false), 3000);
    return () => { cancelAnimationFrame(raf); clearTimeout(timeout); };
  }, []);

  return (
    <div
      className={`tmsg ${toast.type}`}
      style={{
        background: 'var(--navy)',
        color: 'rgba(200,217,248,.95)',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 'var(--r-lg)',
        padding: '11px 17px',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        boxShadow: '0 16px 48px rgba(11,31,58,.3)',
        maxWidth: 320,
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'all .32s cubic-bezier(.34,1.56,.64,1)',
      }}
    >
      <i
        className={`fas ${ICONS[toast.type] || ICONS.i}`}
        style={{
          fontSize: 14,
          flexShrink: 0,
          color: toast.type === 's' ? '#10B981'
               : toast.type === 'i' ? 'var(--blue-lt)'
               : toast.type === 'w' ? '#F59E0B'
               : 'var(--red)',
        }}
      />
      <span>{toast.msg}</span>
    </div>
  );
};

/** Conteneur fixe en bas à droite */
const ToastContainer: React.FC<{ toasts: Toast[] }> = ({ toasts }) => (
  <div
    id="toast-container"
    style={{
      position: 'fixed',
      bottom: 24, right: 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      alignItems: 'flex-end',
    }}
  >
    {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
  </div>
);

export default ToastContainer;
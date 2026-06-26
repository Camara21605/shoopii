/* ============================================================
 * FICHIER : src/shared/components/ui/Toast.tsx
 * RÔLE    : Composant Toast — notification temporaire en bas
 *           de l'écran, utilisé sur la page Login/Register
 * ============================================================ */

import React from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
}

/**
 * Toast
 * Affiche un message de notification centré en bas de l'écran.
 * La visibilité est contrôlée par la prop `visible`.
 */
export const Toast: React.FC<ToastProps> = ({ message, visible }) => {
  return (
    <div
      id="tct"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: 'var(--navy)',
          color: 'rgba(200,217,248,.95)',
          border: '1px solid var(--navy-3)',
          borderRadius: 'var(--pill)',
          padding: '11px 22px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: 'var(--sh-xl)',
          whiteSpace: 'nowrap',
          transform: visible ? 'translateY(0)' : 'translateY(60px)',
          opacity: visible ? 1 : 0,
          transition: 'all .32s var(--ease)',
        }}
      >
        <i className="fas fa-check-circle" style={{ color: 'var(--blue-lt)' }} />
        <span>{message}</span>
      </div>
    </div>
  );
};
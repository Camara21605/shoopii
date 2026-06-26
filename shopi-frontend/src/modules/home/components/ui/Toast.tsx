/* ================================================================
 * src/modules/home/components/ui/Toast.tsx
 *
 * AMÉLIORATIONS :
 *   - Support des types : success | error | warning | info
 *   - Icône et couleur selon le type
 *   - Signature onToast(msg, type?) compatible avec les cards
 * ================================================================ */

import React from 'react';
import styles from './Toast.module.css';

export type ToastType = 's' | 'e' | 'w' | 'i'; // success, error, warning, info

interface ToastProps {
  message: string;
  visible: boolean;
  type?:   ToastType;
}

const TOAST_CONFIG: Record<ToastType, { icon: string; color: string }> = {
  s: { icon: 'fa-circle-check',         color: 'var(--emerald, #059669)' },
  e: { icon: 'fa-circle-xmark',         color: 'var(--red, #DC2626)'     },
  w: { icon: 'fa-triangle-exclamation', color: 'var(--amber, #D97706)'   },
  i: { icon: 'fa-circle-info',          color: 'var(--blue, #1A4FC4)'    },
};

export default function Toast({ message, visible, type = 's' }: ToastProps) {
  const cfg = TOAST_CONFIG[type] ?? TOAST_CONFIG.s;

  return (
    <div
      className={`${styles.toast} ${visible ? styles.visible : ''}`}
      style={{ borderLeft: `3px solid ${cfg.color}` }}
    >
      <i className={`fas ${cfg.icon}`} style={{ color: cfg.color }} />
      <span>{message}</span>
    </div>
  );
}
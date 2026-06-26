// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/components/ToastStack.tsx
//
// Pile de notifications toast (succès, erreur, info, warn).
// Reçoit un tableau de toasts depuis SuperAdminApp et affiche
// chaque toast animé avec auto-disparition.
// ─────────────────────────────────────────────────────────────

import React from 'react';

export interface ToastItem {
  id: number;
  type: string;
  msg: string;
}

interface Props {
  toasts: ToastItem[];
  onRemove: (id: number) => void;
}

const ICONS: Record<string, string> = {
  success: '✅',
  error:   '🔴',
  info:    'ℹ️',
  warn:    '⚠️',
};

export default function ToastStack({ toasts, onRemove }: Props) {
  if (!toasts.length) return null;

  return (
    <div id="toastStack" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast t-${t.type}`}
          onClick={() => onRemove(t.id)}
          style={{ cursor: 'pointer' }}
        >
          <span className="toast-ico">{ICONS[t.type] || 'ℹ️'}</span>
          <span className="toast-msg">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
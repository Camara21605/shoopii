/* ============================================================
 * FICHIER : src/shared/notifications/NotificationToastStack.tsx
 *
 * RÔLE : Toasts temps réel pour les notifications entrantes.
 *
 * Positionnement : fixed top-right, sous la topbar.
 * Durée de vie   : 5 s (géré par NotificationContext, pas ici).
 * ============================================================ */

import React from 'react';
import { useNotifications } from './NotificationContext';
import type { INotificationDto } from './types';
import s from './NotificationToast.module.css';

// ─── Même table de mapping que NotificationCenter ─────────────

interface TypeMeta { icon: string; bg: string; color: string; }

function getTypeMeta(type: string): TypeMeta {
  const prefix = type.split('.')[0];
  const map: Record<string, TypeMeta> = {
    order:   { icon: 'fa-box',          bg: 'rgba(16,185,129,.12)',  color: '#059669' },
    message: { icon: 'fa-comment-dots', bg: 'rgba(22,82,240,.12)',   color: '#1652F0' },
    follow:  { icon: 'fa-user-plus',    bg: 'rgba(124,58,237,.12)',  color: '#7C3AED' },
    product: { icon: 'fa-heart',        bg: 'rgba(236,72,153,.12)',  color: '#DB2777' },
    promo:   { icon: 'fa-percent',      bg: 'rgba(245,158,11,.12)',  color: '#D97706' },
    payment: { icon: 'fa-credit-card',  bg: 'rgba(20,184,166,.12)',  color: '#0D9488' },
    review:  { icon: 'fa-star',         bg: 'rgba(245,158,11,.12)',  color: '#D97706' },
    stock:   { icon: 'fa-warehouse',    bg: 'rgba(239,68,68,.12)',   color: '#DC2626' },
    account: { icon: 'fa-user-check',   bg: 'rgba(16,185,129,.12)',  color: '#059669' },
  };
  return map[prefix] ?? { icon: 'fa-bell', bg: 'rgba(100,100,100,.1)', color: '#6B7280' };
}

// ─── Toast individuel ─────────────────────────────────────────

interface ToastProps {
  notif:     INotificationDto;
  onDismiss: () => void;
}

function Toast({ notif, onDismiss }: ToastProps) {
  const meta = getTypeMeta(notif.type);

  return (
    <div
      className={s.toast}
      role="alert"
      aria-live="assertive"
      onClick={onDismiss}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <span
        className={s.icon}
        style={{ background: meta.bg, color: meta.color }}
        aria-hidden
      >
        <i className={`fas ${meta.icon}`} />
      </span>

      <span className={s.body}>
        <span className={s.title}>{notif.title}</span>
        <span className={s.msg}>{notif.body}</span>
      </span>

      <button
        className={s.close}
        onClick={e => { e.stopPropagation(); onDismiss(); }}
        aria-label="Fermer"
      >
        <i className="fas fa-xmark" />
      </button>

      {/* Barre de progression 5 s */}
      <span
        className={s.progress}
        style={{ background: meta.color }}
        aria-hidden
      />
    </div>
  );
}

// ─── Stack ────────────────────────────────────────────────────

export default function NotificationToastStack() {
  const { toastQueue, dismissToast } = useNotifications();

  if (toastQueue.length === 0) return null;

  return (
    <div className={s.stack} aria-label="Nouvelles notifications">
      {toastQueue.map(n => (
        <Toast
          key={n.id}
          notif={n}
          onDismiss={() => dismissToast(n.id)}
        />
      ))}
    </div>
  );
}

/* ============================================================
 * FICHIER : src/shared/notifications/NotificationToastStack.tsx
 *
 * RÔLE : Toasts temps réel pour les notifications entrantes.
 *
 * Positionnement : fixed top-right, sous la topbar.
 * Durée de vie   : 5 s (géré par NotificationContext, pas ici).
 *
 * CORRECTION :
 *   Cliquer sur un toast navigue désormais vers la page concernée
 *   (avant : clic ne faisait que fermer le toast sans naviguer).
 * ============================================================ */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from './NotificationContext';
import type { INotificationDto } from './types';
import { getNotifMeta, resolveNavTarget } from './notificationUtils';
import s from './NotificationToast.module.css';

// ─── Icône et destination : MÊMES règles que le panneau de la cloche ───
//
// BUG CORRIGÉ — ce fichier avait sa propre copie (divergente) de la
// résolution : un avis reçu par un livreur menait à /produit/<id de la
// commande>, un retrait en attente à /commande/<id du retrait>/suivi.
// Tout passe désormais par notificationUtils (qui suit d'abord la
// destination décidée par le serveur, notif.target).

// ─── Toast individuel ─────────────────────────────────────────

interface ToastProps {
  notif:      INotificationDto;
  onDismiss:  () => void;
  /** Callback de navigation — fourni par NotificationToastStack */
  onNavigate: (notif: INotificationDto) => void;
}

function Toast({ notif, onDismiss, onNavigate }: ToastProps) {
  const meta = getNotifMeta(notif);

  /* Clic sur le corps du toast : fermer + naviguer vers la ressource */
  function handleBodyClick() {
    onDismiss();
    onNavigate(notif);
  }

  const initial = notif.title.charAt(0).toUpperCase();

  return (
    <div
      className={s.toast}
      role="alert"
      aria-live="assertive"
      onClick={handleBodyClick}
      style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
    >
      {/* ── Avatar acteur + badge type (style Facebook) ── */}
      <span className={s.avatarWrap} aria-hidden>
        {notif.imageUrl
          ? <img src={notif.imageUrl} alt="" className={s.avatarImg} />
          : <span className={s.avatarInitial} style={{ background: meta.bg, color: meta.color }}>
              {initial}
            </span>
        }
        <span className={s.typeBadge} style={{ background: meta.color }}>
          <i className={`fas ${meta.icon}`} />
        </span>
      </span>

      <span className={s.body}>
        <span className={s.title}>{notif.title}</span>
        <span className={s.msg}>{notif.body}</span>
      </span>

      {/* Bouton ✕ : ferme le toast SANS naviguer */}
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
  const navigate = useNavigate();
  const { toastQueue, dismissToast } = useNotifications();

  if (toastQueue.length === 0) return null;

  /* URL externe → nouvel onglet ; chemin interne → navigation SPA */
  function handleNavigate(notif: INotificationDto) {
    const target = resolveNavTarget(notif);
    if (target.startsWith('http')) {
      window.open(target, '_blank', 'noopener');
    } else {
      navigate(target);
    }
  }

  return (
    <div className={s.stack} aria-label="Nouvelles notifications">
      {toastQueue.map(n => (
        <Toast
          key={n.id}
          notif={n}
          onDismiss={() => dismissToast(n.id)}
          onNavigate={handleNavigate}
        />
      ))}
    </div>
  );
}

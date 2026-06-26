/*
 * ════════════════════════════════════════════════════════
 * FICHIER : src/shared/components/ui/Toast.tsx
 * ORDRE   : 16 — Composant UI partagé, monté une seule
 *           fois dans HomePage.tsx (bas de page, centré)
 * RÔLE    : Affiche le message toast flottant centré en
 *           bas de l'écran. Reçoit `msg` et `show` depuis
 *           useHomeState. Style Shopi navy/bleu.
 * ════════════════════════════════════════════════════════
 */

import React from 'react';

interface Props {
  msg:  string;
  show: boolean;
}

const Toast: React.FC<Props> = ({ msg, show }) => (
  <div className="toast-wrap">
    <div className={`tmsg${show ? ' show' : ''}`}>
      <i className="fas fa-check-circle" />
      <span>{msg}</span>
    </div>
  </div>
);

export default Toast;

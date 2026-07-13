/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/Toast.tsx
 *
 * Système de toasts locaux.
 * - useToasts() : hook qui gère la liste de toasts (avec auto-expire)
 * - ToastStack  : composant d'affichage empilé
 * ================================================================ */

import { useState, useCallback } from 'react';
import styles from '../styles/Toast.module.css';

/* Type de toast : succès, info ou avertissement */
export type ToastType = 's' | 'i' | 'w';

interface ToastItem { id: number; msg: string; type: ToastType; }

let counter = 0;

/* Hook : expose pop(msg, type?) pour afficher un toast */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  /* Ajoute un toast et le supprime après 2,8 s */
  const pop = useCallback((msg: string, type: ToastType = 'i') => {
    const id = ++counter;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  }, []);

  return { toasts, pop };
}

/* Icônes selon le type */
const ICON: Record<ToastType, string> = {
  s: 'fa-circle-check',
  i: 'fa-circle-info',
  w: 'fa-triangle-exclamation',
};

/* Pile de toasts (positionnée en bas à droite via CSS) */
export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className={styles.stack}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          <i className={`fas ${ICON[t.type]}`} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

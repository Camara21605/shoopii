/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/Toast.tsx
 *
 * Petit système de toasts local au dashboard partenaire.
 * Expose un hook useToasts() + le conteneur ToastStack.
 * ================================================================ */

import { useState, useCallback } from 'react';
import styles from '../styles/Toast.module.css';

export type ToastType = 's' | 'i' | 'w';
interface ToastItem { id: number; msg: string; type: ToastType; }

let counter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pop = useCallback((msg: string, type: ToastType = 'i') => {
    const id = ++counter;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  }, []);

  return { toasts, pop };
}

const ICON: Record<ToastType, string> = {
  s: 'fa-circle-check', i: 'fa-circle-info', w: 'fa-triangle-exclamation',
};

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

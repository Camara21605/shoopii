/*
 * ════════════════════════════════════════════════════════
 * FICHIER : src/shared/hooks/useToast.ts
 * ORDRE   : 4 — Hook partagé, utilisé partout dans l'app
 * RÔLE    : Gère l'état des notifications toast via un
 *           store React simple. Expose `pop(msg, type)`
 *           pour déclencher une notification depuis
 *           n'importe quel composant enfant.
 * ════════════════════════════════════════════════════════
 */

import { useState, useCallback } from 'react';
import type { ToastType } from '../types/index_correspondant';

export interface Toast {
  id: string;
  msg: string;
  type: ToastType;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pop = useCallback((msg: string, type: ToastType = 'i') => {
    const id = Date.now().toString();
    setToasts(prev => [{ id, msg, type }, ...prev]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3400);
  }, []);

  return { toasts, pop };
}
/*
 * FICHIER: src/shared/context/ToastContext.tsx
 * Contexte React pour afficher des notifications Toast dans tout le dashboard
 * Usage: const { pop } = useToast(); pop('Message', 's');
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Toast, ToastType } from '../../dashboards/entreprise/types';

interface ToastContextValue {
  /** Affiche un toast. type: 's'=succès, 'i'=info, 'w'=warning, 'e'=erreur */
  pop: (message: string, type?: ToastType) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pop = useCallback((message: string, type: ToastType = 'i') => {
    const id = crypto.randomUUID();
    setToasts(prev => [{ id, message, type }, ...prev]);
    // Supprime le toast après 3 secondes
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ pop, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}

/** Hook pour utiliser les toasts depuis n'importe quel composant */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
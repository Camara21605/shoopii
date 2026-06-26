/*
 * ════════════════════════════════════════════════════════
 * FICHIER : src/shared/context/AppContext.tsx
 * ORDRE   : 5 — Créé avant App.tsx qui le consomme
 * RÔLE    : Context React global qui partage :
 *           - la fonction `pop` (toast)
 *           - la fonction `gp` (navigation entre pages)
 *           Permet à n'importe quel composant enfant
 *           d'afficher un toast ou de changer de page
 *           sans prop drilling.
 * ════════════════════════════════════════════════════════
 */

import React, { createContext, useContext } from 'react';
import type { PageId, ToastType } from '../types/index_correspondant';

interface AppContextValue {
  pop: (msg: string, type?: ToastType) => void;
  gp:  (id: PageId) => void;
}

export const AppContext = createContext<AppContextValue>({
  pop: () => {},
  gp:  () => {},
});

export const useApp = () => useContext(AppContext);

export const AppContextProvider: React.FC<{
  children: React.ReactNode;
  pop: (msg: string, type?: ToastType) => void;
  gp:  (id: PageId) => void;
}> = ({ children, pop, gp }) => (
  <AppContext.Provider value={{ pop, gp }}>
    {children}
  </AppContext.Provider>
);
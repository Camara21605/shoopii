/* ============================================================
 * FICHIER : src/shared/context/AppContext.tsx
 * ============================================================ */

import React, {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react';
import { tokenStorage } from '../services/apiFetch';
import { authService }  from '../../modules/auth/services/authService';
import type { PublicUser } from '../../modules/auth/types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AppContextValue {
  user:            PublicUser | null;  // ✅ CORRIGÉ : PublicUser au lieu de AuthUser custom
  isAuthenticated: boolean;
  isLoading:       boolean;            // ✅ AJOUTÉ : pendant la vérification du token
  setUser:         (user: PublicUser | null) => void;
  logout:          () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user,      setUserState] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true le temps de vérifier le JWT

  // ── Au démarrage : restaure la session depuis le JWT ──────
  // ✅ AJOUTÉ : sans ça, rafraîchir la page déconnecte l'utilisateur
  useEffect(() => {
    const restore = async () => {
      const token = tokenStorage.get();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        // Vérifie que le JWT est encore valide côté serveur
        const me = await authService.getMe();
        setUserState(me);
      } catch {
        // Token expiré ou invalide → on nettoie
        tokenStorage.remove();
        setUserState(null);
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  // ── Stocker l'utilisateur ─────────────────────────────────
  // ✅ CORRIGÉ : token géré par tokenStorage (apiFetch), pas en double ici
  const setUser = useCallback((u: PublicUser | null) => {
    setUserState(u);
    if (!u) tokenStorage.remove(); // logout → supprime le JWT
  }, []);

  // ── Déconnexion ───────────────────────────────────────────
  const logout = useCallback(() => {
    authService.logout(); // supprime le token
    setUserState(null);
  }, []);

  return (
    <AppContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      setUser,
      logout,
    }}>
      {/* ✅ AJOUTÉ : on n'affiche rien pendant la restauration de session
          pour éviter un flash de la page login avant redirect */}
      {isLoading ? null : children}
    </AppContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export const useAppContext = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext doit être dans AppProvider');
  return ctx;
};
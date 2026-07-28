/* ============================================================
 * FICHIER : src/shared/context/AppContext.tsx
 * ============================================================ */

import React, {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react';
import { authService } from '../../modules/auth/services/authService';
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

  // ── Au démarrage : restaure la session via le cookie httpOnly ──────
  // Auth cookie-based : on appelle toujours getMe() pour vérifier la session.
  // Plus de short-circuit sur le localStorage — la source de vérité est le serveur.
  useEffect(() => {
    const restore = async () => {
      try {
        const me = await authService.getMe();
        setUserState(me);
      } catch {
        // Pas de session active (cookie absent ou expiré et refresh échoué)
        setUserState(null);
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  const setUser = useCallback((u: PublicUser | null) => {
    setUserState(u);
  }, []);

  // ── Déconnexion ───────────────────────────────────────────
  const logout = useCallback(() => {
    // UI mise à jour immédiatement; authService.logout() révoque les refresh
    // tokens côté serveur et efface les cookies httpOnly (fire & forget).
    setUserState(null);
    void authService.logout();
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
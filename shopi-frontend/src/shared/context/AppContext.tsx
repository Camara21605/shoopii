/* ============================================================
 * FICHIER : src/shared/context/AppContext.tsx
 * ============================================================ */

import React, {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react';
import { authService } from '../../modules/auth/services/authService';
import type { PublicUser } from '../../modules/auth/types';
import { disconnectGlobalSocket } from '../messagerie/hooks/useSocket';
import { disconnectNotificationSocket } from '../notifications/useNotificationSocket';

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
    /* CRITIQUE : chaque étape est isolée dans son propre try/catch. Sans
     * ça, une exception dans disconnectGlobalSocket()/
     * disconnectNotificationSocket() (ex. socket déjà dans un état
     * incohérent pendant un appel WebRTC actif) interrompait le reste de
     * la fonction AVANT d'atteindre authService.logout() — tokenStorage
     * n'était alors JAMAIS vidé et le cookie de session JAMAIS révoqué
     * côté serveur, alors que l'UI affichait déjà "déconnecté". La
     * session survivait silencieusement : au rechargement suivant (ou à
     * toute re-vérification /auth/me), l'utilisateur "redevenait"
     * connecté sans comprendre pourquoi, et PublicOnlyRoute renvoyait
     * alors /login vers son dashboard au lieu d'afficher le formulaire —
     * exactement le blocage réel observé ("Se connecter" semblait ne
     * rien faire). */
    try {
      // Sans ça, le socket restait connecté sous l'identité de l'utilisateur
      // déconnecté jusqu'à l'expiration naturelle du token en storage.
      disconnectGlobalSocket();
    } catch (e) {
      console.error('[Auth] disconnectGlobalSocket a échoué pendant la déconnexion :', e);
    }
    try {
      disconnectNotificationSocket();
    } catch (e) {
      console.error('[Auth] disconnectNotificationSocket a échoué pendant la déconnexion :', e);
    }
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
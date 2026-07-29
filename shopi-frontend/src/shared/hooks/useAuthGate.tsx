/* ================================================================
 * FICHIER : src/shared/hooks/useAuthGate.tsx
 *
 * RÔLE : Centralise la règle "action réservée aux clients" pour
 * toutes les cartes/pages publiques (produit, boutique, livreur,
 * correspondant...).
 *
 *   requireClient(action) :
 *     - client connecté        → exécute `action()`
 *     - non connecté            → ouvre AuthPromptModal (variant "anonymous")
 *     - connecté, autre rôle    → ouvre AuthPromptModal (variant "wrong-role")
 *
 * Le composant appelant doit rendre `authModal` quelque part dans
 * son JSX (généralement juste avant la fermeture du fragment racine).
 * ================================================================ */

import { useState, useCallback } from 'react';
import { getRoleFromToken } from '../services/authUtils';
import AuthPromptModal from '../components/AuthPromptModal';

export function useAuthGate() {
  const [open, setOpen] = useState(false);
  const role       = getRoleFromToken();
  const isClient   = role === 'client';
  const isAnonymous = !role;

  const requireClient = useCallback((action: () => void) => {
    if (isClient) { action(); return; }
    setOpen(true);
  }, [isClient]);

  const openAuthModal  = useCallback(() => setOpen(true), []);
  const closeAuthModal = useCallback(() => setOpen(false), []);

  const authModal = (
    <AuthPromptModal
      open={open}
      onClose={closeAuthModal}
      variant={isAnonymous ? 'anonymous' : 'wrong-role'}
      currentRole={role}
    />
  );

  return { requireClient, openAuthModal, closeAuthModal, isClient, isAnonymous, authModal };
}

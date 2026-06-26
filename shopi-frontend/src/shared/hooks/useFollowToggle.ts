/* ================================================================
 * FICHIER : src/shared/hooks/useFollowToggle.ts
 *
 * RÔLE : Logique commune du bouton « Suivre » des 3 cartes livreur
 *        (CardLivreur, CardLivreurGrid, CardLivreurList).
 *
 *        Gère : vérification auth, état loading, appel au parent
 *        (qui fait l'optimistic update + le POST), et toast.
 *
 * PATTERN : composant CONTRÔLÉ.
 *   - L'état isSuivi appartient au PARENT (source unique de vérité).
 *   - La carte ne fait JAMAIS l'appel API elle-même.
 *   - Le parent (useLivreurs ou LivreursBloc) reçoit onFollow,
 *     met à jour sa liste de façon optimiste, appelle le serveur,
 *     et relance (throw) en cas d'erreur pour que la carte toast.
 * ================================================================ */

import { useState, useCallback } from 'react';
import { useNavigate }           from 'react-router-dom';
import { tokenStorage }          from '../services/apiFetch';

type ToastFn = (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;

interface UseFollowToggleParams {
  id:       string;
  name:     string;
  isSuivi:  boolean;                                   // ← contrôlé par le parent
  onFollow: (id: string, next: boolean) => Promise<void>;
  onToast:  ToastFn;
}

interface UseFollowToggleReturn {
  loading: boolean;
  toggle:  (e?: React.MouseEvent) => Promise<void>;
}

export function useFollowToggle({
  id, name, isSuivi, onFollow, onToast,
}: UseFollowToggleParams): UseFollowToggleReturn {

  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();

    /* 1. Auth obligatoire pour suivre */
    if (!tokenStorage.get()) {
      navigate('/login');
      return;
    }

    /* 2. Délègue au parent : il fait l'optimistic update + le POST */
    setLoading(true);
    const next = !isSuivi;
    try {
      await onFollow(id, next);
      onToast(
        next ? `✅ Abonné à ${name}` : `👋 Désabonné de ${name}`,
        next ? 's' : 'i',
      );
    } catch (err: any) {
      /* Le parent a déjà rollback son état ; on informe juste l'utilisateur */
      onToast(`❌ ${err?.message ?? 'Erreur réseau'}`, 'e');
    } finally {
      setLoading(false);
    }
  }, [id, name, isSuivi, onFollow, onToast, navigate]);

  return { loading, toggle };
}
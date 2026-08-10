/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/hooks/useLivreurProfile.ts
 *
 * RÔLE : Charge le profil complet d'un livreur + gère le follow.
 *        Toute la logique de données de la page est ici (le composant
 *        d'affichage reste « bête »).
 *
 * SOURCE : GET /client/livreurs/:id  → LivreurProfileFull
 *          POST /suivis/livreurs/:id → toggle abonnement
 * ================================================================ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch }            from '../../../services/apiFetch';
import type { LivreurProfile, ProfilTab } from '../types';

interface UseLivreurProfileReturn {
  profile:            LivreurProfile | null;
  loading:            boolean;
  error:              string | null;
  tab:                ProfilTab;
  setTab:             (t: ProfilTab) => void;
  /** Synchronise profile.isSuivi après une action de FollowButton
   *  (le composant fait lui-même l'appel API désormais). */
  updateFollowState:  (next: { isSuivi: boolean }) => void;
}

export function useLivreurProfile(
  id: string | undefined,
): UseLivreurProfileReturn {

  const { t } = useTranslation();
  const [profile, setProfile] = useState<LivreurProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<ProfilTab>('info');

  /* ── Chargement du profil ── */
  useEffect(() => {
    if (!id) { setError(t('profilLivreur.idMissingError')); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);

    apiFetch<LivreurProfile>(`/client/livreurs/${id}`)
      .then(data => { if (!cancelled) setProfile(data); })
      .catch(e   => { if (!cancelled) setError(e?.message ?? t('profilLivreur.networkError')); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id, t]);

  const updateFollowState = (next: { isSuivi: boolean }) => {
    setProfile(p => p ? { ...p, isSuivi: next.isSuivi } : p);
  };

  return { profile, loading, error, tab, setTab, updateFollowState };
}
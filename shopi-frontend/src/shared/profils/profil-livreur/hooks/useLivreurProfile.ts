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

import { useState, useEffect, useCallback } from 'react';
import { apiFetch }            from '../../../services/apiFetch';
import { toggleFollowLivreur } from '../../../services/follow';
import type { LivreurProfile, ProfilTab } from '../types';

interface UseLivreurProfileReturn {
  profile:       LivreurProfile | null;
  loading:       boolean;
  error:         string | null;
  tab:           ProfilTab;
  setTab:        (t: ProfilTab) => void;
  follow:        () => Promise<void>;
  followLoading: boolean;
}

export function useLivreurProfile(
  id: string | undefined,
  onToast?: (msg: string, type?: 's' | 'i' | 'w' | 'e') => void,
): UseLivreurProfileReturn {

  const [profile, setProfile] = useState<LivreurProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<ProfilTab>('info');
  const [followLoading, setFollowLoading] = useState(false);

  /* ── Chargement du profil ── */
  useEffect(() => {
    if (!id) { setError('Identifiant manquant'); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);

    apiFetch<LivreurProfile>(`/client/livreurs/${id}`)
      .then(data => { if (!cancelled) setProfile(data); })
      .catch(e   => { if (!cancelled) setError(e?.message ?? 'Erreur réseau'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  /* ── Toggle abonnement (optimistic + rollback) ── */
  const follow = useCallback(async () => {
    if (!profile) return;
    setFollowLoading(true);
    const next = !profile.isSuivi;
    setProfile(p => p ? { ...p, isSuivi: next } : p);

    try {
      const confirmed = await toggleFollowLivreur(profile.id);
      setProfile(p => p ? { ...p, isSuivi: confirmed } : p);
      onToast?.(
        confirmed ? `✅ Abonné à ${profile.fullName}` : `👋 Désabonné de ${profile.fullName}`,
        confirmed ? 's' : 'i',
      );
    } catch (e: any) {
      setProfile(p => p ? { ...p, isSuivi: !next } : p);
      onToast?.(`❌ ${e?.message ?? 'Erreur réseau'}`, 'e');
    } finally {
      setFollowLoading(false);
    }
  }, [profile, onToast]);

  return { profile, loading, error, tab, setTab, follow, followLoading };
}
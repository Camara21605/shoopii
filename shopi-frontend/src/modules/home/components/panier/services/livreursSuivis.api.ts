/* ================================================================
 * FICHIER : src/modules/home/components/panier/services/livreursSuivis.api.ts
 *
 * RÔLE : Récupère les livreurs auxquels le client est abonné,
 *        pour les proposer dans la sélection de livraison.
 *
 * RÉUTILISE l'endpoint déjà créé pour le profil :
 *   GET /suivis/mes-abonnements → { boutiques, livreurs, correspondants }
 *   On ne garde que la partie `livreurs`.
 * ================================================================ */

import { apiFetch } from '../../../../../shared/services/apiFetch';

/* Livreur suivi tel qu'utilisé par LivraisonSection */
export interface LivreurSuivi {
  id:    string;     // id du profil livreur (UUID)
  nm:    string;     // nom complet
  zn:    string;     // zone
  rt:    string;     // note (string pour affichage)
  on:    boolean;    // en ligne (non fourni par l'API → false par défaut)
  base:  number;     // tarif de base (non géré en base → valeur par défaut)
  em:    string;     // emoji
  src:   'c';        // 'c' = abonné du client (toujours, ici)
}

interface MesAbonnementsApi {
  livreurs: {
    id: string; nom: string; categorie: string;
    emoji: string; abonnes: number; note: number;
    type: string; suivi: boolean;
  }[];
}

/* Tarif de base par défaut (pas encore stocké côté livreur) */
const TARIF_BASE_DEFAUT = 20000;

export async function fetchLivreursSuivis(): Promise<LivreurSuivi[]> {
  const data = await apiFetch<MesAbonnementsApi>('/suivis/mes-abonnements');
  return (data.livreurs ?? []).map(l => ({
    id:   l.id,
    nm:   l.nom,
    zn:   l.categorie,
    rt:   l.note ? l.note.toFixed(1) : '—',
    on:   false,                // l'API ne renvoie pas le statut en ligne ici
    base: TARIF_BASE_DEFAUT,    // tarif de base par défaut
    em:   l.emoji || '🛵',
    src:  'c' as const,
  }));
}
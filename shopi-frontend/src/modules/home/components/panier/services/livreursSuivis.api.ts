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
  on:    boolean;    // en ligne (Delivery.availability === 'available')
  /** Delivery.tarifBase — INFORMATIF UNIQUEMENT, plus utilisé pour calculer
   *  le frais facturé (voir CommandePage.tsx zoneFee) : ce n'est pas le
   *  livreur qui fixe le tarif, mais la zone de livraison (GeoZone,
   *  gérée par un administrateur avec la permission "geo_zones" accordée
   *  par le super-admin). */
  base:  number;
  em:    string;     // emoji
  src:   'c';        // 'c' = abonné du client (toujours, ici)
}

interface MesAbonnementsApi {
  livreurs: {
    id: string; nom: string; categorie: string;
    emoji: string; abonnes: number; note: number;
    type: string; suivi: boolean;
    /* ✅ AJOUTÉ côté backend (mes-abonnements.service.ts) — tarif de base
     * réel et disponibilité du livreur. */
    baseFee?: number; online?: boolean;
  }[];
}

/* BUG CORRIGÉ — un tarif fixe (20 000 GNF) était utilisé pour TOUS les
 * livreurs suivis, quel que soit leur vrai tarif configuré (Paramètres
 * → Vitesses & Tarification, colonne Delivery.tarifBase). Le commentaire
 * "pas encore stocké côté livreur" était obsolète : la donnée existe et
 * est maintenant renvoyée par /suivis/mes-abonnements. */
export async function fetchLivreursSuivis(): Promise<LivreurSuivi[]> {
  const data = await apiFetch<MesAbonnementsApi>('/suivis/mes-abonnements');
  return (data.livreurs ?? []).map(l => ({
    id:   l.id,
    nm:   l.nom,
    zn:   l.categorie,
    rt:   l.note ? l.note.toFixed(1) : '—',
    on:   l.online ?? false,
    base: l.baseFee ?? 0,
    em:   l.emoji || '🛵',
    src:  'c' as const,
  }));
}
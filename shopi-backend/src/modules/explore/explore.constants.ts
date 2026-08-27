/* ============================================================
 * FICHIER : src/modules/explore/explore.constants.ts
 * RÔLE    : Constantes de configuration de l'onglet Explorer —
 *           fenêtres de calcul, pondérations de score, bornes de
 *           pagination. Regroupées ici pour être ajustables sans
 *           toucher au service/scheduler.
 * ============================================================ */

/** Fenêtre glissante (jours) pour le calcul des tendances — ventes + likes récents. */
export const TRENDING_WINDOW_DAYS = 14;

/** Pondérations du score composite = ventes*w.sales + likes*w.likes. */
export const TRENDING_WEIGHTS = {
  sales: 3,
  likes: 1,
};

/** Nombre de produits "souvent achetés avec" conservés par produit (borne la taille de la table). */
export const COOCCURRENCE_TOP_N = 10;

/** Pagination de la grille /public/explore. */
export const EXPLORE_DEFAULT_LIMIT = 20;
export const EXPLORE_MAX_LIMIT = 50;

/** Limite par défaut des sections "intelligentes" (Tendances/Nouveautés/Proches). */
export const EXPLORE_SECTION_DEFAULT_LIMIT = 12;
export const EXPLORE_SECTION_MAX_LIMIT = 30;

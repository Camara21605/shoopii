/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/data/boutiqueMockData.ts
 *
 * RÔLE    : Données mock pour la page boutique vue par un client.
 *           Centralise TOUTES les données pour faciliter la
 *           future connexion à l'API backend.
 *
 * QUAND CONNECTER L'API :
 *   Remplacer chaque export par un appel API :
 *   - BOUTIQUE_INFO   → SUPPRIMÉ (2026-08-29) — remplacé par boutiqueInfo,
 *     calculé dans BoutiquePage.tsx (toBoutiqueInfo()) depuis GET
 *     /public/boutiques/:id, passé en props à AProposSection/BoutiqueSidebar.
 *   - PRODUITS_MOCK   → GET /boutiques/:id/produits
 *   - LIVREURS_MOCK   → SUPPRIMÉ (2026-08-29) — remplacé par les vraies
 *     données GET /public/boutiques/:id/livreurs, chargées une fois dans
 *     BoutiquePage puis passées en props à LivreursSection/AProposSection/
 *     CardLivreurBoutique (type LivreurApi, exporté depuis BoutiquePage.tsx).
 *   - CORRESPONDANTS_MOCK → SUPPRIMÉ (2026-08-29) — remplacé par les vraies
 *     données GET /public/boutiques/:id/correspondants (type CorrespondantApi,
 *     exporté depuis BoutiquePage.tsx).
 *   - PRODUITS_MOCK   → SUPPRIMÉ (2026-09-02) — remplacé par les vraies
 *     données GET /public/boutiques/:id/produits (type ProduitApi, dans
 *     BoutiquePage.tsx).
 *   - AVIS_MOCK       → SUPPRIMÉ (2026-09-02) — remplacé par les vraies
 *     données GET /public/boutiques/:id/avis (avisData dans BoutiquePage.tsx),
 *     déjà utilisées par AvisSection ; seul le badge de comptage sur la
 *     barre d'onglets utilisait encore ce mock (×49 inventé).
 *   - PROMOS_MOCK     → SUPPRIMÉ (2026-09-02) — remplacé par les vraies
 *     données GET /public/boutiques/:id/promotions (promos dans
 *     BoutiquePage.tsx), déjà utilisées par PromotionsSection.
 *   - CATEGORIES_BOUTIQUE → SUPPRIMÉ (2026-09-02) — remplacé par
 *     categoriesReelles, dérivées des vrais produits de la boutique
 *     (BoutiquePage.tsx → BoutiqueSidebar.tsx).
 * ============================================================
 */

/* ── Types exportés ── */

/** Un jour de la semaine — voir CompanyHoraire côté backend. */
export interface HoraireJour {
  jour:      string;   // 'lundi' … 'dimanche'
  label:     string;   // déjà traduit (t('boutiqueDetail.aPropos.jours.lundi')…)
  ouverture: string | null;
  fermeture: string | null;
  actif:     boolean;
}

export interface BoutiqueInfo {
  nom:          string;
  emoji:        string;
  logo?:        string | null;
  coverImage?:  string | null;
  domaine:      string;
  ville:        string;
  membre:       string;
  description:  string;
  /** Résumé court (ex: "Ouvert · 08:00–20:00" ou "Fermé aujourd'hui") —
   *  pour les emplacements compacts (BoutiqueSidebar). */
  horaires:     string;
  /** Détail complet lundi→dimanche — [] si jamais configuré côté
   *  entreprise (voir Paramètres > Horaires). Pour l'affichage détaillé
   *  (AProposSection). */
  horairesDetail?: HoraireJour[];
  /** Méthodes + zones de livraison (Paramètres > Livraison) — undefined
   *  si l'API ne les a pas renvoyées. */
  livraison?: {
    standard: boolean; livreursShopi: boolean; correspondants: boolean;
    clickCollect: boolean; express: boolean; zones: string[];
  };
  adresse:      string;
  tel:          string;
  email:        string;
  website:      string;
  note:         number;
  slogan?:       string | null;
  totalRatings?: number;   /* nombre total d'avis — vient de averageRating + totalRatings backend */
  abonnes:      string;
  satisf:       string;
  ventes:       string;
  verified:     boolean;
  online:       boolean;
  decos:        string[];
}

/* ProduitBoutique / PRODUITS_MOCK, AvisBoutique / AVIS_MOCK,
 * PromoBoutique / PROMOS_MOCK, CategorieBoutique / CATEGORIES_BOUTIQUE
 * supprimés (2026-09-02) — voir l'en-tête de fichier pour les vraies
 * sources de données qui les remplacent. LivreurBoutique déjà supprimé
 * précédemment — voir LivreurApi dans BoutiquePage.tsx. */

/* BOUTIQUE_INFO supprimé (2026-08-29) — remplacé par la vraie donnée
 * boutiqueInfo (calculée dans BoutiquePage.tsx via toBoutiqueInfo() depuis
 * GET /public/boutiques/:id), passée en props à AProposSection et
 * BoutiqueSidebar. Le type BoutiqueInfo ci-dessus reste utilisé partout. */

/* ── Réseaux sociaux pour la modale de partage ── */
export const RESEAUX_PARTAGE = [
  { icon:'fab fa-whatsapp',   label:'WhatsApp', color:'#25D366' },
  { icon:'fab fa-facebook-f', label:'Facebook', color:'#1877F2' },
  { icon:'fab fa-instagram',  label:'Instagram',color:'#E1306C' },
  { icon:'fab fa-x-twitter',  label:'X',        color:'#111111' },
  { icon:'fas fa-envelope',   label:'Email',    color:'#6B7280' },
  { icon:'fas fa-link',       label:'Copier',   color:'#1A4FC4' },
];

/* CORRESPONDANTS_MOCK / CorrespondantBoutique supprimés (2026-08-29) —
 * remplacés par les vraies données GET /public/boutiques/:id/correspondants,
 * voir CorrespondantApi dans BoutiquePage.tsx. */
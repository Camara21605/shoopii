/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/data/livreursMockData.ts
 *
 * RÔLE   : Données mock + types pour la page Livreurs.
 *          Remplacées par l'API GET /suivis/livreurs une fois prête.
 *
 * EXPORTS :
 *   - LivreurItem          → type d'un livreur
 *   - HERO_STATS           → statistiques du banner
 *   - MOCK_LIVREURS        → liste des livreurs
 *   - ZONES_OPTIONS        → options de filtre zone
 *   - VEHICULE_OPTIONS     → options de filtre véhicule
 * ================================================================ */

/* ── Type principal d'un livreur ── */
export interface LivreurItem {
  id:             string;
  fullName:       string;
  initials:       string;
  /** Gradient CSS pour l'avatar */
  avatarBg:       string;
  /** Couleur de la bande haut de carte */
  bandVariant:    'green' | 'blue' | 'teal' | 'purple' | 'amber';
  zone:           string;
  vehicule:       string;
  vehiculeType:   'moto' | 'voiture' | 'pickup';
  totalLivraisons:number;
  averageRating:  number;
  reviewsCount:   number;
  ponctualite:    number;
  experience:     string;
  disponible:     boolean;
  isSuivi:        boolean;
}

/* ── Type pour les stats du hero ── */
export interface HeroStat {
  value: string;
  label: string;
}

/* ── Statistiques réseau affichées dans le hero ── */
export const HERO_STATS: HeroStat[] = [
  { value: '148',   label: 'Livreurs actifs'     },
  { value: '4.7★',  label: 'Note moyenne'         },
  { value: '12K+',  label: 'Livraisons/mois'      },
  { value: '23',    label: 'Communes couvertes'   },
];

/* ── Options de filtre zone (sidebar) ── */
export const ZONES_OPTIONS = [
  { value: 'all',     label: 'Toutes les zones', count: 148 },
  { value: 'kaloum',  label: 'Kaloum',           count:  34 },
  { value: 'ratoma',  label: 'Ratoma',            count:  41 },
  { value: 'matam',   label: 'Matam',             count:  28 },
  { value: 'dixinn',  label: 'Dixinn',            count:  19 },
  { value: 'matoto',  label: 'Matoto',            count:  26 },
];

/* ── Options de filtre véhicule (sidebar) ── */
export const VEHICULE_OPTIONS = [
  { value: 'moto',    label: 'Moto',    icon: '🛵' },
  { value: 'voiture', label: 'Voiture', icon: '🚗' },
  { value: 'pickup',  label: 'Pickup',  icon: '🛻' },
  { value: 'camion',  label: 'Camion',  icon: '🚚' },
];

/* ── Données mock (à remplacer par API) ── */
export const MOCK_LIVREURS: LivreurItem[] = [
  {
    id:             'liv-001',
    fullName:       'Mamadou Diallo',
    initials:       'MD',
    avatarBg:       'linear-gradient(135deg,#065F46,#047857)',
    bandVariant:    'green',
    zone:           'Kaloum · Conakry',
    vehicule:       '🛵 Moto rapide',
    vehiculeType:   'moto',
    totalLivraisons: 1247,
    averageRating:  4.9,
    reviewsCount:   284,
    ponctualite:    98,
    experience:     '3 ans',
    disponible:     true,
    isSuivi:        true,
  },
  {
    id:             'liv-002',
    fullName:       'Ibrahima Bah',
    initials:       'IB',
    avatarBg:       'linear-gradient(135deg,#1e3a8a,#1549B8)',
    bandVariant:    'blue',
    zone:           'Ratoma · Conakry',
    vehicule:       '🚗 Voiture climatisée',
    vehiculeType:   'voiture',
    totalLivraisons:  892,
    averageRating:  4.8,
    reviewsCount:   193,
    ponctualite:    96,
    experience:     '2 ans',
    disponible:     true,
    isSuivi:        true,
  },
  {
    id:             'liv-003',
    fullName:       'Fatoumata Kouyaté',
    initials:       'FK',
    avatarBg:       'linear-gradient(135deg,#78350F,#D97706)',
    bandVariant:    'amber',
    zone:           'Kaloum · Conakry',
    vehicule:       '🛵 Moto express',
    vehiculeType:   'moto',
    totalLivraisons:  644,
    averageRating:  4.7,
    reviewsCount:   156,
    ponctualite:    94,
    experience:     '1 an',
    disponible:     false,
    isSuivi:        true,
  },
  {
    id:             'liv-004',
    fullName:       'Alpha Sylla',
    initials:       'AS',
    avatarBg:       'linear-gradient(135deg,#4C1D95,#7C3AED)',
    bandVariant:    'purple',
    zone:           'Matam · Conakry',
    vehicule:       '🛵 Moto rapide',
    vehiculeType:   'moto',
    totalLivraisons: 1580,
    averageRating:  4.9,
    reviewsCount:   312,
    ponctualite:    99,
    experience:     '4 ans',
    disponible:     true,
    isSuivi:        false,
  },
  {
    id:             'liv-005',
    fullName:       'Sekou Oumar Camara',
    initials:       'SO',
    avatarBg:       'linear-gradient(135deg,#083650,#0E7490)',
    bandVariant:    'teal',
    zone:           'Dixinn · Conakry',
    vehicule:       '🚗 Berline',
    vehiculeType:   'voiture',
    totalLivraisons:  421,
    averageRating:  4.6,
    reviewsCount:    98,
    ponctualite:    93,
    experience:     '1 an',
    disponible:     true,
    isSuivi:        false,
  },
  {
    id:             'liv-006',
    fullName:       'Moussa Camara',
    initials:       'MC',
    avatarBg:       'linear-gradient(135deg,#064E3B,#059669)',
    bandVariant:    'green',
    zone:           'Ratoma · Conakry',
    vehicule:       '🛵 Moto rapide',
    vehiculeType:   'moto',
    totalLivraisons: 1102,
    averageRating:  4.8,
    reviewsCount:   201,
    ponctualite:    97,
    experience:     '3 ans',
    disponible:     false,
    isSuivi:        false,
  },
  {
    id:             'liv-007',
    fullName:       'Binta Kourouma',
    initials:       'BK',
    avatarBg:       'linear-gradient(135deg,#831843,#9D174D)',
    bandVariant:    'purple',
    zone:           'Matoto · Conakry',
    vehicule:       '🛵 Moto légère',
    vehiculeType:   'moto',
    totalLivraisons:  289,
    averageRating:  4.5,
    reviewsCount:    74,
    ponctualite:    91,
    experience:     '8 mois',
    disponible:     true,
    isSuivi:        false,
  },
  {
    id:             'liv-008',
    fullName:       'Ousmane Barry',
    initials:       'OB',
    avatarBg:       'linear-gradient(135deg,#1e3a8a,#2563EB)',
    bandVariant:    'blue',
    zone:           'Kaloum · Conakry',
    vehicule:       '🚗 SUV spacieux',
    vehiculeType:   'voiture',
    totalLivraisons: 2108,
    averageRating:  4.9,
    reviewsCount:   442,
    ponctualite:    99,
    experience:     '5 ans',
    disponible:     true,
    isSuivi:        false,
  },
];
/*
 * ============================================================
 * FICHIER : src/modules/home/data/homeStoriesMockData.ts
 *
 * Données mock des stories de la page d'accueil.
 * Chaque boutique a 1 à 4 slides (produits phares).
 * ============================================================
 */

/* ── Types ── */
export interface StorySlide {
  produit:    string;
  prix:       string;
  prixBarre?: string;
  emoji:      string;
  img?:       string;
  badge?:     'promo' | 'new' | 'flash' | 'top';
  tag?:       string;
  duree:      number;  // ms (4000–7000)
}

export interface BoutiqueStory {
  id:         string;
  shopNom:    string;
  shopEmoji:  string;
  couleur1:   string;   // couleur dominante (anneau, accents)
  couleur2:   string;   // couleur secondaire (gradient anneau)
  badge?:     'promo' | 'new' | 'flash'; // badge sur la bulle
  online:     boolean;
  lu:         boolean;
  slides:     StorySlide[];
}

/* ── Mock data ── */
export const HOME_STORIES: BoutiqueStory[] = [
  {
    id:        'ts',
    shopNom:   'TechStore',
    shopEmoji: '📱',
    couleur1:  '#1A4FC4',
    couleur2:  '#67E8F9',
    badge:     'promo',
    online:    true,
    lu:        false,
    slides: [
      {
        produit:  'iPhone 15 Pro 256 GB',
        prix:     '12 500 000 GNF',
        prixBarre:'15 000 000 GNF',
        emoji:    '📱',
        badge:    'promo',
        tag:      'Promo -17% · Stock limité',
        duree:    5000,
      },
      {
        produit: 'MacBook Air M3 13"',
        prix:    '22 000 000 GNF',
        emoji:   '💻',
        badge:   'new',
        tag:     'Nouveau · Arrivage cette semaine',
        duree:   5000,
      },
      {
        produit:  'AirPods Pro 2',
        prix:     '3 200 000 GNF',
        prixBarre:'3 800 000 GNF',
        emoji:    '🎧',
        badge:    'flash',
        tag:      'Flash Sale · 24h seulement',
        duree:    4000,
      },
    ],
  },
  {
    id:        'az',
    shopNom:   'AppleZone GN',
    shopEmoji: '🍎',
    couleur1:  '#7C3AED',
    couleur2:  '#C4B5FD',
    badge:     'new',
    online:    true,
    lu:        false,
    slides: [
      {
        produit: 'iPad Pro 13" M4',
        prix:    '18 000 000 GNF',
        emoji:   '📲',
        badge:   'new',
        tag:     'Nouveau modèle 2024',
        duree:   5000,
      },
      {
        produit:  'Apple Watch Ultra 2',
        prix:     '8 500 000 GNF',
        prixBarre:'10 000 000 GNF',
        emoji:    '⌚',
        badge:    'top',
        tag:      'Top Vente · 94 vendus ce mois',
        duree:    5000,
      },
    ],
  },
  {
    id:        'fh',
    shopNom:   'FashionHub GN',
    shopEmoji: '👗',
    couleur1:  '#BE185D',
    couleur2:  '#F9A8D4',
    badge:     'flash',
    online:    false,
    lu:        false,
    slides: [
      {
        produit:  'Sac Cuir Premium',
        prix:     '2 800 000 GNF',
        prixBarre:'4 000 000 GNF',
        emoji:    '👜',
        badge:    'promo',
        tag:      'Dernières pièces',
        duree:    5000,
      },
      {
        produit: 'Robe de soirée',
        prix:    '1 800 000 GNF',
        emoji:   '👗',
        badge:   'new',
        tag:     'Collection Printemps 2025',
        duree:   5000,
      },
    ],
  },
  {
    id:        'pc',
    shopNom:   'PharmaCentre',
    shopEmoji: '💊',
    couleur1:  '#047857',
    couleur2:  '#6EE7B7',
    online:    true,
    lu:        false,
    slides: [
      {
        produit: 'Vitamines Complexe B',
        prix:    '280 000 GNF',
        emoji:   '💊',
        badge:   'top',
        tag:     'Plus vendu · Certifié OMS',
        duree:   4500,
      },
    ],
  },
  {
    id:        'mb',
    shopNom:   'MobilityBike',
    shopEmoji: '🚴',
    couleur1:  '#0E7490',
    couleur2:  '#67E8F9',
    online:    true,
    lu:        true,
    slides: [
      {
        produit: 'Vélo électrique City',
        prix:    '14 500 000 GNF',
        emoji:   '🚴',
        badge:   'new',
        tag:     'Nouveau modèle électrique',
        duree:   5000,
      },
      {
        produit:  'Casque Smart',
        prix:     '1 200 000 GNF',
        prixBarre:'1 600 000 GNF',
        emoji:    '🪖',
        badge:    'promo',
        tag:      'Pack accessoires inclus',
        duree:    4000,
      },
    ],
  },
  {
    id:        'gs',
    shopNom:   'GamingStore',
    shopEmoji: '🎮',
    couleur1:  '#DC2626',
    couleur2:  '#FCA5A5',
    badge:     'flash',
    online:    true,
    lu:        false,
    slides: [
      {
        produit:  'PlayStation 5 Standard',
        prix:     '9 500 000 GNF',
        prixBarre:'11 000 000 GNF',
        emoji:    '🎮',
        badge:    'promo',
        tag:      'Bundle manette incluse',
        duree:    5000,
      },
      {
        produit: 'Nintendo Switch OLED',
        prix:    '6 800 000 GNF',
        emoji:   '🕹️',
        badge:   'top',
        tag:     'Top Vente Gaming',
        duree:   5000,
      },
      {
        produit:  'Casque Gaming Sony',
        prix:     '1 900 000 GNF',
        prixBarre:'2 400 000 GNF',
        emoji:    '🎧',
        badge:    'flash',
        tag:      'Flash 48h · -21%',
        duree:    4000,
      },
    ],
  },
  {
    id:        'hp',
    shopNom:   'HomeProf',
    shopEmoji: '🏠',
    couleur1:  '#B45309',
    couleur2:  '#FCD34D',
    online:    false,
    lu:        true,
    slides: [
      {
        produit: 'Robot cuiseur multifonction',
        prix:    '3 200 000 GNF',
        emoji:   '🍳',
        badge:   'new',
        tag:     'Nouveau · Livraison offerte',
        duree:   5000,
      },
    ],
  },
  {
    id:        'sp',
    shopNom:   'SportPlus',
    shopEmoji: '⚽',
    couleur1:  '#16A34A',
    couleur2:  '#86EFAC',
    badge:     'new',
    online:    true,
    lu:        false,
    slides: [
      {
        produit: 'Maillot Syli National 2025',
        prix:    '350 000 GNF',
        emoji:   '🏆',
        badge:   'new',
        tag:     'Édition officielle Guinée',
        duree:   5500,
      },
      {
        produit:  'Chaussures running',
        prix:     '1 400 000 GNF',
        prixBarre:'1 800 000 GNF',
        emoji:    '👟',
        badge:    'promo',
        tag:      'Promo collection été',
        duree:    4500,
      },
    ],
  },
];
/* ================================================================
 * FICHIER : src/modules/home/components/profil-client/data/profilClientData.ts
 *
 * RÔLE : Types + données MOCK du profil client.
 *        À remplacer plus tard par des appels API
 *        (GET /auth/me, /client/wallet, /client/commandes, etc.)
 * ================================================================ */

/* ── Identité du client ── */
export interface ClientProfil {
  initiales:      string;
  nomComplet:     string;
  localisation:   string;
  membreDepuis:   string;
  enLigne:        boolean;
  profilePicture: string | null;
  badges:         { label: string; type: 'verif' | 'vip' | 'fa' | 'top' | 'fidele' }[];
}

/* ── KPI affichés sous l'identité ── */
export interface ClientKpi { valeur: string; label: string; sub?: string; tag?: 'g' | 'y'; }

/* ── Portefeuille ── */
export interface WalletData { solde: number; entreesMois: number; sortiesMois: number; }

/* ── Transaction wallet ── */
export interface Transaction {
  id: string; label: string; date: string; montant: number;
  type: 'in' | 'out' | 'pending';      // entrée / sortie / en attente
  icone: string;                        // classe FontAwesome
}

/* ── Points fidélité ── */
export interface PointsData {
  solde: number; gagnesMois: number; utilisesMois: number; valeurEstimee: number;
  enAttente: number; expirationProche: string; expireLe: string;
  niveau: string; prochainNiveau: string; prochainSeuil: number; progressionPct: number;
}

/* ── Méthode de paiement ── */
export interface PayMethod { id: string; emoji: string; nom: string; detail: string; tag: string; defaut: boolean; }

/* ── Infos personnelles (ligne par ligne, avec icône) ── */
export interface InfoRow { icone: string; label: string; valeur: string; verifie?: boolean; }

/* ── Commande ── */
export interface Commande {
  id:        string;   /* référence affichée ex: CMD-2026-00010 */
  uuid?:     string;   /* UUID interne pour GET /commandes/:uuid */
  emoji: string; imageUrl?: string; produit: string; boutique: string;
  boutiqueId?: string; international?: boolean;
  date: string; livreur?: string; correspondant?: boolean; montant: number;
  statut: 'livre' | 'transit' | 'preparation' | 'annule';
}

/* ── Abonnement (avec catégorie pour les sous-onglets) ── */
export interface Abonnement {
  id: string; emoji: string; nom: string; categorie: string; international?: boolean;
  abonnes: string; note: string;
  type: 'boutiques' | 'livreurs' | 'correspondants';
  suivi: boolean;
}

/* ── Produit favori ── */
export interface Favori { id: string; emoji: string; nom: string; prix: number; prixAncien?: string; imageUrl?: string | null; }

/* ── Avis publié ── */
export interface Avis {
  id: string; emoji: string; produit: string; boutique: string; international?: boolean;
  note: number; texte: string; date: string; utile: number;
  statut: 'verifie' | 'attente';
}

/* ── Score global des avis ── */
export interface AvisScore {
  moyenne: number; total: number;
  repartition: { etoiles: number; count: number; pct: number }[];
}

/* ── Activité (groupée par jour) ── */
export interface ActiviteItem {
  id: string; icone: string; couleur: 'bl' | 'gr' | 'ye' | 'pu' | 're' | 'tl';
  titre: string; detail: string; heure: string;
}
export interface ActiviteJour { jour: string; items: ActiviteItem[]; }

/* ════════════════════════════════════════════════════════════
 * DONNÉES MOCK
 * ════════════════════════════════════════════════════════════ */

export const CLIENT: ClientProfil = {
  initiales:      'MK',
  nomComplet:     'Mamadou Kouyaté',
  localisation:   'Kaloum, Conakry · Guinée 🇬🇳',
  membreDepuis:   'Membre depuis jan. 2023',
  enLigne:        true,
  profilePicture: null,
  badges: [
    { label: 'Vérifié',       type: 'verif'  },
    { label: 'VIP Gold',      type: 'vip'    },
    { label: '2FA actif',     type: 'fa'     },
    { label: 'Top Acheteur',  type: 'top'    },
    { label: 'Client fidèle', type: 'fidele' },
  ],
};

export const KPIS: ClientKpi[] = [
  { valeur: '42',    label: 'Commandes',    sub: '+4', tag: 'g' },
  { valeur: '12',    label: 'Abonnements'   },
  { valeur: '28',    label: 'Favoris'       },
  { valeur: '2 850', label: 'Pts Shopi',    tag: 'y' },
  { valeur: '4.9 ★', label: 'Note'          },
  { valeur: '142 M', label: 'Dépensé GNF'   },
  { valeur: '85 K',  label: 'Wallet GNF'    },
  { valeur: '16',    label: 'Avis publiés'  },
];

export const WALLET: WalletData = { solde: 85000, entreesMois: 545000, sortiesMois: 12522000 };

export const TRANSACTIONS: Transaction[] = [
  { id: 't1', label: 'Remboursement #SH-4198',       date: "Aujourd'hui · 10h14", montant: 45000,     type: 'in',      icone: 'fa-arrow-down'        },
  { id: 't2', label: 'Commande #SH-4521',            date: 'Hier · 14h32',         montant: -12500000, type: 'out',     icone: 'fa-bag-shopping'      },
  { id: 't3', label: 'Recharge Orange Money',        date: '3 jan. · 09h00',       montant: 500000,    type: 'in',      icone: 'fa-arrow-down'        },
  { id: 't4', label: 'Retrait en cours',             date: '2 jan. · 16h45',       montant: -200000,   type: 'pending', icone: 'fa-clock'             },
  { id: 't5', label: 'Frais livraison · Mamadou D.', date: '1 jan. · 11h22',       montant: -22000,    type: 'out',     icone: 'fa-truck'             },
];

export const POINTS: PointsData = {
  solde: 2850, gagnesMois: 120, utilisesMois: 50, valeurEstimee: 28500,
  enAttente: 60, expirationProche: '200 pts (déc.)', expireLe: 'Expire déc. 2025',
  niveau: 'Gold', prochainNiveau: 'Platinum', prochainSeuil: 4200, progressionPct: 68,
};

export const PAY_METHODS: PayMethod[] = [
  { id: 'om',   emoji: '🏦', nom: 'Orange Money',   detail: '+224 620 123 456', tag: 'Défaut',        defaut: true  },
  { id: 'mtn',  emoji: '💛', nom: 'MTN Money',      detail: '+224 622 987 654', tag: 'Secondaire',    defaut: false },
  { id: 'visa', emoji: '💳', nom: 'Visa •••• 4521', detail: 'Expire 09/2027',   tag: 'Internationale',defaut: false },
];

export const INFOS: InfoRow[] = [
  { icone: 'fa-envelope',      label: 'Email',             valeur: 'm.kouyate@gmail.com',                    verifie: true },
  { icone: 'fa-phone',         label: 'Téléphone',         valeur: '+224 620 123 456',                       verifie: true },
  { icone: 'fa-cake-candles',  label: 'Date de naissance', valeur: '15 mars 1992 · 32 ans'                                 },
  { icone: 'fa-venus-mars',    label: 'Genre',             valeur: 'Homme'                                                 },
  { icone: 'fa-map-pin',       label: 'Adresse principale',valeur: 'Quartier Almamya, Kaloum — Conakry, Guinée'            },
  { icone: 'fa-language',      label: 'Langue',            valeur: 'Français · Pular'                                      },
  { icone: 'fa-pen',           label: 'Bio',               valeur: 'Client fidèle Shopi depuis 2 ans 🛍️ Passionné de tech · Conakry 🇬🇳' },
];

export const COMMANDES: Commande[] = [
  { id: 'SH-4521', emoji: '📱', produit: 'iPhone 15 Pro 256GB · Titanium Black', boutique: 'TechStore Conakry',                  date: '12 jan. 2025', livreur: 'Mamadou D.',                montant: 12500000, statut: 'livre'       },
  { id: 'SH-4389', emoji: '🎧', produit: 'Sony WH-1000XM5 · Noir · ANC',         boutique: 'TechStore Conakry',                  date: '8 jan. 2025',                                        montant: 2100000,  statut: 'transit'     },
  { id: 'SH-3987', emoji: '💻', produit: 'MacBook Air M2 · Space Gray · 16Go',   boutique: 'TechZone Paris', international: true, date: '28 déc. 2024', correspondant: true,                  montant: 22000000, statut: 'livre'       },
  { id: 'SH-4201', emoji: '👟', produit: 'Nike Air Max 270 · Blanc/Rouge 44EU',  boutique: 'SportShop GN',                       date: '2 jan. 2025',                                        montant: 850000,   statut: 'preparation' },
  { id: 'SH-3801', emoji: '⌚', produit: 'Apple Watch Ultra 2 · Black Trail',    boutique: 'iStore Abidjan', international: true, date: '15 déc. 2024', correspondant: true,                  montant: 8500000,  statut: 'livre'       },
  { id: 'SH-3644', emoji: '🎮', produit: 'PlayStation 5 · Digital Edition',      boutique: 'GameZone Conakry',                   date: '5 déc. 2024',                                        montant: 6200000,  statut: 'livre'       },
];

export const ABONNEMENTS: Abonnement[] = [
  /* Boutiques */
  { id: 'b1', emoji: '📱', nom: 'TechStore Conakry', categorie: 'Électronique',          abonnes: '4 287', note: '4.8', type: 'boutiques', suivi: true  },
  { id: 'b2', emoji: '💻', nom: 'TechZone Paris',    categorie: 'Internationale', international: true, abonnes: '847', note: '4.9', type: 'boutiques', suivi: true },
  { id: 'b3', emoji: '👟', nom: 'SportShop GN',      categorie: 'Sport & Mode',          abonnes: '2 140', note: '4.7', type: 'boutiques', suivi: true  },
  { id: 'b4', emoji: '💄', nom: 'BeautyAfrik GN',    categorie: 'Beauté & Soin',         abonnes: '1 620', note: '4.6', type: 'boutiques', suivi: false },
  { id: 'b5', emoji: '🎮', nom: 'GameZone Conakry',  categorie: 'Gaming',                abonnes: '980',   note: '4.5', type: 'boutiques', suivi: true  },
  { id: 'b6', emoji: '🌸', nom: 'Parfums de Guinée', categorie: 'Parfums & Luxe',        abonnes: '430',   note: '4.9', type: 'boutiques', suivi: true  },
  /* Livreurs */
  { id: 'l1', emoji: '🛵', nom: 'Mamadou Diallo',    categorie: 'Kaloum · Dixinn',       abonnes: '1 240', note: '4.9', type: 'livreurs', suivi: true  },
  { id: 'l2', emoji: '🚴', nom: 'Fatoumata Camara',  categorie: 'Ratoma · Matoto',       abonnes: '987',   note: '4.8', type: 'livreurs', suivi: true  },
  { id: 'l3', emoji: '🚗', nom: 'Ibrahima Sylla',    categorie: 'Matam · Commune',       abonnes: '2 100', note: '4.7', type: 'livreurs', suivi: true  },
  /* Correspondants */
  { id: 'c1', emoji: '🤝', nom: 'Amadou Bah',        categorie: 'Conakry · Régional',    abonnes: '512',   note: '4.9', type: 'correspondants', suivi: true },
  { id: 'c2', emoji: '🤝', nom: 'Mariama Diallo',    categorie: 'Conakry · Local',       abonnes: '318',   note: '4.8', type: 'correspondants', suivi: true },
];

export const FAVORIS: Favori[] = [
  { id: 'f1', emoji: '⌚', nom: 'Apple Watch Ultra 2', prix: 8500000  },
  { id: 'f2', emoji: '📷', nom: 'Sony Alpha A7 IV',    prix: 35000000 },
  { id: 'f3', emoji: '🎮', nom: 'PS5 Pro',             prix: 7200000, prixAncien: '8M' },
  { id: 'f4', emoji: '🎧', nom: 'AirPods Pro 2',       prix: 2200000  },
  { id: 'f5', emoji: '📱', nom: 'Samsung S24 Ultra',   prix: 14500000 },
  { id: 'f6', emoji: '💻', nom: 'iPad Pro M4',         prix: 18900000 },
  { id: 'f7', emoji: '🔌', nom: 'MagSafe 140W',        prix: 350000   },
  { id: 'f8', emoji: '🖥', nom: 'LG UltraWide 34"',    prix: 12100000 },
  { id: 'f9', emoji: '🎒', nom: 'Sac Nike Brasilia',   prix: 480000   },
];

export const AVIS_SCORE: AvisScore = {
  moyenne: 4.9, total: 16,
  repartition: [
    { etoiles: 5, count: 14, pct: 88 },
    { etoiles: 4, count: 2,  pct: 12 },
    { etoiles: 3, count: 0,  pct: 0  },
  ],
};

export const AVIS: Avis[] = [
  { id: 'av1', emoji: '📱', produit: 'iPhone 15 Pro 256GB', boutique: 'TechStore Conakry',                  note: 5, statut: 'verifie', date: '12 janvier 2025',  utile: 24,
    texte: 'Produit exactement conforme à la description. Livraison ultra-rapide via le correspondant Amadou Bah. Emballage parfait, iPhone neuf et scellé. Je recommande vivement TechStore Conakry !' },
  { id: 'av2', emoji: '💻', produit: 'MacBook Air M2', boutique: 'TechZone Paris', international: true,      note: 5, statut: 'verifie', date: '28 décembre 2024', utile: 18,
    texte: 'Boutique internationale mais le système correspondant Shopi a rendu la livraison simple et sécurisée. Colis reçu en parfait état depuis la France en 8 jours. Je referai des achats internationaux via Shopi !' },
  { id: 'av3', emoji: '🎧', produit: 'Sony WH-1000XM5', boutique: 'TechStore Conakry',                      note: 4, statut: 'attente', date: '8 janvier 2025',   utile: 7,
    texte: 'Casque excellent, réduction de bruit impressionnante. Légèrement déçu par l\'emballage extérieur abîmé à la livraison, mais le produit était intact. Qualité sonore incomparable.' },
];

export const ACTIVITES: ActiviteJour[] = [
  {
    jour: "Aujourd'hui",
    items: [
      { id: 'a1', icone: 'fa-box',       couleur: 'bl', titre: 'Commande confirmée', detail: 'iPhone 15 Pro 256GB via livreur Mamadou Diallo · Suivi en temps réel disponible', heure: '10h14 · Kaloum, Conakry' },
      { id: 'a2', icone: 'fa-user-plus', couleur: 'gr', titre: 'Abonné à TechZone Paris', detail: 'Vous recevrez les nouvelles offres par notification', heure: '09h45' },
    ],
  },
  {
    jour: 'Hier · 13 janvier',
    items: [
      { id: 'a3', icone: 'fa-credit-card',     couleur: 're', titre: 'Paiement effectué', detail: '12 500 000 GNF via Orange Money +224 620 123 456', heure: '14h32' },
      { id: 'a4', icone: 'fa-star',            couleur: 'ye', titre: 'Avis publié ★★★★★', detail: 'Sur iPhone 15 Pro — votre avis a reçu 24 votes "utile"', heure: '11h00' },
      { id: 'a5', icone: 'fa-right-to-bracket',couleur: 'pu', titre: 'Connexion', detail: 'Chrome 120 · Windows 11 · Conakry GN', heure: '09h48' },
    ],
  },
  {
    jour: '28 décembre 2024',
    items: [
      { id: 'a6', icone: 'fa-gift',   couleur: 'gr', titre: '+120 pts Shopi gagnés', detail: 'Après livraison #SH-3987 · Niveau Gold maintenu', heure: '16h00' },
      { id: 'a7', icone: 'fa-wallet', couleur: 'tl', titre: 'Recharge wallet +500 000 GNF', detail: 'Depuis Orange Money · Solde : 585 000 GNF', heure: '08h30' },
    ],
  },
];

export const fmtGnf = (n: number | undefined | null) =>
  n != null ? n.toLocaleString('fr-FR') + ' GNF' : '—';
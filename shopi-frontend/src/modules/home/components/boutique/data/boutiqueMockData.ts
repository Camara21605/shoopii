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
 *   - AVIS_MOCK       → GET /boutiques/:id/avis
 *   - PROMOS_MOCK     → GET /boutiques/:id/promotions
 *   - CATEGORIES_BOUTIQUE → GET /boutiques/:id/categories
 * ============================================================
 */

/* ── Types exportés ── */

export interface BoutiqueInfo {
  nom:          string;
  emoji:        string;
  logo?:        string | null;
  coverImage?:  string | null;
  domaine:      string;
  ville:        string;
  membre:       string;
  description:  string;
  horaires:     string;
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

export interface ProduitBoutique {
  id:     string;
  emoji:  string;
  nom:    string;
  desc:   string;
  cat:    string;
  prix:   string;
  ancien: string | null;
  note:   number;
  avis:   number;
  stock:  'ok' | 'low' | 'out';
  badge:  'hot' | 'new' | 'promo' | 'sol' | null;
}

/* LivreurBoutique supprimé — voir LivreurApi dans BoutiquePage.tsx (données réelles). */

export interface AvisBoutique {
  id:       string;
  initiale: string;
  nom:      string;
  date:     string;
  note:     number;
  texte:    string;
}

export interface PromoBoutique {
  id:    string;
  emoji: string;
  titre: string;
  sub:   string;
  pct:   string;
  tag:   string;
}

export interface CategorieBoutique {
  emoji: string;
  label: string;
  count: number;
}

/* BOUTIQUE_INFO supprimé (2026-08-29) — remplacé par la vraie donnée
 * boutiqueInfo (calculée dans BoutiquePage.tsx via toBoutiqueInfo() depuis
 * GET /public/boutiques/:id), passée en props à AProposSection et
 * BoutiqueSidebar. Le type BoutiqueInfo ci-dessus reste utilisé partout. */

/* ── Données mock ── */

export const CATEGORIES_BOUTIQUE: CategorieBoutique[] = [
  { emoji:'📱', label:'Smartphones',    count:42 },
  { emoji:'💻', label:'Ordinateurs',   count:28 },
  { emoji:'🎧', label:'Audio & Son',   count:19 },
  { emoji:'⌚', label:'Montres & GPS', count:15 },
  { emoji:'📸', label:'Photo & Vidéo', count:12 },
  { emoji:'🎮', label:'Gaming',        count:8  },
];

export const PRODUITS_MOCK: ProduitBoutique[] = [
  { id:'p1',  emoji:'📱', nom:'iPhone 15 Pro 256GB',     desc:'Puce A17 Pro, titane, 48MP pro, USB-C',        cat:'Smartphones',   prix:'12 500 000', ancien:'14 000 000', note:4.9, avis:342, stock:'ok',  badge:'hot'  },
  { id:'p2',  emoji:'💻', nom:'MacBook Air M3 13"',       desc:'M3, 8Go RAM, 256Go SSD, autonomie 18h',        cat:'Ordinateurs',   prix:'19 800 000', ancien:null,         note:4.8, avis:218, stock:'ok',  badge:'new'  },
  { id:'p3',  emoji:'🎧', nom:'AirPods Pro 2 MagSafe',   desc:'ANC adaptatif, audio spatial, boîtier MagSafe', cat:'Audio & Son',   prix:'2 200 000',  ancien:'2 500 000',  note:4.7, avis:189, stock:'ok',  badge:'promo'},
  { id:'p4',  emoji:'⌚', nom:'Apple Watch Series 9',    desc:'GPS, suivi santé, double tap, 45mm',            cat:'Montres & GPS', prix:'3 600 000',  ancien:null,         note:4.8, avis:124, stock:'ok',  badge:null   },
  { id:'p5',  emoji:'📱', nom:'Samsung Galaxy S24 Ultra',desc:'Snapdragon 8 Gen 3, S-Pen, 200MP',             cat:'Smartphones',   prix:'11 200 000', ancien:'12 500 000',  note:4.7, avis:156, stock:'low', badge:'promo'},
  { id:'p6',  emoji:'📸', nom:'Sony ZV-E10 II Kit',      desc:'APS-C 26MP, vidéo 4K, objectif 16-50mm',       cat:'Photo & Vidéo', prix:'5 800 000',  ancien:null,         note:4.6, avis:43,  stock:'ok',  badge:'new'  },
  { id:'p7',  emoji:'🎧', nom:'Sony WH-1000XM5',         desc:'ANC de référence, 30h autonomie, multipoint',  cat:'Audio & Son',   prix:'1 800 000',  ancien:'2 100 000',  note:4.9, avis:412, stock:'ok',  badge:'hot'  },
  { id:'p8',  emoji:'💻', nom:'Dell XPS 15 i7 RTX4060',  desc:'Core i7-13700H, RTX 4060, 16Go, 512Go',        cat:'Ordinateurs',   prix:'22 500 000', ancien:null,         note:4.6, avis:67,  stock:'ok',  badge:null   },
  { id:'p9',  emoji:'📱', nom:'iPhone 14 128GB',          desc:'Puce A15, Double SIM, batterie longue durée',  cat:'Smartphones',   prix:'8 400 000',  ancien:'9 200 000',  note:4.6, avis:287, stock:'low', badge:'promo'},
  { id:'p10', emoji:'🎮', nom:'PS5 DualSense Edge',       desc:'Manette pro, sticks interchangeables, USB-C',  cat:'Gaming',        prix:'1 600 000',  ancien:null,         note:4.8, avis:98,  stock:'ok',  badge:'new'  },
  { id:'p11', emoji:'⌚', nom:'Samsung Galaxy Watch 6',   desc:'Suivi sommeil, GPS, 5ATM, 44mm',               cat:'Montres & GPS', prix:'1 200 000',  ancien:'1 500 000',  note:4.5, avis:76,  stock:'ok',  badge:'promo'},
  { id:'p12', emoji:'💻', nom:'iPad Pro 11" M4 128Go',   desc:'Écran Ultra Retina XDR, M4, Wi-Fi 6E',         cat:'Ordinateurs',   prix:'16 200 000', ancien:null,         note:4.9, avis:154, stock:'out', badge:null   },
];

export const AVIS_MOCK: AvisBoutique[] = [
  { id:'a1', initiale:'M', nom:'Moussa K.',   date:'Il y a 2 jours',   note:5, texte:'Service impeccable ! iPhone reçu en 2h, emballage parfait. Je recommande vivement TechStore.' },
  { id:'a2', initiale:'F', nom:'Fatouma D.',  date:'Il y a 1 semaine', note:5, texte:'Excellente boutique, produits authentiques garantis. Le SAV est très réactif, merci !' },
  { id:'a3', initiale:'A', nom:'Alpha B.',    date:'Il y a 2 semaines',note:4, texte:'Bonne expérience globale. Livraison rapide, produit conforme. Petit délai au téléphone.' },
  { id:'a4', initiale:'S', nom:'Seydou C.',   date:'Il y a 3 semaines',note:5, texte:'Ma MacBook commandée hier soir, reçue ce matin. Incroyable ! Produit neuf, parfait état.' },
  { id:'a5', initiale:'A', nom:'Aminata L.',  date:'Il y a 1 mois',    note:5, texte:'Les AirPods Pro reçus sont 100% authentiques. Le personnel conseille très bien. 5 étoiles !' },
];

export const PROMOS_MOCK: PromoBoutique[] = [
  { id:'pr1', emoji:'📱', titre:'Smartphones',       sub:'Tous les iPhones et Galaxy en promotion',  pct:'−20%', tag:'Flash Sale'   },
  { id:'pr2', emoji:'💻', titre:'Ordinateurs',        sub:'MacBook, Dell et HP à prix réduits',        pct:'−15%', tag:'Semaine Tech' },
  { id:'pr3', emoji:'🎧', titre:'Audio Premium',      sub:'AirPods, Sony, Bose — son à prix doux',     pct:'−25%', tag:'Top Deal'     },
  { id:'pr4', emoji:'⌚', titre:'Montres connectées', sub:'Apple Watch, Galaxy Watch en promotion',    pct:'−18%', tag:'Sélection'    },
];

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
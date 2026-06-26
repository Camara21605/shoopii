/*
 * ============================================================
 * FICHIER : src/modules/home/components/produit/data/produitMockData.ts
 *
 * CORRECTIONS APPLIQUÉES :
 *   1. SPEED_MUL : clés typées en union littérale SpeedKey
 *      (évite les accès index[string] non typés)
 *   2. DIST_MUL : clés typées en union littérale DistZone
 *   3. SPEED_ETA : clés DistZone → SpeedKey typées strictement
 *   4. Livreur.distZone : type string → DistZone littéral
 *   5. LivraisonState.distZone : type string → DistZone
 *      (exporté depuis ce fichier pour que LivraisonSection
 *       et PanierPanel utilisent le même type)
 *   6. ProduitSimilaire.badge : union complète avec null
 *   7. Ajout export DistZone et SpeedKey (réutilisés partout)
 *   8. GARANTIES déplacé en bas du fichier (cohérence ordre)
 *   9. Commentaires de section clarifiés
 * ============================================================
 */

/* ══════════════════════════════════════════════════════════
   TYPES UTILITAIRES (exportés pour réutilisation)
   ══════════════════════════════════════════════════════════ */

/** Zone de distance livreur → client */
export type DistZone = 'local' | 'near' | 'far';

/** Vitesse de livraison sélectionnée */
export type SpeedKey = 'eco' | 'standard' | 'express' | 'ultra';

/* ══════════════════════════════════════════════════════════
   TYPES PRINCIPAUX
   ══════════════════════════════════════════════════════════ */

export interface ProduitInfo {
  id:          string;
  emoji:       string;
  nom:         string;
  sku:         string;
  categorie:   string;
  prix:        number;
  ancien:      number;
  note:        number;
  avis:        number;
  acheteurs:   number;
  stock:       number;
  stockStatus: 'ok' | 'low' | 'out';
  vues:        number;
  boutique: {
    nom:       string;
    emoji:     string;
    pays:      string;
    drapeau:   string;
    region:    string;
    verified:  boolean;
    abonnes:   string;
    continent: string;
  };
  thumbnails:  string[];
  description: string;
  specs:       { label: string; value: string }[];
}

export interface Livreur {
  id:       number;
  em:       string;
  name:     string;
  zone:     string;
  rating:   string;
  trips:    string;
  online:   boolean;
  baseFee:  number;
  distZone: DistZone;           // ← était string, maintenant typé
  source:   'client' | 'boutique' | 'both';
}

export interface Correspondant {
  id:       number;
  em:       string;
  name:     string;
  region:   string;
  type:     string;
  rating:   string;
  missions: number;
  online:   boolean;
  baseFee:  number;
}

export interface ProduitSimilaire {
  id:    string;
  emoji: string;
  nom:   string;
  shop:  string;
  prix:  string;
  note:  number;
  avis:  number;
  badge: 'hot' | 'new' | 'promo' | null;
}

export interface AvisClient {
  id:       string;
  initiale: string;
  couleur:  string;
  nom:      string;
  date:     string;
  note:     number;
  titre:    string;
  texte:    string;
  verified: boolean;
}

export interface GeoVilleData { label: string; villes: string[]; }
export interface GeoContData  { label: string; pays: Record<string, GeoVilleData>; }
export interface GeoData      { [continent: string]: GeoContData; }

/* ══════════════════════════════════════════════════════════
   PRODUIT PRINCIPAL
   ══════════════════════════════════════════════════════════ */

export const PRODUIT_INFO: ProduitInfo = {
  id:          'p-iphone15pro',
  emoji:       '📱',
  nom:         'iPhone 15 Pro 256GB — Titanium Natural',
  sku:         'APL-IP15PRO-256-TIT',
  categorie:   'Smartphones',
  prix:        12_500_000,
  ancien:      14_000_000,
  note:        4.9,
  avis:        248,
  acheteurs:   231,
  stock:       14,
  stockStatus: 'ok',
  vues:        1_842,
  boutique: {
    nom:       'TechZone Paris',
    emoji:     '📱',
    pays:      'France',
    drapeau:   '🇫🇷',
    region:    'Europe',
    verified:  true,
    abonnes:   '8,2K',
    continent: 'europe',
  },
  thumbnails:  ['📱', '🔋', '📷', '🎧', '📦'],
  description: `L'iPhone 15 Pro représente le summum de la technologie Apple. Conçu en titane de qualité aérospatiale, il allie légèreté, résistance et design raffiné. La puce A17 Pro gravée en 3 nm offre des performances inégalées, tandis que le système de caméra ProRes permet un enregistrement vidéo de niveau professionnel.`,
  specs: [
    { label:'Marque',       value:'Apple'                        },
    { label:'Puce',         value:'A17 Pro (3 nm)'               },
    { label:'Stockage',     value:'256 GB'                       },
    { label:'Écran',        value:'6,1" OLED 120Hz ProMotion'    },
    { label:'Caméra',       value:'48MP triple capteur'          },
    { label:'Batterie',     value:'29h autonomie vidéo'          },
    { label:'Connectivité', value:'5G · USB-C USB 3 · Wi-Fi 6E'  },
    { label:'Résistance',   value:'IP68 — 6m / 30 min'           },
    { label:'OS',           value:'iOS 17 (iOS 18 disponible)'   },
    { label:'Garantie',     value:'1 an constructeur Apple'      },
  ],
};

export const VARIANTES_STOCKAGE = [
  { label:'128 GB', disabled: true  },
  { label:'256 GB', disabled: false },
  { label:'512 GB', disabled: false },
  { label:'1 TB',   disabled: false },
];

export const VARIANTES_COLORIS = [
  { label:'Natural', color:'#C8B89A', border: false },
  { label:'Blue',    color:'#4A6FA5', border: false },
  { label:'White',   color:'#F0EFED', border: true  },
  { label:'Black',   color:'#3A3A3C', border: false },
];

/* ══════════════════════════════════════════════════════════
   LIVREURS
   ══════════════════════════════════════════════════════════ */

export const LIVREURS_DATA: Livreur[] = [
  { id:1, em:'🛵', name:'Mamadou Diallo',    zone:'Kaloum · Dixinn', rating:'4.9', trips:'1 240', online:true,  baseFee:20_000, distZone:'local', source:'both'     },
  { id:2, em:'🚴', name:'Fatoumata Kouyaté', zone:'Ratoma · Matoto', rating:'4.8', trips:'987',   online:true,  baseFee:18_000, distZone:'local', source:'client'   },
  { id:3, em:'🚗', name:'Ibrahima Sylla',    zone:'Matam · Commune', rating:'4.7', trips:'2 100', online:false, baseFee:22_000, distZone:'local', source:'boutique' },
  { id:4, em:'🛵', name:'Aissatou Barry',    zone:'Coyah',           rating:'4.9', trips:'756',   online:true,  baseFee:28_000, distZone:'near',  source:'client'   },
  { id:5, em:'🚴', name:'Kadiatou Mariam',   zone:'Conakry Centre',  rating:'5.0', trips:'3 400', online:true,  baseFee:15_000, distZone:'local', source:'both'     },
  { id:6, em:'🚗', name:'Thierno Baldé',     zone:'Labé · Région',   rating:'4.6', trips:'640',   online:false, baseFee:55_000, distZone:'far',   source:'boutique' },
];

/* ══════════════════════════════════════════════════════════
   CORRESPONDANTS
   ══════════════════════════════════════════════════════════ */

export const CORRESPONDANTS: Correspondant[] = [
  { id:1, em:'👨‍💼', name:'Amadou Bah',     region:'Conakry', type:'Régional', rating:'4.9', missions:142, online:true,  baseFee:35_000 },
  { id:2, em:'👩‍💼', name:'Mariama Diallo', region:'Conakry', type:'Local',    rating:'4.8', missions:89,  online:true,  baseFee:30_000 },
  { id:3, em:'👨‍💼', name:'Sekou Camara',   region:'Guinée',  type:'National', rating:'4.7', missions:210, online:false, baseFee:25_000 },
  { id:4, em:'👩‍💼', name:'Hawa Kouyaté',   region:'Kindia',  type:'Zonal',    rating:'4.8', missions:64,  online:true,  baseFee:40_000 },
];

/* ══════════════════════════════════════════════════════════
   PRODUITS SIMILAIRES
   ══════════════════════════════════════════════════════════ */

export const PRODUITS_SIMILAIRES: ProduitSimilaire[] = [
  { id:'s1', emoji:'💻', nom:'MacBook Air M3',       shop:'TechZone Paris', prix:'22 000 000', note:5, avis:94,  badge:'promo' },
  { id:'s2', emoji:'⌚', nom:'Apple Watch Ultra 2',  shop:'TechZone Paris', prix:'8 500 000',  note:5, avis:67,  badge:'hot'   },
  { id:'s3', emoji:'🎧', nom:'AirPods Pro 2e gén.',  shop:'TechZone Paris', prix:'2 200 000',  note:5, avis:183, badge:'hot'   },
  { id:'s4', emoji:'📱', nom:'iPhone 15 128GB',      shop:'TechZone Paris', prix:'9 800 000',  note:4, avis:142, badge:'new'   },
  { id:'s5', emoji:'🔌', nom:'Chargeur MagSafe 15W', shop:'TechZone Paris', prix:'350 000',    note:4, avis:88,  badge:null    },
];

/* ══════════════════════════════════════════════════════════
   AVIS CLIENTS
   ══════════════════════════════════════════════════════════ */

export const AVIS_DATA: AvisClient[] = [
  {
    id:'a1', initiale:'M',
    couleur:'linear-gradient(135deg,#E2EAFB,#C8D9F8)',
    nom:'Mamadou K.', date:'12 jan. 2025', note:5,
    titre:'Livraison via correspondant parfaite !',
    texte:"Boutique en France, j'ai utilisé le correspondant à Conakry. Il a tout géré, réceptionné le colis, vérifié et remis à mon livreur Shopi. Téléphone authentique, parfait état. Je recommande !",
    verified: true,
  },
  {
    id:'a2', initiale:'F',
    couleur:'linear-gradient(135deg,#D1FAE5,#A7F3D0)',
    nom:'Fatoumata D.', date:'3 jan. 2025', note:5,
    titre:'Service de correspondant excellent',
    texte:"Le système de livraison avec correspondant est très bien pensé. Prix du livreur calculé automatiquement selon ma ville. Ultra rapide une fois en Guinée.",
    verified: true,
  },
];

/* ══════════════════════════════════════════════════════════
   GÉOGRAPHIE
   ══════════════════════════════════════════════════════════ */

export const GEO_DATA: GeoData = {
  africa:  { label:'🌍 Afrique', pays: {
    GN: { label:'🇬🇳 Guinée',        villes:['Conakry','Kindia','Boké','Labé','Kankan','Nzérékoré','Faranah','Coyah'] },
    SN: { label:'🇸🇳 Sénégal',       villes:['Dakar','Thiès','Ziguinchor','Saint-Louis','Touba'] },
    CI: { label:"🇨🇮 Côte d'Ivoire", villes:['Abidjan','Bouaké','Daloa','San-Pédro'] },
    ML: { label:'🇲🇱 Mali',           villes:['Bamako','Sikasso','Ségou','Mopti'] },
    CM: { label:'🇨🇲 Cameroun',       villes:['Yaoundé','Douala','Bafoussam','Garoua'] },
  }},
  europe:  { label:'🌍 Europe', pays: {
    FR: { label:'🇫🇷 France',    villes:['Paris','Lyon','Marseille','Toulouse','Nice'] },
    BE: { label:'🇧🇪 Belgique',  villes:['Bruxelles','Liège','Anvers','Gand'] },
    DE: { label:'🇩🇪 Allemagne', villes:['Berlin','Munich','Francfort','Hambourg'] },
  }},
  america: { label:'🌎 Amériques', pays: {
    US: { label:'🇺🇸 États-Unis', villes:['New York','Los Angeles','Chicago','Houston'] },
    CA: { label:'🇨🇦 Canada',     villes:['Montréal','Toronto','Vancouver','Ottawa'] },
  }},
  asia:    { label:'🌏 Asie / Pacifique', pays: {
    CN: { label:'🇨🇳 Chine', villes:['Shanghai','Beijing','Shenzhen','Guangzhou'] },
    JP: { label:'🇯🇵 Japon', villes:['Tokyo','Osaka','Kyoto','Yokohama'] },
  }},
};

/** Continent et pays de la boutique (détection livraison internationale) */
export const SHOP_CONTINENT = 'europe';
export const SHOP_PAYS      = 'FR';

/* ══════════════════════════════════════════════════════════
   MULTIPLICATEURS LIVRAISON
   Typés strictement pour éviter les accès index dynamiques
   non contrôlés (Record<DistZone|SpeedKey, number>).
   ══════════════════════════════════════════════════════════ */

/** Multiplicateur selon la vitesse choisie */
export const SPEED_MUL: Record<SpeedKey, number> = {
  eco:      1.0,
  standard: 1.3,
  express:  1.8,
  ultra:    2.5,
};

/** Multiplicateur selon la distance zone */
export const DIST_MUL: Record<DistZone, number> = {
  local: 1.0,
  near:  1.3,
  far:   1.8,
};

/** ETA estimé selon distance × vitesse */
export const SPEED_ETA: Record<DistZone, Record<SpeedKey, string>> = {
  local: { eco:'3–4h',      standard:'1–2h',      express:'45 min', ultra:'20 min' },
  near:  { eco:'1 jour',    standard:'4–6h',       express:'2–3h',   ultra:'1h'    },
  far:   { eco:'3–5 jours', standard:'2–3 jours',  express:'1 jour', ultra:'12h'   },
};

/* ══════════════════════════════════════════════════════════
   GARANTIES PRODUIT
   ══════════════════════════════════════════════════════════ */

export const GARANTIES: { ico: string; titre: string; sub: string }[] = [
  { ico:'🔒', titre:'Paiement sécurisé',   sub:'SSL · Orange Money · Visa'  },
  { ico:'↩️', titre:'Retour 7 jours',      sub:'Produit défectueux accepté' },
  { ico:'✅', titre:'Produit authentique',  sub:'Vendeur Shopi certifié'     },
  { ico:'📞', titre:'Support 24/7',         sub:'Chat · WhatsApp · Tél.'     },
];
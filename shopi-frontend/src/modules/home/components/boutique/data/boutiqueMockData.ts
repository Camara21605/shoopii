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
 *   - BOUTIQUE_INFO   → GET /boutiques/:id
 *   - PRODUITS_MOCK   → GET /boutiques/:id/produits
 *   - LIVREURS_MOCK   → GET /boutiques/:id/livreurs
 *   - AVIS_MOCK       → GET /boutiques/:id/avis
 *   - PROMOS_MOCK     → GET /boutiques/:id/promotions
 *   - CATEGORIES_BOUTIQUE → GET /boutiques/:id/categories
 * ============================================================
 */

/* ── Types exportés ── */


// ══════════════════════════════════════════════════════════════
// À AJOUTER dans : src/modules/home/components/boutique/data/boutiqueMockData.ts
//
// 1. Ajoutez le type Story (ou importez-le depuis StoriesStrip.tsx)
// 2. Collez le tableau STORIES_MOCK ci-dessous dans le fichier
// ══════════════════════════════════════════════════════════════

import type { Story } from '../sections/StoriesStrip';

export const STORIES_MOCK: Story[] = [
  {
    id:       's1',
    produit:  'iPhone 15 Pro',
    prix:     '12 500 000 GNF',
    prixBarre:'15 000 000 GNF',
    badge:    'promo',
    emoji:    '📱',
    couleur:  '#1A4FC4',
    tag:      'Promo -17% · Stock limité',
    lu:       false,
    duree:    5000,
  },
  {
    id:       's2',
    produit:  'MacBook Air M3',
    prix:     '22 000 000 GNF',
    badge:    'new',
    emoji:    '💻',
    couleur:  '#7C3AED',
    tag:      'Nouveau · Arrivage cette semaine',
    lu:       false,
    duree:    5500,
  },
  {
    id:       's3',
    produit:  'AirPods Pro 2',
    prix:     '3 200 000 GNF',
    prixBarre:'3 800 000 GNF',
    badge:    'flash',
    emoji:    '🎧',
    couleur:  '#DC2626',
    tag:      'Flash Sale · 24h seulement',
    lu:       false,
    duree:    4000,
  },
  {
    id:       's4',
    produit:  'Apple Watch Ultra 2',
    prix:     '8 500 000 GNF',
    badge:    'top',
    emoji:    '⌚',
    couleur:  '#B45309',
    tag:      'Top Vente · 94 vendus ce mois',
    lu:       true,
    duree:    5000,
  },
  {
    id:       's5',
    produit:  'PlayStation 5',
    prix:     '9 500 000 GNF',
    emoji:    '🎮',
    couleur:  '#0E7490',
    tag:      'Disponible en stock',
    lu:       true,
    duree:    4500,
  },
  {
    id:       's6',
    produit:  'iPad Pro 13"',
    prix:     '18 000 000 GNF',
    badge:    'new',
    emoji:    '📲',
    couleur:  '#047857',
    tag:      'Nouveau modèle 2024',
    lu:       false,
    duree:    5000,
  },
  {
    id:       's7',
    produit:  'Sony Alpha A7 IV',
    prix:     '28 000 000 GNF',
    emoji:    '📷',
    couleur:  '#6D28D9',
    tag:      '1 exemplaire disponible',
    lu:       false,
    duree:    6000,
  },
];

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

export interface LivreurBoutique {
  id:    string;
  emoji: string;
  nom:   string;
  zone:  string;
  note:  number;
  trips: number;
  dispo: boolean;
}

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

/* ── Données mock ── */

export const BOUTIQUE_INFO: BoutiqueInfo = {
  nom:         'TechStore Conakry',
  emoji:       '📱',
  domaine:     'Électronique & High-Tech',
  ville:       'Conakry, Guinée',
  membre:      'Membre depuis 2019',
  description: `TechStore Conakry est votre référence en matière d'électronique et de high-tech en Guinée depuis 2019. Nous proposons une sélection rigoureuse de smartphones, ordinateurs, accessoires audio et montres connectées, tous authentiques et garantis. Notre équipe de techniciens certifiés vous conseille et vous accompagne après l'achat.`,
  horaires:    'Lun–Sam : 8h–20h · Dim : 10h–18h',
  adresse:     'Avenue de la République, Kaloum, Conakry',
  tel:         '+224 621 00 00 00',
  email:       'contact@techstore-conakry.com',
  website:     'www.techstore-gn.com',
  note:        4.9,
  abonnes:     '12,4K',
  satisf:      '98%',
  ventes:      '18K+',
  verified:    true,
  online:      true,
  decos:       ['📱','💻','🎧','⌚'],
};

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

export const LIVREURS_MOCK: LivreurBoutique[] = [
  { id:'l1', emoji:'🧑🏿',    nom:'Mamadou Diallo',   zone:'Kaloum · Matam · Dixinn',    note:4.8, trips:342, dispo:true  },
  { id:'l2', emoji:'👩🏿',    nom:'Fatoumata Camara', zone:'Ratoma · Hamdallaye',         note:4.9, trips:218, dispo:false },
  { id:'l3', emoji:'👨🏿',    nom:'Ibrahima Baldé',   zone:'Cosa · Lambanyi · Sonfonia',  note:4.6, trips:156, dispo:false },
  { id:'l4', emoji:'👩🏿‍🦱', nom:'Aïssatou Bah',    zone:'Kipé · Cimenterie',           note:4.7, trips:94,  dispo:true  },
  { id:'l5', emoji:'🧑🏿‍🦲', nom:'Ousmane Kouyaté', zone:'Bambeto · Koloma',            note:4.4, trips:67,  dispo:true  },
  { id:'l6', emoji:'👨🏿‍🦱', nom:'Sékou Traoré',    zone:'Nongo · Kakimbo',             note:4.5, trips:52,  dispo:false },
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

/* ══════════════════════════════════════════════════════════
   CORRESPONDANTS
   ══════════════════════════════════════════════════════════ */

export interface CorrespondantBoutique {
  id:       string;
  emoji:    string;
  nom:      string;
  ville:    string;
  quartier: string;
  pays:     string;
  drapeau:  string;
  note:     number;
  colis:    number;
  succès:   string;
  dispo:    boolean;
  verified: boolean;
  langues:  string[];
  tarif:    string;
  delai:    string;
  horaires: string;
  bio:      string;
}

export const CORRESPONDANTS_MOCK: CorrespondantBoutique[] = [
  {
    id:'c1', emoji:'🏢', nom:'Amadou Bah',
    ville:'Conakry', quartier:'Kaloum', pays:'Guinée', drapeau:'🇬🇳',
    note:4.9, colis:48, succès:'98%', dispo:true, verified:true,
    langues:['Français','Pular'],
    tarif:'15 000 – 25 000 GNF', delai:'24h – 48h', horaires:'Lun–Sam : 8h–20h',
    bio:'Correspondant Shopi Premium depuis 2021. Point de relais sécurisé à Kaloum, idéal pour les produits high-tech et les colis de valeur.',
  },
  {
    id:'c2', emoji:'🏪', nom:'Mariama Diallo',
    ville:'Conakry', quartier:'Ratoma', pays:'Guinée', drapeau:'🇬🇳',
    note:4.8, colis:36, succès:'96%', dispo:true, verified:true,
    langues:['Français','Soussou','Malinké'],
    tarif:'12 000 – 20 000 GNF', delai:'24h – 72h', horaires:'Lun–Dim : 7h–21h',
    bio:'Correspondante expérimentée couvrant Ratoma et Hamdallaye. Stockage sécurisé, disponible 7j/7.',
  },
  {
    id:'c3', emoji:'🏬', nom:'Ibrahima Sylla',
    ville:'Conakry', quartier:'Matam', pays:'Guinée', drapeau:'🇬🇳',
    note:4.7, colis:21, succès:'94%', dispo:false, verified:true,
    langues:['Français'],
    tarif:'10 000 – 18 000 GNF', delai:'48h – 72h', horaires:'Lun–Ven : 9h–18h',
    bio:'Point de relais en zone Matam/Taouyah. Spécialisé dans la réception de petits colis électroniques.',
  },
  {
    id:'c4', emoji:'🏛️', nom:'Centre Relais Dixinn',
    ville:'Conakry', quartier:'Dixinn', pays:'Guinée', drapeau:'🇬🇳',
    note:4.6, colis:14, succès:'92%', dispo:true, verified:false,
    langues:['Français','Pular'],
    tarif:'8 000 – 15 000 GNF', delai:'48h – 96h', horaires:'Mar–Sam : 8h–17h',
    bio:'Relais communautaire Dixinn/Cameroun. Idéal pour les envois depuis l\'international via un correspondant de confiance.',
  },
];
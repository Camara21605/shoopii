/* ============================================================
 * FICHIER : src/modules/home/data/mockData.ts
 * RÔLE    : Données mock centralisées — remplacer par API
 * ============================================================ */

export interface Produit {
  id: string; emoji: string; nom: string; desc: string;
  boutique: string; prix: string; ancien: string | null;
  note: number; avis: number; badge: 'hot' | 'new' | 'promo' | null;
}
export interface Entreprise {
  id: string; emoji: string; nom: string; desc: string;
  dom: string; domColor: string; domBg: string; type: string; ville: string;
  note: number; prods: number; abonnes: number; verified: boolean;
}
export interface Partenaire {
  id: string; emoji: string; nom: string; desc: string;
  cert: string; domaine: string; abonnes: number;
}
export interface Correspondant {
  id: string; emoji: string; nom: string; region: string;
  type: string; desc: string; missions: number; note: number; online: boolean;
}
export interface Livreur {
  id: string; emoji: string; nom: string; zone: string;
  vehicule: string; livraisons: number; note: number; dispo: boolean;
}
export interface TypeEntreprise {
  emoji: string; label: string; count: string; color: string; bg: string;
}

export const PRODUITS: Produit[] = [
  { id:'p1',  emoji:'📱', nom:'iPhone 15 Pro 256GB',     desc:'Puce A17 Pro, titane, appareil photo 48MP',      boutique:'TechStore Conakry', prix:'12 500 000', ancien:'14 000 000', note:4.9, avis:342, badge:'hot'   },
  { id:'p2',  emoji:'💻', nom:'MacBook Air M3 13"',       desc:'Processeur M3, 8Go RAM, autonomie 18h',           boutique:'AppleZone GN',      prix:'19 800 000', ancien:null,         note:4.8, avis:218, badge:'new'   },
  { id:'p3',  emoji:'👗', nom:'Robe Bazin Brodée',        desc:'Tissu bazin supérieur, broderie artisanale',      boutique:'FashionHub GN',     prix:'350 000',    ancien:'450 000',    note:4.7, avis:96,  badge:'promo' },
  { id:'p4',  emoji:'🛋️', nom:'Canapé 3 places Velours',  desc:'Tissu velours premium, livraison incluse',        boutique:'MaisonPlus',        prix:'2 800 000',  ancien:null,         note:4.5, avis:44,  badge:null    },
  { id:'p5',  emoji:'⌚', nom:'Samsung Galaxy Watch 6',   desc:'Suivi santé GPS, résistant 5ATM',                 boutique:'TechStore Conakry', prix:'1 200 000',  ancien:'1 500 000',  note:4.6, avis:157, badge:'promo' },
  { id:'p6',  emoji:'🎮', nom:'PlayStation 5 Slim',       desc:'Console next-gen, SSD ultra-rapide 825Go',        boutique:'GamingWorld GN',    prix:'7 500 000',  ancien:null,         note:4.9, avis:489, badge:'hot'   },
  { id:'p7',  emoji:'👟', nom:'Nike Air Max 2025',        desc:'Running réactif, taille 38-46, 6 coloris',        boutique:'SportZone GN',      prix:'900 000',    ancien:'1 100 000',  note:4.7, avis:203, badge:'new'   },
  { id:'p8',  emoji:'🍳', nom:'Robot Kenwood Chef',       desc:'1200W, 8 accessoires, bol inox 4.3L',             boutique:'CuisineElite',      prix:'1 600 000',  ancien:null,         note:4.4, avis:68,  badge:null    },
  { id:'p9',  emoji:'📸', nom:'Canon EOS R50 Kit',        desc:'Hybride 24MP, vidéo 4K, objectif 18-45mm',        boutique:'PhotoVision GN',    prix:'6 200 000',  ancien:'7 000 000',  note:4.8, avis:124, badge:'promo' },
  { id:'p10', emoji:'🚲', nom:'Vélo électrique 27.5"',    desc:'Autonomie 80km, moteur 250W, 21V Shimano',         boutique:'EcoMob Conakry',    prix:'4 500 000',  ancien:null,         note:4.6, avis:37,  badge:'new'   },
  { id:'p11', emoji:'💊', nom:'Pack Vitamine C 1000mg',   desc:'60 comprimés effervescents, certifié ISO',         boutique:'PharmaCare GN',     prix:'85 000',     ancien:null,         note:4.3, avis:512, badge:null    },
  { id:'p12', emoji:'🎸', nom:'Guitare Yamaha FG820',     desc:"Corps épicéa massif, cordes D'Addario",           boutique:'MusicWorld GN',     prix:'1 850 000',  ancien:'2 100 000',  note:4.7, avis:29,  badge:'promo' },
];

export const ENTREPRISES: Entreprise[] = [
  { id:'e1', emoji:'📱', nom:'TechStore Conakry', desc:'Votre spécialiste en électronique et high-tech en Guinée', dom:'Électronique', domColor:'var(--blue)',    domBg:'var(--sky)',    type:'Boutique',   ville:'Conakry', note:4.9, prods:342, abonnes:12400, verified:true  },
  { id:'e2', emoji:'👗', nom:'FashionHub GN',     desc:'Mode africaine contemporaine, prêt-à-porter haut de gamme', dom:'Mode & Beauté', domColor:'var(--rose)',  domBg:'var(--rs-bg)', type:'Boutique',   ville:'Conakry', note:4.7, prods:218, abonnes:8900,  verified:true  },
  { id:'e3', emoji:'🛋️', nom:'MaisonPlus Déco',   desc:'Mobilier, décoration intérieure et arts de la table',      dom:'Maison & Déco', domColor:'var(--amber)', domBg:'var(--am-bg)', type:'Boutique',   ville:'Kindia',  note:4.5, prods:156, abonnes:3200,  verified:false },
  { id:'e4', emoji:'🍕', nom:'FoodExpress GN',    desc:'Plats chauds et produits locaux livrés en 30 minutes',     dom:'Alimentation', domColor:'var(--emerald)',domBg:'var(--em-bg)', type:'Restaurant', ville:'Conakry', note:4.8, prods:94,  abonnes:21000, verified:true  },
  { id:'e5', emoji:'💊', nom:'PharmaCare Guinée', desc:'Médicaments, parapharmacie et compléments certifiés',      dom:'Santé',         domColor:'var(--teal)',  domBg:'var(--tl-bg)', type:'Pharmacie',  ville:'Conakry', note:4.6, prods:412, abonnes:6700,  verified:true  },
  { id:'e6', emoji:'🎮', nom:'GamingWorld GN',    desc:'Consoles, jeux vidéo et accessoires gaming haut de gamme', dom:'Gaming',        domColor:'var(--violet)',domBg:'var(--vl-bg)', type:'Boutique',   ville:'Conakry', note:4.9, prods:89,  abonnes:15300, verified:true  },
];

export const PARTENAIRES: Partenaire[] = [
  { id:'pt1', emoji:'🏦', nom:'Orange Money GN',    desc:'Solution de paiement mobile leader en Guinée.', cert:'Partenaire financier certifié',  domaine:'Finance',    abonnes:45200 },
  { id:'pt2', emoji:'🚚', nom:'Logistique Express', desc:'Livraison express inter-régional, camions frigo.', cert:'Partenaire logistique officiel', domaine:'Logistique', abonnes:12800 },
  { id:'pt3', emoji:'🛡️', nom:'SecurePay GN',       desc:'Protection paiements, PCI-DSS, anti-fraude.',   cert:'Partenaire sécurité certifié',  domaine:'Sécurité',   abonnes:9400  },
  { id:'pt4', emoji:'📦', nom:'StorageHub Africa',  desc:'Stockage et entreposage pour e-commerçants.',   cert:'Partenaire entrepôt certifié',  domaine:'Stockage',   abonnes:7600  },
  { id:'pt5', emoji:'📊', nom:'DataInsight GN',     desc:'Analyses de marché et statistiques e-commerce.', cert:'Partenaire analytics certifié', domaine:'Analytics',  abonnes:5100  },
];

export const CORRESPONDANTS: Correspondant[] = [
  { id:'c1', emoji:'🏬', nom:'RelaisPlus Kaloum',       region:'Conakry · Kaloum',   type:'Relais principal',    desc:'Hub central Kaloum, Dixinn, Matam',        missions:284, note:4.9, online:true  },
  { id:'c2', emoji:'🏪', nom:'Kiosk Ratoma',            region:'Conakry · Ratoma',   type:'Relais local',        desc:'Service de proximité à Bambeto',           missions:118, note:4.6, online:true  },
  { id:'c3', emoji:'🏭', nom:"Dépôt Guinée Forestière", region:"N'Zérékoré",         type:'Entrepôt régional',   desc:"Hub de distribution région forestière",    missions:76,  note:4.4, online:false },
  { id:'c4', emoji:'✈️', nom:'Export Conakry Intl',     region:'Port de Conakry',    type:'Export international',desc:"Partenaire export Afrique de l'Ouest",     missions:47,  note:4.8, online:true  },
  { id:'c5', emoji:'📦', nom:'Point Relais Labé',       region:'Labé',               type:'Relais local',        desc:'Couverture Labé, Pita et Dalaba',          missions:52,  note:4.5, online:false },
];

export const LIVREURS: Livreur[] = [
  { id:'l1', emoji:'🧑🏿',    nom:'Mamadou Diallo',   zone:'Kaloum · Matam',      vehicule:'🛵 Moto',     livraisons:342, note:4.8, dispo:true  },
  { id:'l2', emoji:'👩🏿',    nom:'Fatoumata Camara', zone:'Ratoma · Hamdallaye', vehicule:'🛵 Moto',     livraisons:218, note:4.9, dispo:false },
  { id:'l3', emoji:'👨🏿',    nom:'Ibrahima Baldé',   zone:'Cosa · Lambanyi',     vehicule:'🚗 Voiture',  livraisons:156, note:4.6, dispo:false },
  { id:'l4', emoji:'👩🏿‍🦱', nom:'Aïssatou Bah',    zone:'Kipé · Cimenterie',   vehicule:'🛵 Moto',     livraisons:94,  note:4.7, dispo:true  },
  { id:'l5', emoji:'🧑🏿‍🦲', nom:'Ousmane Kouyaté', zone:'Bambeto · Koloma',    vehicule:'🛺 Tricycle', livraisons:67,  note:4.4, dispo:true  },
];

export const TYPES_ENTREPRISE: TypeEntreprise[] = [
  { emoji:'🛍️', label:'Boutiques',    count:'1 240', color:'var(--blue)',    bg:'var(--sky)'    },
  { emoji:'🍽️', label:'Restaurants',  count:'380',   color:'var(--emerald)',bg:'var(--em-bg)'  },
  { emoji:'💊', label:'Pharmacies',   count:'142',   color:'var(--teal)',   bg:'var(--tl-bg)'  },
  { emoji:'🎨', label:'Artisanat',    count:'290',   color:'var(--amber)',  bg:'var(--am-bg)'  },
  { emoji:'💻', label:'Tech & Serv.', count:'510',   color:'var(--violet)', bg:'var(--vl-bg)'  },
  { emoji:'🏗️', label:'BTP & Matér.',count:'178',   color:'var(--slate)',  bg:'rgba(71,85,105,.08)' },
  { emoji:'🚗', label:'Auto & Moto',  count:'224',   color:'var(--navy)',   bg:'var(--sky-2)'  },
  { emoji:'🌿', label:'Agriculture',  count:'196',   color:'var(--emerald)',bg:'rgba(4,120,87,.06)' },
];

export const CATEGORIES = [
  { emoji:'✦',  nom:'Tout',          count:'25 000+' },
  { emoji:'📱', nom:'Électronique',  count:'4 200'   },
  { emoji:'👗', nom:'Mode & Beauté', count:'6 800'   },
  { emoji:'🥩', nom:'Alimentation',  count:'1 900'   },
  { emoji:'🛋️', nom:'Maison & Déco', count:'3 100'   },
  { emoji:'🚗', nom:'Automobile',    count:'2 400'   },
  { emoji:'💼', nom:'Services',      count:'950'     },
  { emoji:'⚽', nom:'Sport',         count:'1 600'   },
  { emoji:'💊', nom:'Santé',         count:'800'     },
  { emoji:'📚', nom:'Éducation',     count:'420'     },
  { emoji:'🎮', nom:'Jeux & Loisirs',count:'1 100'   },
  { emoji:'✈️', nom:'Voyage',        count:'320'     },
];

/** Mélange aléatoire Fisher-Yates */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/* ================================================================
 * data/correspondantData.ts
 * Données mock du dashboard correspondant Shopi Africa
 * Accent : amber/orange (--cor:#B45309)
 * ================================================================ */

export type ColisStatus  = 'att' | 'stock' | 'dep' | 'ret' | 'livr';
export type TransStatus  = 'en-route' | 'livre' | 'en-attente';
export type RetourStatus = 'en-attente' | 'litige' | 'resolu';

export type PageId =
  | 'overview' | 'colis' | 'transferts' | 'retours'
  | 'boutiques' | 'livreurs' | 'clients'
  | 'revenus' | 'portefeuille' | 'zone' | 'evaluation' | 'parametres';

export interface Colis {
  id: string; em: string; nm: string;
  boutique: string; client: string;
  valeur: number; date: string;
  status: ColisStatus; urgent: boolean;
}
export interface Boutique {
  em: string; nm: string; cat: string;
  rat: number; colis: number; pending: number; since: string;
}
export interface Livreur {
  em: string; nm: string; zone: string;
  rat: number; missions: number; online: boolean; pending: number;
}
export interface Client {
  nm: string; tel: string; colis: number;
  dernier: string; val: number; status: string;
}
export interface Transfert {
  id: string; from: string; to: string;
  colis: string; valeur: number; date: string;
  status: TransStatus; dist: string;
}
export interface Retour {
  id: string; em: string; nm: string;
  boutique: string; client: string;
  valeur: number; motif: string; date: string; status: RetourStatus;
}
export interface Avis {
  bg: string; init: string; nm: string;
  stars: number; txt: string; date: string; replied: boolean;
}
export interface RevBar  { j: string; v: number; today?: boolean; }
export interface ActItem { ic: string; bg: string; c: string; msg: string; t: string; }

export const COLIS: Colis[] = [
  { id:'COL-0241', em:'📱', nm:'iPhone 15 Pro 256GB',    boutique:'TechStore Conakry',  client:'Mamadou K.',   valeur:12500000, date:'Auj. 09:00', status:'stock', urgent:false },
  { id:'COL-0240', em:'💻', nm:'MacBook Air M3',          boutique:'AppleZone GN',       client:'Fatoumata D.', valeur:22000000, date:'Auj. 08:30', status:'att',   urgent:false },
  { id:'COL-0239', em:'🎧', nm:'Sony WH-1000XM5',         boutique:'TechStore Conakry',  client:'Ibrahima S.',  valeur:2100000,  date:'Hier',       status:'dep',   urgent:false },
  { id:'COL-0238', em:'⌚', nm:'Apple Watch Ultra 2',      boutique:'AppleZone GN',       client:'Aminata B.',   valeur:8500000,  date:'Hier',       status:'stock', urgent:true  },
  { id:'COL-0237', em:'🎮', nm:'PlayStation 5 Standard',  boutique:'TechStore Conakry',  client:'Thierno D.',   valeur:9500000,  date:'Lun.',       status:'stock', urgent:false },
  { id:'COL-0236', em:'📷', nm:'Sony Alpha A7 IV',         boutique:'AppleZone GN',       client:'Sekou C.',     valeur:8200000,  date:'Lun.',       status:'livr',  urgent:false },
  { id:'COL-0235', em:'👗', nm:'Sac Samsonite XL',        boutique:'FashionHub GN',      client:'Kadiatou M.',  valeur:1800000,  date:'Ven.',       status:'ret',   urgent:false },
];

export const BOUTIQUES: Boutique[] = [
  { em:'📱', nm:'TechStore Conakry', cat:'Électronique',   rat:4.9, colis:8, pending:2, since:'Jan. 2024'  },
  { em:'💻', nm:'AppleZone GN',      cat:'High-Tech Apple', rat:4.8, colis:4, pending:1, since:'Mars 2024' },
  { em:'👗', nm:'FashionHub GN',     cat:'Mode',            rat:4.6, colis:2, pending:0, since:'Oct. 2024'  },
  { em:'💊', nm:'PharmaCentre GN',  cat:'Pharmacie',        rat:4.7, colis:0, pending:0, since:'Déc. 2024'  },
];

export const LIVREURS: Livreur[] = [
  { em:'🛵', nm:'Mamadou Diallo',  zone:'Kaloum · Dixinn', rat:4.9, missions:28, online:true,  pending:3 },
  { em:'🚴', nm:'Fatoumata Keita', zone:'Ratoma · Matoto', rat:4.8, missions:18, online:true,  pending:1 },
  { em:'🚗', nm:'Ibrahima Sylla',  zone:'Matam · Commune', rat:4.7, missions:11, online:false, pending:0 },
  { em:'🛵', nm:'Mariama Camara',  zone:'Kaloum Centre',   rat:5.0, missions:42, online:true,  pending:2 },
  { em:'🛵', nm:'Sekou Baldé',     zone:'Dixinn · Matam',  rat:4.6, missions:8,  online:false, pending:0 },
  { em:'🚗', nm:'Aminata Touré',   zone:'Ratoma · Kaporo', rat:4.8, missions:21, online:true,  pending:1 },
  { em:'🛵', nm:'Thierno Diallo',  zone:'Conakry Est',     rat:4.7, missions:15, online:false, pending:0 },
];

export const CLIENTS: Client[] = [
  { nm:'Mamadou Kouyaté',  tel:'+224 620 123 456', colis:3, dernier:'Auj.',  val:37500000, status:'att'    },
  { nm:'Fatoumata Diallo', tel:'+224 622 456 789', colis:1, dernier:'Hier',  val:22000000, status:'ok'     },
  { nm:'Ibrahima Sylla',   tel:'+224 628 789 012', colis:1, dernier:'Hier',  val:2100000,  status:'ok'     },
  { nm:'Aminata Barry',    tel:'+224 631 234 567', colis:2, dernier:'Lun.',   val:18000000, status:'ok'     },
  { nm:'Thierno Baldé',    tel:'+224 624 567 890', colis:1, dernier:'Ven.',   val:9500000,  status:'retour' },
];

export const TRANSFERTS: Transfert[] = [
  { id:'TR-0041', from:'AppleZone GN',      to:'Mamadou Diallo',  colis:'MacBook Air M3',  valeur:22000000, date:'Auj. 10:00', status:'en-route', dist:'8 km' },
  { id:'TR-0040', from:'TechStore Conakry', to:'Fatoumata Keita', colis:'Sony WH-1000XM5', valeur:2100000,  date:'Auj. 09:00', status:'en-route', dist:'5 km' },
  { id:'TR-0039', from:'FashionHub GN',     to:'Mariama Camara',  colis:'Sac de voyage',   valeur:1800000,  date:'Hier 16:00', status:'livre',    dist:'3 km' },
];

export const RETOURS: Retour[] = [
  { id:'RET-0012', em:'👗', nm:'Sac Samsonite XL', boutique:'FashionHub GN',     client:'Kadiatou M.', valeur:1800000, motif:'Taille incorrecte',  date:'Ven.', status:'en-attente' },
  { id:'RET-0011', em:'🔌', nm:'Hub USB-C 7en1',   boutique:'TechStore Conakry', client:'Mamoudou D.', valeur:180000,  motif:'Produit défectueux', date:'Jeu.', status:'litige'     },
];

export const AVIS: Avis[] = [
  { bg:'linear-gradient(135deg,#EEF3FD,#E2EAFB)', init:'T', nm:'TechStore Conakry', stars:5, txt:'Relais exemplaire. Colis bien conservés, remise ponctuelle aux livreurs. Partenariat idéal.',       date:'12 jan.', replied:true  },
  { bg:'linear-gradient(135deg,#ECFDF5,#D1FAE5)', init:'M', nm:'Mamadou K.',         stars:5, txt:"J'ai récupéré mon colis facilement. Amadou était disponible et professionnel. Merci !",             date:'10 jan.', replied:false },
  { bg:'linear-gradient(135deg,#FAF5FF,#EDE9FE)', init:'A', nm:'AppleZone GN',        stars:4, txt:"Bon partenariat. Légère attente lors d'un pic, mais globalement excellent service.",               date:'8 jan.',  replied:true  },
];

export const REV_WEEK:  RevBar[] = [
  {j:'Lun',v:28000},{j:'Mar',v:45000},{j:'Mer',v:32000},
  {j:'Jeu',v:58000},{j:'Ven',v:71000},{j:'Sam',v:92000},{j:'Auj',v:38000,today:true},
];
export const REV_MONTH: RevBar[] = [
  {j:'S1',v:180000},{j:'S2',v:240000},{j:'S3',v:165000},{j:'S4',v:320000},{j:'Act',v:38000,today:true},
];

export const ACTIVITE: ActItem[] = [
  { ic:'fa-box',                 bg:'rgba(180,83,9,.10)',   c:'#B45309', msg:'<b>3 colis TechStore</b> enregistrés en dépôt',                t:'Il y a 30 min' },
  { ic:'fa-arrows-rotate',       bg:'rgba(14,116,144,.10)', c:'#0E7490', msg:'Transfert <b>TR-0041</b> — MacBook à Mamadou Diallo',           t:'Il y a 2h'     },
  { ic:'fa-star',                bg:'rgba(245,158,11,.12)', c:'#F59E0B', msg:'AppleZone GN vous a noté <b>5 ⭐</b>',                          t:'Hier'          },
  { ic:'fa-phone',               bg:'rgba(4,120,87,.10)',   c:'#047857', msg:'Client Fatoumata D. — colis récupéré avec succès',             t:'Hier'          },
  { ic:'fa-triangle-exclamation',bg:'rgba(220,38,38,.09)',  c:'#DC2626', msg:'Retour <b>RET-0012</b> — litige FashionHub GN',                t:'Ven.'          },
];

export const STATUS_CFG: Record<ColisStatus, {label:string}> = {
  att:   {label:'✓ Arrivé'},
  stock: {label:'📦 En stock'},
  dep:   {label:'🚀 Dispatché'},
  ret:   {label:'↩ Retour'},
  livr:  {label:'✅ Livré'},
};

export const fmtGNF  = (n: number) => n.toLocaleString('fr-FR') + ' GNF';
export const fmtMini = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return String(n);
};
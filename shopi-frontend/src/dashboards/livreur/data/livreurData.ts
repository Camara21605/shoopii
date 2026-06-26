// src/dashboards/livreur/data/livreurData.ts
// Toutes les données mock + types du dashboard livreur

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type PageId =
  | 'overview' | 'missions' | 'encours' | 'historique'
  | 'boutiques' | 'abonner' | 'revenus' | 'wallet'
  | 'zone' | 'evaluation' | 'parametres' | 'profil' | 'messagerie'
  | 'reseauCorrespondants' | 'reseauLivreurs'
  | 'profilCorrespondant' | 'profilLivreur';

export type SpeedKey = 'eco' | 'std' | 'exp' | 'ult';
export type MissionStatus = 'new' | 'prep' | 'active' | 'done';
export type HistStatus = 'done' | 'iss' | 'can';

export interface Mission {
  id:      string;
  em:      string;
  nm:      string;
  shop:    string;
  client:  string;
  from:    string;
  to:      string;
  dist:    string;
  fee:     number;
  speed:   SpeedKey;
  status:  MissionStatus;
  urgent:  boolean;
  date:    string;
}

export interface HistItem {
  id:     string;
  em:     string;
  nm:     string;
  shop:   string;
  fee:    number;
  dist:   string;
  speed:  SpeedKey;
  status: HistStatus;
  date:   string;
  earn:   boolean;
}

export interface Boutique {
  em:      string;
  nm:      string;
  cat:     string;
  rat:     number;
  delivs:  number;
  pending: number;
  since:   string;
}

export interface TxItem {
  ic:   string;
  bg:   string;
  c:    string;
  nm:   string;
  sub:  string;
  amt:  number;
  type: 'in' | 'out';
  date: string;
}

export interface Avis {
  bg:    string;
  init:  string;
  nm:    string;
  stars: number;
  txt:   string;
  chips: string[];
  date:  string;
}

export interface Notif {
  ic:     string;
  bg:     string;
  c:      string;
  msg:    string;
  t:      string;
  unread: boolean;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES VITESSE
// ─────────────────────────────────────────────────────────────
export const SPEED_LABEL: Record<SpeedKey, string> = {
  eco: '🐢 Éco',
  std: '🚴 Standard',
  exp: '🚀 Express',
  ult: '⚡ Ultra',
};

export const SPEED_CLASS: Record<SpeedKey, string> = {
  eco: 'speedEco',
  std: 'speedStd',
  exp: 'speedExp',
  ult: 'speedUlt',
};

// ─────────────────────────────────────────────────────────────
// PAGE META
// ─────────────────────────────────────────────────────────────
export const PAGE_META: Record<PageId, { title: string; sub: string }> = {
  overview:   { title: "Vue d'ensemble",          sub: "Tableau de bord · Samedi 18 janvier 2025"                },
  missions:   { title: "Missions disponibles",    sub: "8 missions en attente dans votre zone"                   },
  encours:    { title: "Mission en cours",         sub: "iPhone 15 Pro — TechStore Conakry · Express"             },
  historique: { title: "Historique des livraisons",sub: "Toutes vos missions passées"                            },
  boutiques:  { title: "Mes boutiques",           sub: "3 boutiques partenaires"                                 },
  abonner:    { title: "Rejoindre une boutique",  sub: "Entrez un code d'invitation"                             },
  revenus:    { title: "Mes revenus",             sub: "Finances & performances — Janvier 2025"                  },
  wallet:     { title: "Wallet Shopi",            sub: "385 000 GNF disponibles"                                 },
  zone:       { title: "Ma zone de livraison",    sub: "Kaloum · Dixinn · Matam · Ratoma"                        },
  evaluation: { title: "Ajouter un correspondant",sub: "Invitez un point relais à rejoindre votre réseau"        },
  parametres: { title: "Paramètres",              sub: "Configuration du compte livreur"                         },
  profil:     { title: "Mon profil",              sub: "Informations publiques"                                  },
  messagerie: { title: "Messagerie",              sub: "Discutez avec vos clients et boutiques"                  },
  reseauCorrespondants: { title: "Correspondants", sub: "Suivez des correspondants de votre réseau"              },
  reseauLivreurs:       { title: "Livreurs",       sub: "Suivez d'autres livreurs du réseau Shopi"                },
  profilCorrespondant:  { title: "Profil correspondant", sub: "Détails et suivi"                                  },
  profilLivreur:        { title: "Profil livreur",       sub: "Détails et suivi"                                  },
};

// ─────────────────────────────────────────────────────────────
// MISSIONS
// ─────────────────────────────────────────────────────────────
export const MISSIONS: Mission[] = [
  { id:'MIS-0124', em:'📱', nm:'iPhone 15 Pro 256GB',    shop:'TechStore Conakry', client:'Mamadou K.',   from:'Kaloum (Boutique)',  to:'Ratoma, Cité ministère',  dist:'12 km', fee:26000,  speed:'exp', status:'new',  urgent:false, date:'Il y a 8 min'   },
  { id:'MIS-0123', em:'🎧', nm:'Sony WH-1000XM5',        shop:'TechStore Conakry', client:'Fatoumata D.', from:'Kaloum (Boutique)',  to:'Dixinn, Cameroun',        dist:'7 km',  fee:18000,  speed:'std', status:'new',  urgent:false, date:'Il y a 22 min'  },
  { id:'MIS-0122', em:'💻', nm:'MacBook Air M3 13"',     shop:'AppleZone GN',      client:'Ibrahima S.',  from:'Matam (Boutique)',   to:'Matoto, Hamdallaye',      dist:'18 km', fee:45000,  speed:'ult', status:'new',  urgent:true,  date:'Il y a 35 min'  },
  { id:'MIS-0121', em:'⌚', nm:'Apple Watch Ultra 2',    shop:'TechStore Conakry', client:'Aminata B.',   from:'Kaloum (Boutique)',  to:'Kaloum, Almamya',         dist:'3 km',  fee:15000,  speed:'eco', status:'prep', urgent:false, date:'Il y a 1h'      },
  { id:'MIS-0120', em:'🎮', nm:'PlayStation 5 Standard', shop:'AppleZone GN',      client:'Thierno D.',   from:'Matam (Boutique)',   to:'Ratoma, Kaporo',          dist:'14 km', fee:28000,  speed:'std', status:'new',  urgent:false, date:'Il y a 1h30'    },
  { id:'MIS-0119', em:'📷', nm:'Sony Alpha A7 IV',       shop:'PhotoStore GN',     client:'Sekou C.',     from:'Kaloum (Boutique)',  to:'Dixinn, Donka',           dist:'9 km',  fee:21000,  speed:'std', status:'new',  urgent:false, date:'Il y a 2h'      },
  { id:'MIS-0118', em:'🖥️', nm:'LG Monitor 27"',         shop:'TechStore Conakry', client:'Kadiatou M.',  from:'Kaloum (Boutique)',  to:'Matam, Taouyah',          dist:'11 km', fee:24000,  speed:'std', status:'new',  urgent:false, date:'Il y a 2h30'    },
  { id:'MIS-0117', em:'🎒', nm:'Sac de voyage Samsonite',shop:'FashionHub GN',     client:'Mamoudou D.',  from:'Ratoma (Boutique)',  to:'Kaloum, Port',            dist:'16 km', fee:32000,  speed:'exp', status:'new',  urgent:false, date:'Il y a 3h'      },
];

// ─────────────────────────────────────────────────────────────
// HISTORIQUE
// ─────────────────────────────────────────────────────────────
export const HISTORIQUE: HistItem[] = [
  { id:'MIS-0118', em:'📱', nm:'iPhone 14 128GB',    shop:'TechStore', fee:22000, dist:'9 km',  speed:'std', status:'done', date:'11 jan.', earn:true  },
  { id:'MIS-0115', em:'💻', nm:'MacBook Pro M3',     shop:'AppleZone', fee:48000, dist:'21 km', speed:'exp', status:'done', date:'10 jan.', earn:true  },
  { id:'MIS-0112', em:'🎧', nm:'AirPods Pro 2',      shop:'TechStore', fee:16000, dist:'6 km',  speed:'eco', status:'done', date:'10 jan.', earn:true  },
  { id:'MIS-0108', em:'📷', nm:'Sony A6400',         shop:'AppleZone', fee:42000, dist:'17 km', speed:'ult', status:'done', date:'9 jan.',  earn:true  },
  { id:'MIS-0105', em:'🔌', nm:'Hub USB-C 7-en-1',  shop:'TechStore', fee:12000, dist:'4 km',  speed:'eco', status:'iss',  date:'8 jan.',  earn:false },
  { id:'MIS-0101', em:'⌚', nm:'Samsung Watch 6',    shop:'TechStore', fee:18000, dist:'8 km',  speed:'std', status:'can',  date:'7 jan.',  earn:false },
];

// ─────────────────────────────────────────────────────────────
// BOUTIQUES
// ─────────────────────────────────────────────────────────────
export const BOUTIQUES: Boutique[] = [
  { em:'📱', nm:'TechStore Conakry', cat:'Électronique',   rat:4.9, delivs:28, pending:3, since:'Mars 2024'  },
  { em:'💻', nm:'AppleZone GN',      cat:'High-Tech Apple',rat:4.8, delivs:9,  pending:1, since:'Oct. 2024'  },
  { em:'👗', nm:'FashionHub GN',     cat:'Mode',           rat:4.6, delivs:5,  pending:0, since:'Janv. 2025' },
];

// ─────────────────────────────────────────────────────────────
// REVENUE DATA
// ─────────────────────────────────────────────────────────────
export const REV_WEEK = [
  { j:'Lun', v:38000  }, { j:'Mar', v:92000  }, { j:'Mer', v:65000  },
  { j:'Jeu', v:118000 }, { j:'Ven', v:142000 }, { j:'Sam', v:210000 },
  { j:'Auj', v:44000, today:true },
];
export const REV_MONTH = [
  { j:'S1', v:320000 }, { j:'S2', v:410000 }, { j:'S3', v:185000 },
  { j:'S4', v:580000 }, { j:'Actuel', v:44000, today:true },
];

// ─────────────────────────────────────────────────────────────
// TRANSACTIONS WALLET
// ─────────────────────────────────────────────────────────────
export const TRANSACTIONS: TxItem[] = [
  { ic:'fa-motorcycle',       bg:'var(--em-bg)', c:'var(--emerald)', nm:'Livraison MIS-0124',    sub:'iPhone 15 Pro · Express', amt:26000,  type:'in',  date:'Auj. 14h30' },
  { ic:'fa-motorcycle',       bg:'var(--em-bg)', c:'var(--emerald)', nm:'Livraison MIS-0123',    sub:'Sony XM5 · Standard',     amt:18000,  type:'in',  date:'Auj. 11h'   },
  { ic:'fa-money-bill-transfer',bg:'var(--am-bg)',c:'var(--amber)',   nm:'Retrait Orange Money',  sub:'Vers +224 620 XXX XXX',   amt:200000, type:'out', date:'Hier'        },
  { ic:'fa-motorcycle',       bg:'var(--em-bg)', c:'var(--emerald)', nm:'Livraison MIS-0118',    sub:'iPhone 14 · Standard',    amt:22000,  type:'in',  date:'11 jan.'     },
];

// ─────────────────────────────────────────────────────────────
// AVIS
// ─────────────────────────────────────────────────────────────
export const AVIS: Avis[] = [
  { bg:'linear-gradient(135deg,#EEF3FD,#E2EAFB)', init:'M', nm:'Mamadou K.',   stars:5, txt:"Livraison en 25 min chrono depuis Kaloum ! Professionnel, colis parfaitement protégé.", chips:['Ponctuel','Pro','Rapide'],        date:'12 jan.' },
  { bg:'linear-gradient(135deg,#ECFDF5,#D1FAE5)', init:'F', nm:'Fatoumata D.', stars:5, txt:"Très satisfaite. Communication parfaite, a appelé avant d'arriver. Je recommande.",    chips:['Sympa','Communicatif'],           date:'10 jan.' },
  { bg:'linear-gradient(135deg,#FAF5FF,#EDE9FE)', init:'I', nm:'Ibrahima S.',  stars:4, txt:"Bon service, léger retard dû à la circulation mais prévenu à l'avance.",              chips:['Honnête'],                        date:'8 jan.'  },
];

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
export const NOTIFS: Notif[] = [
  { ic:'fa-motorcycle',          bg:'var(--tl-bg)',  c:'var(--teal)',   msg:'<strong>Nouvelle mission urgente</strong> — MacBook Air M3, 45 000 GNF · Ultra',    t:'Il y a 35 min', unread:true  },
  { ic:'fa-star',                bg:'var(--am-bg)',  c:'var(--amber)',  msg:'<strong>Nouvel avis 5⭐</strong> — Mamadou K. vous a noté après sa livraison',        t:'Il y a 2h',     unread:true  },
  { ic:'fa-coins',               bg:'var(--em-bg)',  c:'var(--emerald)',msg:'+26 000 GNF encaissés — Livraison Express confirmée',                                 t:'Il y a 3h',     unread:true  },
  { ic:'fa-store',               bg:'var(--sky-2)',  c:'var(--blue)',   msg:'<strong>FashionHub GN</strong> vous a ajouté comme livreur partenaire',               t:'Hier',          unread:false },
  { ic:'fa-trophy',              bg:'var(--am-bg)',  c:'var(--amber)',  msg:'🏆 Vous avez atteint le badge <strong>Top Livreur</strong> du mois !',               t:'Hier',          unread:false },
  { ic:'fa-triangle-exclamation',bg:'var(--or-bg)',  c:'var(--orange)', msg:"Rappel : votre assurance véhicule expire dans <strong>12 jours</strong>",            t:'Avant-hier',    unread:false },
  { ic:'fa-bolt',                bg:'var(--tl-bg)',  c:'var(--teal)',   msg:'Forte demande prévisionnelle ce samedi 14h–18h dans votre zone',                      t:'Ce matin',      unread:false },
];

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────
export const fmtGNF = (n: number): string => n.toLocaleString('fr') + ' GNF';

export const fmtMini = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return String(n);
};
/*
 * ════════════════════════════════════════════════════════
 * FICHIER : src/modules/commandes/services/commandesService.ts
 * ORDRE   : 7 — Service de données, importé par les pages
 *           du module commandes et du dashboard correspondant
 * RÔLE    : Fournit les données statiques (simulées) et
 *           les fonctions utilitaires de formatage.
 *           En production : remplacer par des appels API
 *           via src/shared/services/apiFetch.ts
 * ════════════════════════════════════════════════════════
 */

import type {
  Colis, Boutique, Livreur, Client,
  Transfert, Retour, Avis, RevData, Activity,
} from '../../../shared/types/index_correspondant';

/* ── Formatage ────────────────────────────────────── */
export const fmt    = (n: number) => n.toLocaleString('fr') + ' GNF';
export const sMini  = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return String(n);
};

/* ── Données colis ────────────────────────────────── */
export const COLIS: Colis[] = [
  { id:'COL-0241', em:'📱', nm:'iPhone 15 Pro 256GB',   boutique:'TechStore Conakry',  client:'Mamadou K.',   valeur:12_500_000, date:'Auj. 09:00', status:'stock',  urgent:false },
  { id:'COL-0240', em:'💻', nm:'MacBook Air M3',         boutique:'AppleZone GN',       client:'Fatoumata D.', valeur:22_000_000, date:'Auj. 08:30', status:'att',    urgent:false },
  { id:'COL-0239', em:'🎧', nm:'Sony WH-1000XM5',        boutique:'TechStore Conakry',  client:'Ibrahima S.',  valeur: 2_100_000, date:'Hier',       status:'dep',    urgent:false },
  { id:'COL-0238', em:'⌚', nm:'Apple Watch Ultra 2',    boutique:'AppleZone GN',       client:'Aminata B.',   valeur: 8_500_000, date:'Hier',       status:'stock',  urgent:true  },
  { id:'COL-0237', em:'🎮', nm:'PlayStation 5 Standard', boutique:'TechStore Conakry',  client:'Thierno D.',   valeur: 9_500_000, date:'Lun.',       status:'stock',  urgent:false },
  { id:'COL-0236', em:'📷', nm:'Sony Alpha A7 IV',       boutique:'AppleZone GN',       client:'Sekou C.',     valeur: 8_200_000, date:'Lun.',       status:'livr',   urgent:false },
  { id:'COL-0235', em:'👗', nm:'Sac Samsonite XL',       boutique:'FashionHub GN',      client:'Kadiatou M.',  valeur: 1_800_000, date:'Ven.',       status:'ret',    urgent:false },
];

/* ── Données boutiques ────────────────────────────── */
export const BOUTIQUES: Boutique[] = [
  { em:'📱', nm:'TechStore Conakry', cat:'Électronique',      rat:4.9, colis:8, pending:2, type:'enterprise', since:'Jan. 2024' },
  { em:'💻', nm:'AppleZone GN',     cat:'High-Tech Apple',   rat:4.8, colis:4, pending:1, type:'enterprise', since:'Mars 2024' },
  { em:'👗', nm:'FashionHub GN',    cat:'Mode',              rat:4.6, colis:2, pending:0, type:'enterprise', since:'Oct. 2024' },
  { em:'💊', nm:'PharmaCentre GN',  cat:'Pharmacie',         rat:4.7, colis:0, pending:0, type:'enterprise', since:'Déc. 2024' },
];

/* ── Données livreurs ─────────────────────────────── */
export const LIVREURS: Livreur[] = [
  { em:'🛵', nm:'Mamadou Diallo',   zone:'Kaloum · Dixinn',   rat:4.9, missions:28, online:true,  pending:3 },
  { em:'🚴', nm:'Fatoumata Keita',  zone:'Ratoma · Matoto',   rat:4.8, missions:18, online:true,  pending:1 },
  { em:'🚗', nm:'Ibrahima Sylla',   zone:'Matam · Commune',   rat:4.7, missions:11, online:false, pending:0 },
  { em:'🛵', nm:'Mariama Camara',   zone:'Kaloum Centre',     rat:5.0, missions:42, online:true,  pending:2 },
  { em:'🛵', nm:'Sekou Baldé',      zone:'Dixinn · Matam',    rat:4.6, missions: 8, online:false, pending:0 },
  { em:'🚗', nm:'Aminata Touré',    zone:'Ratoma · Kaporo',   rat:4.8, missions:21, online:true,  pending:1 },
  { em:'🛵', nm:'Thierno Diallo',   zone:'Conakry Est',       rat:4.7, missions:15, online:false, pending:0 },
];

/* ── Données clients ──────────────────────────────── */
export const CLIENTS: Client[] = [
  { nm:'Mamadou Kouyaté',  tel:'+224 620 123 456', colis:3, dernier:'Auj.',  val:37_500_000, status:'att'    },
  { nm:'Fatoumata Diallo', tel:'+224 622 456 789', colis:1, dernier:'Hier',  val:22_000_000, status:'ok'     },
  { nm:'Ibrahima Sylla',   tel:'+224 628 789 012', colis:1, dernier:'Hier',  val: 2_100_000, status:'ok'     },
  { nm:'Aminata Barry',    tel:'+224 631 234 567', colis:2, dernier:'Lun.',   val:18_000_000, status:'ok'     },
  { nm:'Thierno Baldé',    tel:'+224 624 567 890', colis:1, dernier:'Ven.',   val: 9_500_000, status:'retour' },
];

/* ── Données transferts ───────────────────────────── */
export const TRANSFERTS: Transfert[] = [
  { id:'TR-0041', from:'AppleZone GN',     to:'Mamadou Diallo',  colis:'MacBook Air M3',    valeur:22_000_000, date:'Auj. 10:00', status:'en-route', dist:'8 km' },
  { id:'TR-0040', from:'TechStore Conakry',to:'Fatoumata Keita', colis:'Sony WH-1000XM5',   valeur: 2_100_000, date:'Auj. 09:00', status:'en-route', dist:'5 km' },
  { id:'TR-0039', from:'FashionHub GN',    to:'Mariama Camara',  colis:'Sac de voyage',     valeur: 1_800_000, date:'Hier 16:00', status:'livre',    dist:'3 km' },
];

/* ── Données retours ──────────────────────────────── */
export const RETOURS: Retour[] = [
  { id:'RET-0012', em:'👗', nm:'Sac Samsonite XL', boutique:'FashionHub GN',    client:'Kadiatou M.',  valeur:1_800_000, motif:'Taille incorrecte',    date:'Ven.', status:'en-attente' },
  { id:'RET-0011', em:'🔌', nm:'Hub USB-C 7en1',   boutique:'TechStore Conakry',client:'Mamoudou D.',  valeur:  180_000, motif:'Produit défectueux',   date:'Jeu.', status:'litige'     },
];

/* ── Données avis ─────────────────────────────────── */
export const AVIS: Avis[] = [
  { bg:'linear-gradient(135deg,#EEF3FD,#E2EAFB)', init:'T', nm:'TechStore Conakry', stars:5, txt:"Relais exemplaire. Colis bien conservés, remise ponctuelle aux livreurs. Partenariat idéal.",                 date:'12 jan.', replied:true  },
  { bg:'linear-gradient(135deg,#ECFDF5,#D1FAE5)', init:'M', nm:'Mamadou K.',        stars:5, txt:"J'ai récupéré mon colis facilement. Amadou était disponible et professionnel. Merci !",                      date:'10 jan.', replied:false },
  { bg:'linear-gradient(135deg,#FAF5FF,#EDE9FE)', init:'A', nm:'AppleZone GN',      stars:4, txt:"Bon partenariat. Légère attente lors d'un pic, mais globalement excellent service.",                         date:'8 jan.',  replied:true  },
];

/* ── Données revenus ──────────────────────────────── */
export const REV_WEEK: RevData[] = [
  {j:'Lun',v:28_000},{j:'Mar',v:45_000},{j:'Mer',v:32_000},{j:'Jeu',v:58_000},
  {j:'Ven',v:71_000},{j:'Sam',v:92_000},{j:'Auj',v:38_000,today:true},
];
export const REV_MONTH: RevData[] = [
  {j:'S1',v:180_000},{j:'S2',v:240_000},{j:'S3',v:165_000},{j:'S4',v:320_000},
  {j:'Act',v:38_000,today:true},
];

/* ── Données activité ─────────────────────────────── */
export const ACTIVITY: Activity[] = [
  { ic:'fa-box',                 bg:'var(--cor-bg)',              c:'var(--cor)',     msg:'<strong>3 colis TechStore</strong> enregistrés en dépôt',               t:'Il y a 30 min' },
  { ic:'fa-arrows-rotate',       bg:'var(--tl-bg)',               c:'var(--teal)',    msg:'Transfert <strong>TR-0041</strong> — MacBook à Mamadou Diallo',         t:'Il y a 2h'     },
  { ic:'fa-star',                bg:'rgba(245,158,11,.12)',        c:'#F59E0B',       msg:'AppleZone GN vous a noté <strong>5⭐</strong>',                          t:'Hier'          },
  { ic:'fa-phone',               bg:'var(--em-bg)',               c:'var(--emerald)',msg:'Client Fatoumata D. — colis récupéré avec succès',                       t:'Hier'          },
  { ic:'fa-triangle-exclamation',bg:'rgba(220,38,38,.09)',         c:'var(--red)',    msg:'Retour <strong>RET-0012</strong> — litige FashionHub GN',                t:'Ven.'          },
];
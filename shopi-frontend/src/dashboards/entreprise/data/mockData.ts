/*
 * FICHIER: src/dashboards/entreprise/data/mockData.ts
 * Données de démonstration pour le dashboard Entreprise (TechStore Conakry)
 * En production, ces données viendraient de l'API via commandesService.ts, etc.
 */

import type {
  Order, Product, Livreur, Correspondant, Client,
  Transaction, Promo, Message, Return, StockAlert, Review
} from '../types';

export const CA_DATA = [
  { m: 'Aoû', v: 89 },
  { m: 'Sep', v: 112 },
  { m: 'Oct', v: 98 },
  { m: 'Nov', v: 131 },
  { m: 'Déc', v: 118 },
  { m: 'Jan', v: 145 },
];

export const TOP_PRODS = [
  { em: '📱', nm: 'iPhone 15 Pro 256GB', ventes: 48, ca: '37.4M GNF', trend: 'up' },
  { em: '💻', nm: 'MacBook Air M3 16GB', ventes: 31, ca: '28.5M GNF', trend: 'up' },
  { em: '🎮', nm: 'PS5 Standard Edition', ventes: 24, ca: '26.4M GNF', trend: 'dn' },
  { em: '⌚', nm: 'Apple Watch Series 9', ventes: 19, ca: '8.8M GNF', trend: 'up' },
  { em: '🎧', nm: 'Sony WH-XM5', ventes: 17, ca: '5.9M GNF', trend: 'neu' },
];

export const ORDERS: Order[] = [
  { id:'SH-2025-0901', em:'📱', nm:'iPhone 15 Pro', vt:'256GB · Noir', client:'Mamadou K.', price:12500000, status:'new',  date:'Auj. 14h32', livreur:'Oumar D.',    zone:'Kaloum' },
  { id:'SH-2025-0900', em:'💻', nm:'MacBook Air M3', vt:'16GB RAM · Argent', client:'Aissatou B.', price:22000000, status:'prep', date:'Auj. 11h15', livreur:'Ibou S.', zone:'Ratoma' },
  { id:'SH-2025-0899', em:'🎮', nm:'PS5 Standard',   vt:'Edition 2024', client:'Thierno M.', price:11000000, status:'ship', date:'Hier 16h00', livreur:'Moussa C.',   zone:'Dixinn' },
  { id:'SH-2025-0898', em:'⌚', nm:'Apple Watch S9', vt:'45mm · Minuit', client:'Fatoumata S.', price:4600000, status:'del',  date:'Hier 09h22', livreur:'Alpha B.', zone:'Matoto' },
  { id:'SH-2025-0897', em:'🎧', nm:'AirPods Pro 2',  vt:'MagSafe USB-C', client:'Aliou D.', price:3200000, status:'can',  date:'20 jan.',     livreur:'—',           zone:'—' },
  { id:'SH-2025-0896', em:'🖥️', nm:'LG OLED 65" C3', vt:'4K 120Hz', client:'Mamadou C.', price:38000000, status:'ship', date:'20 jan.',     livreur:'Oumar D.',    zone:'Kaloum' },
  { id:'SH-2025-0895', em:'📷', nm:'Sony A7IV Body', vt:'Boîtier nu', client:'Kadiatou B.', price:21000000, status:'prep', date:'19 jan.',     livreur:'Ibou S.', zone:'Ratoma' },
  { id:'SH-2025-0894', em:'🖱️', nm:'MX Master 3S',   vt:'Graphite', client:'Ibrahima T.', price:1200000, status:'del', date:'18 jan.',      livreur:'Alpha B.', zone:'Matoto' },
];

export const PRODUCTS: Product[] = [
  { em:'📱', nm:'iPhone 15 Pro 256GB',  cat:'Smartphones',   price:12500000, old:13500000, stock:2,  ventes:48, note:4.9, promo:true,  active:true },
  { em:'💻', nm:'MacBook Air M3 16GB',  cat:'Ordinateurs',   price:22000000, stock:4,  ventes:31, note:4.8, promo:false, active:true },
  { em:'🎮', nm:'PS5 Standard',         cat:'Gaming',        price:11000000, stock:1,  ventes:24, note:4.7, promo:false, active:true },
  { em:'⌚', nm:'Apple Watch Series 9', cat:'Montres',       price:4600000,  stock:3,  ventes:19, note:4.8, promo:false, active:true },
  { em:'🎧', nm:'Sony WH-XM5',         cat:'Audio',         price:3500000,  stock:6,  ventes:17, note:4.9, promo:false, active:true },
  { em:'🖥️', nm:'LG OLED 65" C3',      cat:'TV & Écrans',   price:38000000, stock:0,  ventes:8,  note:4.6, promo:false, active:false },
  { em:'📷', nm:'Sony A7IV Body',       cat:'Photo & Vidéo', price:21000000, stock:1,  ventes:5,  note:4.7, promo:false, active:true },
  { em:'🖱️', nm:'MX Master 3S',         cat:'Accessoires',   price:1200000,  stock:8,  ventes:32, note:4.8, promo:true,  active:true },
  { em:'⌨️', nm:'Magic Keyboard FR',    cat:'Accessoires',   price:1800000,  stock:5,  ventes:22, note:4.6, promo:false, active:true },
];

export const LIVREURS: Livreur[] = [
  { em:'🛵', nm:'Oumar Diallo',   zone:'Kaloum & Plateau',  trips:312, rating:4.9, status:'online',  today:3 },
  { em:'🏍️', nm:'Ibrahima Sylla', zone:'Ratoma & Kipé',     trips:287, rating:4.8, status:'busy',    today:2 },
  { em:'🛵', nm:'Moussa Camara',  zone:'Dixinn & Matam',    trips:198, rating:4.7, status:'online',  today:1 },
  { em:'🏍️', nm:'Alpha Barry',    zone:'Matoto & Hamdallaye',trips:156, rating:4.6, status:'offline', today:0 },
  { em:'🛵', nm:'Mamadou Diop',   zone:'Tombolia & Bonfi',  trips:134, rating:4.5, status:'online',  today:2 },
  { em:'🏍️', nm:'Sekou Touré',    zone:'Cité Chemin de Fer',trips:89,  rating:4.4, status:'busy',    today:1 },
];

export const CORRESPONDANTS: Correspondant[] = [
  { nm:'RelaisPlus Conakry',     ville:'Conakry centre', cat:'Point relais principal', ord:42, em:'🏬' },
  { nm:'Kiosk Ratoma',           ville:'Ratoma',         cat:'Point relais',           ord:18, em:'🏪' },
  { nm:'Dépôt Guinée Forest.',   ville:'N\'Zérékoré',    cat:'Entrepôt régional',      ord:11, em:'🏭' },
  { nm:'Mamadou & Co.',          ville:'Labé',           cat:'Point relais',           ord:7,  em:'🏪' },
  { nm:'Export Conakry',         ville:'International',  cat:'Export Afrique Ouest',   ord:4,  em:'✈️' },
];

export const CLIENTS: Client[] = [
  { nm:'Mamadou Kouyaté',   email:'m.kouyate@email.com',  orders:12, total:'89 500 000',  seg:'VIP',     last:'Auj.'   },
  { nm:'Fatoumata Diallo',  email:'fata.diallo@email.com', orders:8,  total:'42 100 000',  seg:'Fidèle',  last:'Hier'   },
  { nm:'Ibrahima Barry',    email:'ibou.barry@email.com',  orders:3,  total:'15 600 000',  seg:'Régulier',last:'5 jan.' },
  { nm:'Aminata Camara',    email:'amina.c@email.com',     orders:1,  total:'2 100 000',   seg:'Nouveau', last:'12 jan.'},
  { nm:'Thierno Bah',       email:'t.bah@email.com',       orders:21, total:'214 000 000', seg:'VIP',     last:'Auj.'   },
  { nm:'Mariam Condé',      email:'mariam.c@email.com',    orders:6,  total:'38 900 000',  seg:'Fidèle',  last:'10 jan.'},
];

export const TRANSACTIONS: Transaction[] = [
  { ic:'💰', nm:'Vente iPhone 15 Pro',     sub:'SH-2025-0901',     amt:'+12 500 000', dir:'in',  bg:'var(--em-bg)' },
  { ic:'💸', nm:'Commission Shopi',        sub:'3% · Jan 2025',    amt:'-4 350 000',  dir:'out', bg:'var(--rs-bg)' },
  { ic:'💰', nm:'Vente MacBook Air M3',    sub:'SH-2025-0887',     amt:'+22 000 000', dir:'in',  bg:'var(--em-bg)' },
  { ic:'🚚', nm:'Frais de livraison',      sub:'42 livraisons',    amt:'-1 680 000',  dir:'out', bg:'var(--am-bg)' },
  { ic:'💰', nm:'Remboursement retour',    sub:'SH-2025-0801',     amt:'-2 100 000',  dir:'out', bg:'var(--rs-bg)' },
  { ic:'💳', nm:'Virement reçu',          sub:'Solde Jan sem. 2', amt:'+45 200 000', dir:'in',  bg:'var(--sky-2)' },
];

export const PROMOS: Promo[] = [
  { nm:'Soldes Janvier',  code:'TECH20',  type:'discount',  typeL:'Réduction 20%',    status:'active',    uses:284, max:500, revenue:'18.4M GNF', expire:'31 jan. 2025'  },
  { nm:'Livraison Offerte',code:'FREELIV',type:'free-ship', typeL:'Livraison gratuite',status:'active',    uses:156, max:300, revenue:'N/A',       expire:'28 jan. 2025'  },
  { nm:'Duo Apple',       code:'APPLE2',  type:'bundle',    typeL:'Bundle 2+1',        status:'scheduled', uses:0,   max:200, revenue:'—',         expire:'1–15 fév. 2025'},
  { nm:'Flash Gaming',    code:'GAME15',  type:'flash',     typeL:'Flash Sale 15%',    status:'draft',     uses:0,   max:100, revenue:'—',         expire:'À planifier'   },
];

export const MESSAGES: Message[] = [
  { nm:'Mamadou Kouyaté', txt:'Bonjour, mon colis est arrivé mais il manque le chargeur…', time:'14h32', unread:true,  av:'MK', color:'#1652F0' },
  { nm:'Fatoumata Diallo',txt:'Merci pour la livraison rapide ! 5 étoiles 🌟',             time:'11h15', unread:true,  av:'FD', color:'#059669' },
  { nm:'Ibrahima Sylla',  txt:'Est-ce que vous avez le Samsung S24 Ultra en stock ?',       time:'09h42', unread:true,  av:'IS', color:'#7C3AED' },
  { nm:'Aminata Bah',     txt:'Je souhaite retourner mon produit, comment faire ?',         time:'Hier',  unread:false, av:'AB', color:'#E11D48' },
  { nm:'Thierno Konaté',  txt:'Vous acceptez les paiements Orange Money ?',                time:'Hier',  unread:false, av:'TK', color:'#D97706' },
];

export const RETURNS: Return[] = [
  { id:'RET-0021', em:'📱', nm:'iPhone 15 Pro',    client:'Mariam C.',  motif:'Produit défectueux',              status:'pending',  date:'Auj.',   montant:'12 500 000' },
  { id:'RET-0020', em:'🎧', nm:'AirPods Pro 2',    client:'Thierno B.', motif:'Ne correspond pas à la description',status:'approved',date:'Hier',   montant:'3 200 000'  },
  { id:'RET-0019', em:'💻', nm:'MacBook Air M3',   client:'Aliou D.',   motif:'Changement d\'avis',              status:'refused',  date:'10 jan.',montant:'22 000 000' },
];

export const STOCK_ALERTS: StockAlert[] = [
  { em:'📱', nm:'iPhone 15 Pro 128GB',   qty:2, min:10, type:'red'   },
  { em:'🎮', nm:'PS5 Standard',          qty:1, min:5,  type:'red'   },
  { em:'💻', nm:'MacBook Air M3 16GB',   qty:4, min:8,  type:'amber' },
  { em:'⌚', nm:'Apple Watch S9',        qty:3, min:8,  type:'amber' },
  { em:'🎧', nm:'Sony XM5 Blanc',        qty:6, min:10, type:'amber' },
  { em:'🖥️', nm:'LG OLED 65" C3',       qty:0, min:3,  type:'red'   },
  { em:'🖱️', nm:'MX Master 3S',          qty:8, min:15, type:'amber' },
  { em:'📷', nm:'Sony A7IV Body',        qty:1, min:4,  type:'red'   },
  { em:'⌨️', nm:'Magic Keyboard FR',     qty:5, min:12, type:'amber' },
];

export const REVIEWS: Review[] = [
  {
    av:'MK', bg:'#EEF3FD', nm:'Mamadou Kouyaté', prod:'iPhone 15 Pro', stars:5,
    txt:'Excellent produit, livraison ultra rapide ! Je recommande à 100% TechStore Conakry.',
    date:'Auj. 14h12',
    reply:'Merci Mamadou ! Ravi de votre satisfaction. N\'hésitez pas à revenir 🙏',
  },
  {
    av:'FD', bg:'#F0FDF4', nm:'Fatoumata Diallo', prod:'MacBook Air M3', stars:5,
    txt:'Très bon service, produit conforme à la description. Le MacBook est parfait pour mon travail.',
    date:'Hier 11h20',
  },
  {
    av:'IS', bg:'#FAF5FF', nm:'Ibrahima Sylla', prod:'PS5 Standard', stars:4,
    txt:'Bon produit mais l\'emballage était légèrement abîmé à la réception. L\'article lui-même est nickel.',
    date:'20 jan.',
    reply:'Désolé pour l\'emballage Ibrahima ! Nous travaillons à améliorer notre packaging.',
  },
];

/** Données activité récente */
export const ACTIVITY = [
  { type:'order',   icon:'fa-box',       txt:'<strong>Nouvelle commande</strong> SH-2025-0901 — iPhone 15 Pro',  time:'14h32' },
  { type:'review',  icon:'fa-star',      txt:'<strong>Avis 5★</strong> reçu de Mamadou K. sur iPhone 15 Pro',    time:'14h12' },
  { type:'stock',   icon:'fa-triangle-exclamation', txt:'<strong>Stock critique</strong> PS5 Standard — 1 unité restante', time:'12h00' },
  { type:'payment', icon:'fa-coins',     txt:'<strong>Virement reçu</strong> 45 200 000 GNF — Semaine 2 Jan',    time:'10h15' },
  { type:'user',    icon:'fa-user-plus', txt:'<strong>Nouveau client</strong> Aminata Camara s\'est inscrite',     time:'09h42' },
];
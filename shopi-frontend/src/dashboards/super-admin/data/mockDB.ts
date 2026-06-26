// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/data/mockDB.ts
//
// Base de données simulée. En production, remplacez ces données
// par des appels API via src/modules/*/services/*.ts
// ─────────────────────────────────────────────────────────────

import type {
  InvitationCode,
  HealthService, Conversation
} from '../types/codes.types';

export const MOCK_CODES: InvitationCode[] = [
  { id:'CODE-001', value:'SHOPI-2024-ENT-A7X3', role:'company',       status:'valid',   created:'2024-05-01', expires:'2024-07-01', uses:0, maxUses:1, note:'Nouvelle boutique Conakry' },
  { id:'CODE-002', value:'SHOPI-2024-LIV-B8Y4', role:'delivery',      status:'valid',   created:'2024-05-10', expires:'2024-08-10', uses:1, maxUses:3, note:'Recrutement livreurs'        },
  { id:'CODE-003', value:'SHOPI-2024-ADM-C9Z5', role:'admin',         status:'expired', created:'2024-03-01', expires:'2024-04-01', uses:1, maxUses:1, note:''                           },
  { id:'CODE-004', value:'SHOPI-2024-PAR-D1W6', role:'partner',       status:'valid',   created:'2024-05-20', expires:'2024-09-20', uses:0, maxUses:2, note:'Partenaire Kindia'           },
  { id:'CODE-005', value:'SHOPI-2024-ENT-E2V7', role:'company',       status:'revoked', created:'2024-04-15', expires:'2024-07-15', uses:0, maxUses:1, note:'Annulé'                     },
  { id:'CODE-006', value:'SHOPI-2024-LIV-F3U8', role:'delivery',      status:'valid',   created:'2024-06-01', expires:'2024-12-01', uses:2, maxUses:5, note:'Campagne été'               },
];

export const MOCK_HEALTH: HealthService[] = [
  { name:'API Gateway',        val:98, unit:'% uptime',  color:'var(--acid)',   status:'Nominal' },
  { name:'Base de données',    val:72, unit:'% charge',  color:'var(--gold)',   status:'Normal'  },
  { name:'CDN Images',         val:99, unit:'% uptime',  color:'var(--acid)',   status:'Nominal' },
  { name:'Paiement MTN',       val:95, unit:'% succès',  color:'var(--acid)',   status:'Nominal' },
  { name:'Paiement Orange',    val:88, unit:'% succès',  color:'var(--sky)',    status:'Normal'  },
  { name:'Notifications Push', val:41, unit:'% charge',  color:'var(--acid)',   status:'Nominal' },
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  { id:1, userId:1, unread:2, messages:[
    { from:'user',  text:'Bonjour, j\'ai un problème avec ma boutique, je ne peux plus ajouter de produits.', time:'10:15' },
    { from:'admin', text:'Bonjour Mamadou, nous vérifions cela. Pouvez-vous me donner votre identifiant boutique ?',   time:'10:20' },
    { from:'user',  text:'Mon identifiant est SHOP-GN-001. Merci de votre aide.',                              time:'10:22' },
    { from:'user',  text:'Avez-vous pu résoudre le problème ?',                                                time:'14:10' },
  ]},
  { id:2, userId:4, unread:1, messages:[
    { from:'user',  text:'Bonjour, je souhaite étendre ma zone partenaire au Sénégal.',                       time:'Hier' },
    { from:'admin', text:'Bonjour Aissatou, votre demande est en cours d\'examen. Merci de votre confiance.', time:'Hier' },
    { from:'user',  text:'Merci. Quand puis-je avoir une réponse ?',                                          time:'09:30' },
  ]},
  { id:3, userId:7, unread:0, messages:[
    { from:'admin', text:'Bonjour Sekou, votre commande #3421 a bien été expédiée.', time:'Avant-hier' },
    { from:'user',  text:'Merci beaucoup !',                                          time:'Avant-hier' },
  ]},
  { id:4, userId:2, unread:0, messages:[
    { from:'user',  text:'Comment puis-je modifier mon adresse de livraison ?',        time:'Lundi' },
    { from:'admin', text:'Rendez-vous dans Paramètres > Adresses > Modifier.',         time:'Lundi' },
  ]},
];

// ─────────────────────────────────────────────────────────────
// Constantes partagées (labels, couleurs, emojis pays)
// ─────────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  company:       '🏪 Entreprise',
  delivery:      '🛵 Livreur',
  customer:      '🛒 Client',
  partner:       '🤝 Partenaire',
  admin:         '🛡 Admin',
  correspondent: '📦 Correspondant',
};

export const ROLE_PREFIX: Record<string, string> = {
  company:'ENT', delivery:'LIV', partner:'PAR', correspondent:'COR', admin:'ADM',
};

export const FLAGS: Record<string, string> = {
  GN:'🇬🇳', SN:'🇸🇳', ML:'🇲🇱', CI:'🇨🇮',
};

export const AV_COLORS: Record<string, [string, string]> = {
  company:       ['#38BFFF','#07243A'],
  delivery:      ['#F5A623','#301E05'],
  customer:      ['#00C88A','#052818'],
  partner:       ['#BF7FFF','#1E0D33'],
  admin:         ['#FF4464','#330B14'],
  correspondent: ['#607898','#0F1824'],
};
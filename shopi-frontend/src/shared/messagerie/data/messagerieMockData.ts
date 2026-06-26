/*
 * FICHIER : src/shared/messagerie/data/messagerieMockData.ts
 * Données mock conversations + utilisateurs.
 * À remplacer par GET /api/messages/conversations
 */
import type { ChatUser, Conversation, NewConvUser } from './messagerieTypes';

// ── Utilisateurs mock ──────────────────────────────────────────
export const MOCK_USERS: ChatUser[] = [
  { id:'u1', name:'TechStore Conakry',  role:'vendeur',       ava:'📱', avaColor:'linear-gradient(135deg,#EEF3FD,#C8D9F8)', online:true,  context:'Commande SH-2025-0901' },
  { id:'u2', name:'Mamadou Kouyaté',   role:'client',        ava:'MK', avaColor:'linear-gradient(135deg,#EEF3FD,#E2EAFB)', online:true,  context:'Livraison MIS-0124'     },
  { id:'u3', name:'Fatoumata Diallo',  role:'client',        ava:'FD', avaColor:'linear-gradient(135deg,#ECFDF5,#D1FAE5)', online:false, context:'Livraison MIS-0123'     },
  { id:'u4', name:'AppleZone GN',      role:'vendeur',       ava:'💻', avaColor:'linear-gradient(135deg,#FAF5FF,#EDE9FE)', online:true,  context:'Nouvelle mission'       },
  { id:'u5', name:'Ibrahima Sylla',    role:'livreur',       ava:'IS', avaColor:'linear-gradient(135deg,#EEF3FD,#C8D9F8)', online:false, context:'Correspondant Ratoma'   },
  { id:'u6', name:'Support Shopi',     role:'admin',         ava:'🛡️', avaColor:'linear-gradient(135deg,#FEF2F2,#FECACA)', online:true,  context:'Support technique'      },
  { id:'u7', name:'Amadou Partenaire', role:'partenaire',    ava:'AP', avaColor:'linear-gradient(135deg,#FAF5FF,#EDE9FE)', online:false, context:'Réseau livreurs'        },
  { id:'u8', name:'FashionHub GN',     role:'vendeur',       ava:'👗', avaColor:'linear-gradient(135deg,#FFF5F7,#FCE7F3)', online:true,  context:'Abonnement boutique'    },
  { id:'u9', name:'Sekou Correspondant', role:'correspondant', ava:'📍', avaColor:'linear-gradient(135deg,#FFF7ED,#FED7AA)', online:true, context:'Correspondant Kindia' },
];

// ── Conversations mock ──────────────────────────────────────────
export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id:'c1', userId:'u1', pinned:true, unread:2, lastTime:'14:32', muted:false,
    lastMsg:'⚡ Urgente : le client attend depuis 20 minutes, peut-tu accélérer ?',
    messages:[
      { id:'m1', from:'u1', type:'text', text:"Bonjour ! Nous avons une livraison urgente pour vous.", time:'09:00', read:true },
      { id:'m2', from:'me', type:'text', text:"D'accord, donnez-moi les détails.", time:'09:02', read:true },
      { id:'m3', from:'u1', type:'product', text:'Voici le produit à livrer :', time:'09:07', read:true,
        product:{ em:'📱', nm:'iPhone 15 Pro 256GB', price:'12 500 000 GNF' } },
      { id:'m4', from:'u1', type:'order', text:'Commande associée :', time:'09:08', read:true,
        order:{ id:'SH-2025-0901', nm:'iPhone 15 Pro 256GB', status:'En livraison' } },
      { id:'m5', from:'me', type:'text', text:'Parfait, je pars immédiatement !', time:'09:10', read:true },
      { id:'m6', from:'u1', type:'text', text:'⚡ Urgente : le client attend depuis 20 minutes, peut-tu accélérer ?', time:'14:32', read:false },
      { id:'m7', from:'u1', type:'text', text:'Sa livraison doit être faite avant 15h00.', time:'14:32', read:false },
    ],
  },
  {
    id:'c2', userId:'u2', pinned:false, unread:1, lastTime:'13:47', muted:false,
    lastMsg:"Êtes-vous arrivé ? Je suis au bureau du bâtiment A",
    messages:[
      { id:'m1', from:'u2', type:'text', text:'Bonjour monsieur le livreur, où êtes-vous exactement ?', time:'13:30', read:true },
      { id:'m2', from:'me', type:'text', text:"Bonjour ! Je suis à 5 minutes.", time:'13:31', read:true },
      { id:'m3', from:'u2', type:'voice', duration:'0:24', time:'13:40', read:true },
      { id:'m4', from:'u2', type:'text', text:"Êtes-vous arrivé ? Je suis au bureau du bâtiment A", time:'13:47', read:false },
    ],
  },
  {
    id:'c3', userId:'u3', pinned:false, unread:0, lastTime:'11:20', muted:false,
    lastMsg:'Merci beaucoup ! Tout est parfait 😊',
    messages:[
      { id:'m1', from:'u3', type:'text', text:'Bonjour, ma commande est bien partie ?', time:'10:15', read:true },
      { id:'m2', from:'me', type:'text', text:'Oui madame ! Je pars maintenant de la boutique.', time:'10:16', read:true },
      { id:'m3', from:'u3', type:'text', text:'Parfait. Mon adresse : Dixinn, maison jaune.', time:'10:18', read:true },
      { id:'m4', from:'me', type:'image', time:'11:15', read:true },
      { id:'m5', from:'u3', type:'text', text:'Merci beaucoup ! Tout est parfait 😊', time:'11:20', read:true },
    ],
  },
  {
    id:'c4', userId:'u4', pinned:false, unread:0, lastTime:'Hier', muted:false,
    lastMsg:'La nouvelle mission MacBook est disponible ce soir',
    messages:[
      { id:'m1', from:'u4', type:'text', text:'Bonjour, êtes-vous disponible pour une mission MacBook Air M3 ?', time:'09:00', read:true },
      { id:'m2', from:'me', type:'text', text:'Oui, envoyez-moi les détails.', time:'09:02', read:true },
      { id:'m3', from:'u4', type:'text', text:'La nouvelle mission MacBook est disponible ce soir', time:'18:30', read:true },
    ],
  },
  {
    id:'c5', userId:'u5', pinned:false, unread:0, lastTime:'Lun.', muted:true,
    lastMsg:'OK je couvre la zone Ratoma demain matin',
    messages:[
      { id:'m1', from:'me', type:'text', text:'Salut Ibrahima, tu peux couvrir Ratoma demain ?', time:'15:00', read:true },
      { id:'m2', from:'u5', type:'text', text:'OK je couvre la zone Ratoma demain matin', time:'15:10', read:true },
    ],
  },
  {
    id:'c6', userId:'u6', pinned:true, unread:0, lastTime:'Sam.', muted:false,
    lastMsg:'Votre compte est en règle, bonne continuation !',
    messages:[
      { id:'m1', from:'u6', type:'text', text:'Bonjour, votre dossier a bien été réceptionné.', time:'10:00', read:true },
      { id:'m2', from:'me', type:'text', text:'Merci ! Tout est en ordre ?', time:'10:05', read:true },
      { id:'m3', from:'u6', type:'text', text:'Votre compte est en règle, bonne continuation !', time:'10:10', read:true },
    ],
  },
  {
    id:'c7', userId:'u7', pinned:false, unread:0, lastTime:'Ven.', muted:false,
    lastMsg:'3 nouvelles boutiques dans votre réseau',
    messages:[
      { id:'m1', from:'u7', type:'text', text:'3 nouvelles boutiques dans votre réseau', time:'16:00', read:true },
    ],
  },
  {
    id:'c8', userId:'u8', pinned:false, unread:0, lastTime:'Jeu.', muted:false,
    lastMsg:'Vos livraisons ce mois ont été excellentes !',
    messages:[
      { id:'m1', from:'u8', type:'text', text:'Vos livraisons ce mois ont été excellentes !', time:'11:30', read:true },
    ],
  },
  {
    id:'c9', userId:'u9', pinned:false, unread:0, lastTime:'Mer.', muted:false,
    lastMsg:'Le dépôt de Kindia est prêt à recevoir les nouveaux colis.',
    messages:[
      { id:'m1', from:'u9', type:'text', text:'Le dépôt de Kindia est prêt à recevoir les nouveaux colis.', time:'09:45', read:true },
    ],
  },
];

// ── Utilisateurs pour la modale nouvelle conversation ──────────
export const MODAL_USERS: NewConvUser[] = [
  { id:'un1', name:'TechStore Conakry',   role:'vendeur',       ava:'📱', sub:'Boutique partenaire'   },
  { id:'un2', name:'AppleZone GN',        role:'vendeur',       ava:'💻', sub:'Boutique partenaire'   },
  { id:'un3', name:'Aminata Barry',       role:'client',        ava:'AB', sub:'Cliente régulière'      },
  { id:'un4', name:'Thierno Baldé',       role:'client',        ava:'TB', sub:'Client'                 },
  { id:'un5', name:'Kadiatou Mariam',     role:'livreur',       ava:'KM', sub:'Livreur Kaloum'         },
  { id:'un6', name:'Amadou Partenaire',   role:'partenaire',    ava:'AP', sub:'Partenaire réseau'      },
  { id:'un7', name:'Support Shopi',       role:'admin',         ava:'🛡️', sub:'Assistance technique'   },
  { id:'un8', name:'Sekou Correspondant', role:'correspondant', ava:'SC', sub:'Correspondant Kindia'   },
];
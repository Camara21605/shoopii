/* ================================================================
 * data/parametresData.ts
 * Toutes les données statiques des paramètres correspondant
 * ================================================================ */

/* ── Zones de couverture ── */
export interface Zone {
  id:   string;
  em:   string;
  nm:   string;
  stat: string;
  on:   boolean;
}

export const ZONES_INIT: Zone[] = [
  { id:'kaloum', em:'🏙️', nm:'Kaloum',  stat:'48 colis', on:true  },
  { id:'dixinn', em:'🌿', nm:'Dixinn',  stat:'36 colis', on:true  },
  { id:'matam',  em:'🏘️', nm:'Matam',   stat:'21 colis', on:true  },
  { id:'ratoma', em:'🌆', nm:'Ratoma',  stat:'28 colis', on:true  },
  { id:'matoto', em:'🌉', nm:'Matoto',  stat:'9 colis',  on:true  },
  { id:'coyah',  em:'⛰️', nm:'Coyah',   stat:'0 colis',  on:false },
];

/* ── Horaires ── */
export interface Horaire {
  jour:   string;
  ouvert: string;
  ferme:  string;
  actif:  boolean;
}

export const HORAIRES_INIT: Horaire[] = [
  { jour:'Lun', ouvert:'07:00', ferme:'20:00', actif:true  },
  { jour:'Mar', ouvert:'07:00', ferme:'20:00', actif:true  },
  { jour:'Mer', ouvert:'07:00', ferme:'20:00', actif:true  },
  { jour:'Jeu', ouvert:'07:00', ferme:'20:00', actif:true  },
  { jour:'Ven', ouvert:'07:00', ferme:'20:00', actif:true  },
  { jour:'Sam', ouvert:'08:00', ferme:'19:00', actif:true  },
  { jour:'Dim', ouvert:'09:00', ferme:'17:00', actif:false },
];

/* ── Méthodes de paiement ── */
export interface Paiement {
  em:   string;
  bg:   string;
  nm:   string;
  sub:  string;
  def:  boolean;
}

export const PAIEMENTS_INIT: Paiement[] = [
  { em:'🏦', bg:'rgba(255,165,0,.10)',  nm:'Orange Money',   sub:'+224 622 345 678',          def:true  },
  { em:'💛', bg:'rgba(255,200,0,.08)',  nm:'MTN Money',      sub:'+224 628 456 789',          def:false },
  { em:'🏛️', bg:'var(--sky-2,#E2EAFB)', nm:'Virement BICIGUI', sub:'Compte professionnel',   def:false },
];

/* ── Documents ── */
export type DocStatus = 'ok' | 'pend' | 'miss';

export interface Document {
  ic:  string;
  bg:  string;
  c:   string;
  nm:  string;
  sub: string;
  st:  DocStatus;
}

export const DOCUMENTS: Document[] = [
  { ic:'fa-id-card',    bg:'var(--em-bg)',  c:'var(--emerald)', nm:"Carte nationale d'identité",                  sub:'Recto-verso requis',                              st:'ok'   },
  { ic:'fa-building',   bg:'var(--em-bg)',  c:'var(--emerald)', nm:'Bail commercial / Attestation de local',       sub:'Document du point de dépôt',                      st:'ok'   },
  { ic:'fa-umbrella',   bg:'var(--cor-bg)', c:'var(--cor)',     nm:"Attestation d'assurance responsabilité",       sub:'Document requis pour les colis de valeur',        st:'pend' },
  { ic:'fa-file-shield',bg:'var(--em-bg)',  c:'var(--emerald)', nm:'Casier judiciaire (B3)',                       sub:'Moins de 3 mois',                                 st:'ok'   },
  { ic:'fa-camera',     bg:'var(--sky-2)',  c:'var(--blue)',    nm:'Photos du point de dépôt',                    sub:'3 photos minimum — intérieur + extérieur',        st:'ok'   },
  { ic:'fa-receipt',    bg:'var(--cor-bg)', c:'var(--cor)',     nm:'Registre de commerce / NIF',                  sub:'Pour facturation et commissions officielles',      st:'pend' },
];

/* ── Sessions ── */
export interface Session {
  ic:     string;
  nm:     string;
  detail: string;
  active: boolean;
}

export const SESSIONS: Session[] = [
  { ic:'fa-mobile-screen', nm:'iPhone 14 Pro', detail:'Conakry, GN · Chrome · Maintenant', active:true  },
  { ic:'fa-laptop',        nm:'MacBook Air',   detail:'Conakry, GN · Safari · Hier 18:45', active:false },
];

/* ── Types de colis acceptés ── */
export const COLIS_TYPES: string[] = [
  '📱 Électronique', '👗 Vêtements', '📦 Standard', '🍽️ Alimentation',
  '💊 Pharmacie',    '📄 Documents', '💎 Bijoux/Luxe', '🔧 Matériel',
];

/* ── Fréquences de virement ── */
export interface VirFreq {
  em:    string;
  nm:    string;
  sub:   string;
  prix:  string;
  sel:   boolean;
  color: string;
}

export const VIR_FREQ: VirFreq[] = [
  { em:'📅', nm:'Virement quotidien',     sub:'Chaque matin — commissions de la veille',         prix:'Gratuit',   sel:false, color:'var(--emerald)' },
  { em:'📆', nm:'Virement hebdomadaire',  sub:'Chaque lundi — commissions de la semaine',        prix:'Gratuit',   sel:true,  color:'var(--emerald)' },
  { em:'⚡', nm:'Retrait instantané',     sub:'À la demande via Wallet Shopi',                   prix:'−1.5%',     sel:false, color:'var(--cor)'     },
];

/* ── Toggles partagés (label, sub, checked, badge) ── */
export type BadgeType = 'rec' | 'new' | 'warn' | '';

export interface ToggleRow {
  label:   string;
  sub:     string;
  checked: boolean;
  badge:   BadgeType;
}

export const ZONE_AUTO_RULES: ToggleRow[] = [
  { label:'Refus automatique si capacité pleine',   sub:"Nouvelles demandes refusées automatiquement quand le dépôt est saturé",                  checked:true,  badge:'rec'  },
  { label:'Alerte si retard >48h',                  sub:'Notification automatique envoyée boutique + client si colis non récupéré',               checked:true,  badge:'rec'  },
  { label:'Mode urgence le week-end',               sub:'Accepter les dépôts urgents même hors plage horaire habituelle',                         checked:false, badge:'new'  },
  { label:'Pause automatique jours fériés',         sub:"Ne pas accepter de nouveau colis les jours fériés nationaux",                            checked:true,  badge:''     },
];

export const ACCESS_TOGGLES: ToggleRow[] = [
  { label:'Accès PMR (mobilité réduite)',   sub:'Le point de dépôt est accessible aux personnes à mobilité réduite',     checked:false, badge:''    },
  { label:'Parking disponible',            sub:'Un espace de stationnement est disponible à proximité',                  checked:true,  badge:''    },
  { label:'Vidéosurveillance',             sub:"Le local est équipé d'une caméra de sécurité",                           checked:true,  badge:'rec' },
  { label:'Stockage climatisé',            sub:'Disponible pour les colis sensibles à la température',                   checked:false, badge:'new' },
];

export const COLAB_TOGGLES: ToggleRow[] = [
  { label:'Accepter les boutiques non vérifiées',   sub:'Permettre à des boutiques sans badge Shopi de vous confier des colis',    checked:false, badge:''    },
  { label:'Auto-assigner les colis aux livreurs',   sub:'Assigner automatiquement les colis disponibles au livreur le mieux noté',  checked:true,  badge:'rec' },
  { label:'Notifier les boutiques à chaque mouvement', sub:'Informer la boutique à chaque dépôt, transfert et remise',             checked:true,  badge:''    },
  { label:'Partager les statistiques avec partenaires', sub:'Boutiques et livreurs voient vos stats de performance',               checked:true,  badge:''    },
];

export const INCIDENT_RULES: ToggleRow[] = [
  { label:'Initier le retour automatiquement si >7j',   sub:'Générer automatiquement un retour boutique après le délai configuré',              checked:true,  badge:'rec' },
  { label:'Alerter le support Shopi si litige',         sub:'Escalader automatiquement les litiges non résolus sous 24h',                       checked:true,  badge:'rec' },
  { label:'Bloquer un livreur après 3 incidents',       sub:'Suspendre temporairement un livreur ayant causé 3 incidents consécutifs',          checked:false, badge:''    },
  { label:'Photo obligatoire à la remise',              sub:'Exiger une photo de confirmation lors de chaque remise de colis',                   checked:true,  badge:'new' },
];

export const SEC_TOGGLES: ToggleRow[] = [
  { label:'Code SMS (2FA)',                 sub:'Code envoyé au +224 622 345 678 à chaque connexion',             checked:true,  badge:'rec' },
  { label:'Application Authenticator',     sub:'Google Authenticator / Authy — recommandé pour la sécurité maximale', checked:false, badge:'new' },
  { label:'Alerte connexion inconnue',     sub:'Notification immédiate si connexion depuis un nouvel appareil',   checked:true,  badge:''    },
];

export const NOTIF_COLIS: ToggleRow[] = [
  { label:'Nouveau colis déposé',          sub:"Dès qu'une boutique dépose un colis à votre relais",              checked:true,  badge:''    },
  { label:'Colis en attente > 48h',        sub:"Alerte automatique si un colis n'est pas récupéré",               checked:true,  badge:'rec' },
  { label:'Demande de transfert livreur',  sub:'Quand un livreur vient récupérer un colis',                       checked:true,  badge:''    },
  { label:'Colis récupéré par le client',  sub:'Confirmation de remise au destinataire final',                    checked:true,  badge:''    },
  { label:'Saturation du dépôt (>80%)',    sub:'Alerte prévention quand la capacité approche le maximum',         checked:true,  badge:'new' },
];

export const NOTIF_FINANCES: ToggleRow[] = [
  { label:'Commission encaissée',      sub:'Confirmation après chaque mission payée par Shopi',          checked:true,  badge:''    },
  { label:'Virement effectué',         sub:'Notification après chaque virement sur votre compte',        checked:true,  badge:''    },
  { label:'Bilan hebdomadaire',        sub:'Résumé performances + revenus chaque lundi matin',           checked:true,  badge:'rec' },
  { label:'Seuil Wallet atteint',      sub:'Alerte quand votre Wallet dépasse le seuil configuré',       checked:false, badge:''    },
];

export const NOTIF_CANAUX: ToggleRow[] = [
  { label:'Notifications push (app)', sub:"Sur votre smartphone via l'application Shopi",                checked:true,  badge:''    },
  { label:'SMS',                      sub:'Alertes critiques — colis urgents, saturation, litiges',     checked:true,  badge:''    },
  { label:'WhatsApp Business',        sub:'Notifications via WhatsApp',                                  checked:false, badge:'new' },
  { label:'Email',                    sub:'Bilans et documents officiels',                               checked:true,  badge:''    },
];

export const PRIV_VISIBILITE: ToggleRow[] = [
  { label:'Afficher mes statistiques de performance', sub:'Boutiques et livreurs voient vos taux de succès et délais', checked:true,  badge:'' },
  { label:'Afficher mon numéro de téléphone public',  sub:'Visible sur votre profil correspondant Shopi',              checked:false, badge:'' },
  { label:'Apparaître dans la recherche de relais',   sub:'Être trouvable par de nouvelles boutiques cherchant un correspondant', checked:true, badge:'' },
  { label:'Partager la localisation du dépôt',        sub:"Afficher l'adresse exacte dans les informations de livraison", checked:true, badge:'' },
];

export const PRIV_DATA: ToggleRow[] = [
  { label:'Amélioration des algorithmes Shopi', sub:"Permettre l'utilisation de vos données pour améliorer les recommandations", checked:true,  badge:''    },
  { label:'Statistiques anonymisées',           sub:'Partager vos stats dans les rapports agrégés Shopi',                        checked:true,  badge:''    },
  { label:'Rapports personnalisés',             sub:'Recevoir des analyses de performance adaptées à votre zone',                 checked:false, badge:'new' },
];

/* ── Navigation des sections ── */
export type SectionId =
  | 'profil' | 'depot' | 'zone' | 'entites' | 'colis'
  | 'paiement' | 'documents' | 'securite' | 'notifications'
  | 'confidentialite' | 'langue' | 'danger';

export interface NavItem {
  id:        SectionId;
  icon:      string;
  label:     string;
  pct?:      string;
  dotColor?: 'r' | 'a';
  isDanger?: boolean;
  group:     'Identité' | 'Activité' | 'Finances' | 'Compte';
}

export const NAV_ITEMS: NavItem[] = [
  // Identité
  { id:'profil',         icon:'fa-user',                 label:'Profil & Identité',      pct:'100%',  group:'Identité' },
  { id:'depot',          icon:'fa-store-alt',            label:'Point de dépôt',         pct:'100%',  group:'Identité' },
  // Activité
  { id:'zone',           icon:'fa-map-location-dot',     label:'Zone & Horaires',        pct:'80%',   group:'Activité' },
  { id:'entites',        icon:'fa-handshake',            label:'Entités partenaires',    pct:'100%',  group:'Activité' },
  { id:'colis',          icon:'fa-box',                  label:'Gestion des colis',      pct:'100%',  group:'Activité' },
  // Finances
  { id:'paiement',       icon:'fa-wallet',               label:'Paiement',               pct:'100%',  group:'Finances' },
  // Compte
  { id:'documents',      icon:'fa-file-shield',          label:'Documents',              dotColor:'a', group:'Compte' },
  { id:'securite',       icon:'fa-lock',                 label:'Sécurité',               pct:'100%',  group:'Compte'  },
  { id:'notifications',  icon:'fa-bell',                 label:'Notifications',          pct:'100%',  group:'Compte'  },
  { id:'confidentialite',icon:'fa-shield-halved',        label:'Confidentialité',        pct:'60%',   group:'Compte'  },
  { id:'langue',         icon:'fa-language',             label:'Langue',                              group:'Compte'  },
  { id:'danger',         icon:'fa-triangle-exclamation', label:'Zone sensible',          dotColor:'r', isDanger:true, group:'Compte' },
];
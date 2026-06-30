// src/dashboards/livreur/data/parametresData.ts
// Toutes les données des sections paramètres livreur

export type ParamSectionId =
  | 'profil' | 'docs' | 'zone' | 'vitesses' | 'vehicule'
  | 'paiement' | 'securite' | 'notifs' | 'confidentialite' | 'langue' | 'danger';

export const PARAM_SECTION_META: Record<ParamSectionId, { title: string; sub: string }> = {
  profil:          { title: 'Profil personnel',        sub: 'Informations publiques et photo'            },
  docs:            { title: 'Documents & Vérification', sub: 'Statut de vos documents officiels'         },
  zone:            { title: 'Zones & Horaires',         sub: 'Zones de livraison et planning'            },
  vitesses:        { title: 'Vitesses & Tarification',  sub: 'Modes proposés et grille tarifaire'        },
  vehicule:        { title: 'Véhicule & Capacité',      sub: 'Informations sur votre moto'               },
  paiement:        { title: 'Paiement',                 sub: 'Modes de retrait et wallet'                },
  securite:        { title: 'Sécurité & Connexion',     sub: 'Mot de passe et 2FA'                       },
  notifs:          { title: 'Notifications',            sub: 'Alertes et canaux'                         },
  confidentialite: { title: 'Confidentialité',          sub: 'Visibilité et données'                     },
  danger:          { title: 'Zone sensible',            sub: 'Actions irréversibles'                     },
};

// ── Zones ─────────────────────────────────────────────────
export interface ZoneItem { id: string; em: string; nm: string; stat: string; on: boolean; }
export const ZONES_DATA: ZoneItem[] = [
  { id:'kaloum', em:'🏙️', nm:'Kaloum', stat:'18 livr./mois', on:true  },
  { id:'dixinn', em:'🌿', nm:'Dixinn', stat:'14 livr./mois', on:true  },
  { id:'matam',  em:'🏘️', nm:'Matam',  stat:'7 livr./mois',  on:true  },
  { id:'ratoma', em:'🌆', nm:'Ratoma', stat:'3 livr./mois',  on:true  },
  { id:'matoto', em:'🌉', nm:'Matoto', stat:'1 livr./mois',  on:false },
  { id:'coyah',  em:'⛰️', nm:'Coyah',  stat:'0 livr./mois',  on:false },
];

export const JOURS      = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
export const HOR_OPEN   = ['07:00','07:00','07:00','07:00','07:00','09:00', null];
export const HOR_CLOSE  = ['21:00','21:00','21:00','21:00','21:00','18:00', null];

// ── Vitesses ───────────────────────────────────────────────
export interface SpeedItem { id: string; em: string; nm: string; mul: string; on: boolean; color: string; }
export const SPEEDS_DATA: SpeedItem[] = [
  { id:'eco', em:'🐢', nm:'Économique', mul:'×1.0', on:true,  color:'var(--blue)'    },
  { id:'std', em:'🚴', nm:'Standard',   mul:'×1.3', on:true,  color:'var(--emerald)' },
  { id:'exp', em:'🚀', nm:'Express',    mul:'×1.8', on:true,  color:'var(--amber)'   },
  { id:'ult', em:'⚡', nm:'Ultra',      mul:'×2.5', on:true,  color:'var(--red)'     },
];
export const SPEED_MULS: Record<string, number> = { eco:1.0, std:1.3, exp:1.8, ult:2.5 };

// ── Véhicule ───────────────────────────────────────────────
export const VEHICLE_TYPES = [
  { em:'🛵', nm:'Moto',     sub:'Livraisons rapides en ville · Idéal Conakry'  },
  { em:'🚴', nm:'Vélo',     sub:'Courses courtes · Éco-responsable'             },
  { em:'🚗', nm:'Voiture',  sub:'Colis volumineux · Grand rayon'                },
  { em:'🛺', nm:'Tricycle', sub:'Grande capacité · Zones périurbaines'          },
];
export const EMOJIS = ['🛵','🚴','🚗','🛺','🏍️','📦','⚡','🌟'];
export const COLIS_TYPES = [
  '📱 Électronique','👗 Vêtements','📦 Colis standard',
  '🍽️ Alimentation','💊 Pharmacie','📄 Documents',
];

// ── Paiement ───────────────────────────────────────────────
export const PAYMENT_METHODS = [
  { em:'🏦', bg:'rgba(255,165,0,.1)',   nm:'Orange Money',       sub:'+224 620 123 456', def:true  },
  { em:'💛', bg:'rgba(255,200,0,.08)', nm:'MTN Money',          sub:'+224 628 456 789', def:false },
  { em:'🏛️', bg:'var(--sky-2)',         nm:'Virement bancaire',  sub:'BICIGUI · Conakry', def:false },
];

export const VIREMENT_FREQ = [
  { em:'📅', nm:'Quotidien',    sub:'Chaque matin à 8h — gains de la veille',  badge:'Gratuit',  badgeColor:'var(--emerald)', sel:false },
  { em:'📆', nm:'Hebdomadaire', sub:'Chaque lundi — gains de la semaine',       badge:'Gratuit',  badgeColor:'var(--emerald)', sel:true  },
  { em:'⚡', nm:'Instantané',   sub:'À la demande, disponible immédiatement',    badge:'−1.5%',   badgeColor:'var(--amber)',   sel:false },
];

// ── Sécurité ───────────────────────────────────────────────
export const SESSIONS = [
  { ic:'fa-mobile-screen', nm:'iPhone 13 Pro', detail:'Conakry, GN · Chrome · Maintenant', active:true  },
  { ic:'fa-laptop',        nm:'MacBook Air',   detail:'Conakry, GN · Safari · Hier 19:30', active:false },
];

// ── Documents ──────────────────────────────────────────────
export type DocStatus = 'ok' | 'pend' | 'miss';
export interface DocItem { ic: string; bg: string; c: string; nm: string; sub: string; st: DocStatus; }
export const DOCS_DATA: DocItem[] = [
  { ic:'fa-id-card',     bg:'var(--em-bg)', c:'var(--emerald)', nm:"Carte d'identité nationale",  sub:'Recto-verso requis',            st:'ok'   },
  { ic:'fa-car',         bg:'var(--em-bg)', c:'var(--emerald)', nm:'Permis de conduire',           sub:'Valide',                        st:'ok'   },
  { ic:'fa-umbrella',    bg:'var(--am-bg)', c:'var(--amber)',   nm:"Attestation d'assurance",      sub:'Document PDF — doit être à jour', st:'pend' },
  { ic:'fa-file-shield', bg:'var(--em-bg)', c:'var(--emerald)', nm:'Casier judiciaire B3',          sub:'Moins de 3 mois',               st:'ok'   },
  { ic:'fa-motorcycle',  bg:'var(--sky-2)', c:'var(--blue)',    nm:'Carte grise véhicule',          sub:'Document officiel',             st:'ok'   },
];

// ── Notifications ──────────────────────────────────────────
export const NOTIFS_MISSIONS = [
  { l:'Nouvelles missions disponibles',    sub:"Alerte dès qu'une mission correspond à votre zone",  on:true  },
  { l:'Missions urgentes à proximité',     sub:'Notification prioritaire pour les urgences',         on:true  },
  { l:'Annulation de mission',             sub:"Quand une boutique annule une mission assignée",      on:true  },
  { l:'Rappel mission imminente',          sub:"Rappel 15 min avant la limite d'une livraison",      on:true  },
];
export const NOTIFS_FINANCES = [
  { l:'Gain encaissé',        sub:'Confirmation après chaque livraison payée', on:true  },
  { l:'Virement effectué',    sub:'Notification après chaque virement',        on:true  },
  { l:'Bilan hebdomadaire',   sub:'Résumé gains chaque lundi matin',           on:true  },
];
export const NOTIFS_CANAUX = [
  { l:'Notifications push (app)', sub:"Sur votre smartphone via l'app Shopi",     on:true  },
  { l:'SMS',                      sub:'Messages texte pour alertes critiques',     on:true  },
  { l:'WhatsApp',                 sub:'Notifications via WhatsApp Business',       on:false },
  { l:'Email',                    sub:'Résumés et documents importants',            on:true  },
];

// ── Confidentialité ────────────────────────────────────────
export const PRIVACY_ITEMS = [
  { l:'Afficher mon numéro de téléphone', sub:'Visible par les clients durant une livraison active',  on:false },
  { l:'Afficher mon historique',          sub:'Visible sur mon profil public',                        on:true  },
  { l:'Apparaître dans la recherche',     sub:'Être trouvable par de nouvelles boutiques',            on:true  },
  { l:'Localisation en temps réel',       sub:'Partagée uniquement durant la livraison active',       on:true  },
  { l:'Statistiques anonymisées',         sub:"Permettre à Shopi d'utiliser vos stats pour ses rapports", on:true },
  { l:'Publicité personnalisée',          sub:'Recevoir des offres adaptées à votre profil',          on:false },
];

// ── Disponibilité auto ─────────────────────────────────────
export const AUTO_DISPO = [
  { l:'Pause auto après 8h de travail', sub:'Passe hors ligne automatiquement après 8h consécutives', on:true,  badge:'rec' },
  { l:'Mode nuit (22h – 6h)',           sub:'Recevoir des missions la nuit avec majoration tarifaire', on:false, badge:'new' },
  { l:'Reprise automatique',            sub:'Repasser en ligne selon votre planning configuré',        on:true,  badge:'rec' },
  { l:'Pause le week-end',              sub:'Ne pas recevoir de missions samedi et dimanche',           on:false, badge:''    },
];

// ── Danger ─────────────────────────────────────────────────
export const DANGER_ITEMS = [
  { ttl:'Mettre mon compte en pause',   sub:'Arrêtez temporairement les missions sans perdre vos données.',                       btn:'Mettre en pause' },
  { ttl:'Désactiver temporairement',    sub:'Votre profil sera masqué 30 jours. Données conservées.',                              btn:'Désactiver'      },
  { ttl:'Supprimer définitivement',     sub:'Action irréversible — toutes vos données et gains non retirés seront perdus.',        btn:'Supprimer le compte' },
];

// ── Utilitaires ────────────────────────────────────────────
export const fmtGNF = (n: number) => n.toLocaleString('fr') + ' GNF';
/**
 * @file   constants.ts
 * @module settings
 *
 * Toutes les constantes du module Settings :
 *   TABS              — définition des 9 onglets (id, icône, label, couleur)
 *   CURRENCIES        — devises disponibles pour la plateforme
 *   TIMEZONES         — fuseaux horaires disponibles (format IANA)
 *   PAYMENT_PROVIDERS — 4 fournisseurs de mobile money africains
 *   DEFAULT_SETTINGS  — valeurs par défaut de PlatformSettings
 */

import type { SettingsTab, PlatformSettings } from './types';

/* ─────────────────────────────────────────────────────────────
 * ONGLETS
 * ─────────────────────────────────────────────────────────────
 * Chaque onglet a :
 *   id    — identifiant technique (type SettingsTab)
 *   icon  — emoji affiché dans le bouton de navigation
 *   label — texte du bouton
 *   color — couleur CSS utilisée pour l'accentuation active
 */
export const TABS: {
  id:    SettingsTab;
  icon:  string;
  label: string;
  color: string;
}[] = [
  { id: 'general',       icon: '🌍', label: 'Général',       color: 'var(--sky)'    },
  { id: 'securite',      icon: '🔐', label: 'Sécurité',      color: 'var(--rose)'   },
  { id: 'inscriptions',  icon: '👥', label: 'Inscriptions',  color: 'var(--acid)'   },
  { id: 'catalogue',     icon: '🗂️', label: 'Catalogue',     color: 'var(--gold)'   },
  { id: 'paiements',     icon: '💳', label: 'Paiements',     color: 'var(--violet)' },
  { id: 'notifications', icon: '🔔', label: 'Notifications', color: 'var(--gold)'   },
  { id: 'integrations',  icon: '🔗', label: 'Intégrations',  color: 'var(--sky)'    },
  { id: 'apparence',     icon: '🎨', label: 'Apparence',     color: 'var(--violet)' },
  { id: 'danger',        icon: '⚠️', label: 'Danger',        color: 'var(--rose)'   },
];

/* ─────────────────────────────────────────────────────────────
 * DEVISES
 * ─────────────────────────────────────────────────────────────
 * Codes ISO 4217 supportés par la plateforme.
 * Utilisés dans l'onglet Général (sélecteur de devise principale)
 * et dans l'onglet Paiements (affichage des montants).
 */
export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'GNF', label: 'Franc Guinéen (GNF)'       },
  { code: 'XOF', label: 'Franc CFA BCEAO (XOF)'     },
  { code: 'EUR', label: 'Euro (EUR)'                 },
  { code: 'USD', label: 'Dollar US (USD)'            },
  { code: 'MAD', label: 'Dirham Marocain (MAD)'      },
  { code: 'NGN', label: 'Naira Nigérian (NGN)'       },
  { code: 'GHS', label: 'Cedi Ghanéen (GHS)'         },
  { code: 'KES', label: 'Shilling Kenyan (KES)'      },
  { code: 'CDF', label: 'Franc Congolais (CDF)'      },
];

/* ─────────────────────────────────────────────────────────────
 * FUSEAUX HORAIRES
 * ─────────────────────────────────────────────────────────────
 * Format IANA (ex: "Africa/Conakry").
 * Le backend stocke ce champ dans la colonne `timezone`.
 */
export const TIMEZONES: string[] = [
  'Africa/Conakry',
  'Africa/Dakar',
  'Africa/Bamako',
  'Africa/Abidjan',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Africa/Tunis',
  'Africa/Casablanca',
  'Europe/Paris',
  'UTC',
];

/* ─────────────────────────────────────────────────────────────
 * FOURNISSEURS DE PAIEMENT MOBILE
 * ─────────────────────────────────────────────────────────────
 * key       → champ correspondant dans PlatformSettings
 * name      → nom commercial affiché
 * icon      → emoji représentant la marque
 * countries → pays où ce provider est actif
 * color     → couleur de la marque (pour le fond de la carte)
 * desc      → description courte
 */
export const PAYMENT_PROVIDERS: {
  key:       keyof PlatformSettings;
  name:      string;
  icon:      string;
  countries: string[];
  color:     string;
  desc:      string;
}[] = [
  {
    key:       'mtnMoneyEnabled',
    name:      'MTN Mobile Money',
    icon:      '🟡',
    countries: ['Guinée', 'Cameroun', 'Côte d\'Ivoire'],
    color:     '#FDD835',
    desc:      'Paiement mobile MTN — 300M+ abonnés Afrique',
  },
  {
    key:       'orangeMoneyEnabled',
    name:      'Orange Money',
    icon:      '🟠',
    countries: ['Guinée', 'Sénégal', 'Mali'],
    color:     '#FF5722',
    desc:      'Paiement mobile Orange — 80+ pays',
  },
  {
    key:       'waveEnabled',
    name:      'Wave',
    icon:      '🔵',
    countries: ['Sénégal', 'Mali', 'Côte d\'Ivoire'],
    color:     '#1565C0',
    desc:      'Transferts instantanés Wave — frais 0%',
  },
  {
    key:       'moovMoneyEnabled',
    name:      'Moov Money',
    icon:      '🟢',
    countries: ['Guinée', 'Togo', 'Bénin'],
    color:     '#2E7D32',
    desc:      'Paiement mobile Moov / Atlantique Telecom',
  },
];

/* ─────────────────────────────────────────────────────────────
 * VALEURS PAR DÉFAUT
 * ─────────────────────────────────────────────────────────────
 * Utilisées comme état initial dans SettingsSection avant le
 * chargement des vraies données depuis l'API.
 * Doivent correspondre aux valeurs par défaut de l'entité backend.
 */
export const DEFAULT_SETTINGS: PlatformSettings = {
  platformName:           'Shopi Africa',
  platformTagline:        null,
  supportEmail:           null,
  defaultCurrency:        'GNF',
  defaultLanguage:        'fr',
  emailVerifRequired:     true,
  adminTwoFaRequired:     true,
  maxLoginAttempts:       5,
  sessionTimeoutMin:      60,
  tokenValidityHours:     24,
  rateLimitPerMin:        100,
  openSignup:             true,
  codeRequiredForCompany: true,
  kycRequired:            false,
  manualVendorApproval:   false,
  reportsBeforeSuspend:   5,
  savResponseSlaHours:    24,
  maintenanceMode:        false,
  platformCommission:     6,
  timezone:               'Africa/Conakry',
  minWithdrawalAmount:    10000,
  maxTransactionAmount:   5000000,
  settlementDelayDays:    2,
  mtnMoneyEnabled:        true,
  orangeMoneyEnabled:     true,
  waveEnabled:            false,
  moovMoneyEnabled:       false,
  emailNotifEnabled:      true,
  pushNotifEnabled:       true,
  smsNotifEnabled:        false,
  cpuAlertPct:            80,
  ramAlertPct:            85,
  analyticsTrackingId:    null,
  facebookPixelId:        null,
  webhookUrl:             null,
  primaryColor:           '#00C88A',
  logoUrl:                null,
  faviconUrl:             null,
};

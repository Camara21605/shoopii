/* ================================================================
 * FICHIER : profil-correspondant/data/correspondantMock.ts
 *
 * Données mock du profil (détails riches non encore en base :
 * services, zones, tarifs, horaires, avis, galerie).
 * L'identité + KPI de base viennent de l'API quand disponible.
 * ================================================================ */

import type {
  CorrProfil, InfoPratique, ScheduleRow, Service, ZoneCard, PaysPartenaire,
  TarifRow, AvisScore, AvisItem, GalerieItem, ContactRow, VerifRow, SimilaireItem,
} from './types';

/* Profil de base (fallback si API indispo) */
export const CORR_MOCK: CorrProfil = {
  id: 'mock', nom: 'Amadou Bah', initiales: 'AB',
  type: 'regional', typeLabel: 'Correspondant Régional',
  localisation: 'Almamya, Kaloum · Conakry, Guinée 🇬🇳',
  enLigne: true, membreDepuis: 'Partenaire depuis jan. 2021', abonnes: 1284,
  badges: [
    { label: 'Identité vérifiée', type: 'verif'   },
    { label: 'Assuré Shopi',      type: 'assur'   },
    { label: 'Top Correspondant 2024', type: 'top' },
    { label: 'Partenaire Premium', type: 'premium' },
  ],
  bio: [
    "Correspondant régional Shopi basé à Almamya, Kaloum depuis 2021. Spécialisé dans la réception, le stockage sécurisé et la remise de colis, particulièrement dans l'électronique, le prêt-à-porter et les produits importés d'Europe et d'Afrique de l'Ouest.",
    "Mon dépôt est situé au cœur de Kaloum, à 5 minutes du Port Autonome de Conakry, ce qui facilite les opérations de réception directe depuis les imports maritimes. Je travaille avec 3 livreurs Shopi pour assurer les remises à domicile en moins de 2 heures.",
    "Disponible 6j/7 avec permanence téléphonique 24h/24. Stockage sécurisé avec vidéosurveillance pour les colis de valeur.",
  ],
  missions: 1840, missionsMois: 28, note: 4.9, nbAvis: 342,
  fiabilite: 99, experience: '4 ans', zonesCount: 3, delaiMoyen: '< 2h',
};

export const ABOUT_TAGS = [
  'Électronique', 'Prêt-à-porter', 'Bijoux & Accessoires', 'Électroménager',
  'Livres & Documents', 'Médicaments (certifié)', "Envois d'argent partenaire",
];

export const INFOS_PRATIQUES: InfoPratique[] = [
  { icone: 'fa-location-dot', label: 'Adresse du dépôt',     valeur: 'Rue KA-012, Almamya', sub: 'Kaloum, Conakry · Face au marché' },
  { icone: 'fa-clock',        label: "Horaires d'ouverture", valeur: 'Lun–Sam 08h00–20h00', sub: 'Dimanche sur RDV uniquement' },
  { icone: 'fa-phone',        label: 'Contact direct',       valeur: '+224 622 458 901',    sub: 'Disponible 24h/24 pour urgences' },
  { icone: 'fa-whatsapp',     label: 'WhatsApp',             valeur: '+224 622 458 901',    sub: 'Réponse en moins de 30 min' },
  { icone: 'fa-box',          label: 'Capacité de stockage', valeur: "Jusqu'à 500 kg / 8 m³", sub: 'Stockage sécurisé vidéosurveillé' },
  { icone: 'fa-language',     label: 'Langues parlées',      valeur: 'Français · Pular · Soussou', sub: "Notions d'anglais" },
  { icone: 'fa-credit-card',  label: 'Paiements acceptés',   valeur: 'Orange Money · MTN · Cash', sub: 'Visa sur demande' },
  { icone: 'fa-truck',        label: 'Livraison à domicile', valeur: 'Oui · via livreur partenaire', sub: 'Délai : 1–2h dans Kaloum' },
];

export const SCHEDULE: ScheduleRow[] = [
  { jour: 'Lundi',    heures: '08h00 – 20h00', statut: 'open',    statutLabel: 'Ouvert'    },
  { jour: 'Mardi',    heures: '08h00 – 20h00', statut: 'open',    statutLabel: 'Ouvert'    },
  { jour: 'Mercredi', heures: '08h00 – 20h00', statut: 'open',    statutLabel: 'Ouvert'    },
  { jour: 'Jeudi',    heures: '08h00 – 20h00', statut: 'open',    statutLabel: 'Ouvert', aujourdhui: true },
  { jour: 'Vendredi', heures: '08h00 – 13h00', statut: 'partial', statutLabel: 'Partiel'   },
  { jour: 'Samedi',   heures: '09h00 – 18h00', statut: 'open',    statutLabel: 'Ouvert'    },
  { jour: 'Dimanche', heures: 'Sur rendez-vous', statut: 'closed', statutLabel: 'RDV seul.' },
];

export const SERVICES: Service[] = [
  { emoji: '📦', nom: 'Réception de colis',  desc: 'Réception depuis tous transporteurs (DHL, Colissimo, FedEx, bateau). Notification immédiate SMS/WhatsApp.', prix: "Inclus dans l'abonnement Shopi" },
  { emoji: '🏪', nom: 'Stockage sécurisé',   desc: 'Dépôt climatisé avec vidéosurveillance 24h/24. Capacité 500 kg. Stockage 1 à 30 jours.', prix: 'À partir de 5 000 GNF/jour' },
  { emoji: '🛵', nom: 'Remise à domicile',   desc: 'Livraison directe via nos livreurs partenaires dans tout Kaloum. Délai moyen : 1h30. Suivi GPS.', prix: '10 000 – 25 000 GNF selon zone' },
  { emoji: '✉️', nom: 'Expédition sortante', desc: "Envoi vers l'étranger ou autres wilayas. Partenariats DHL, Chronopost, transporteurs locaux.", prix: 'Sur devis selon destination' },
  { emoji: '💰', nom: "Transfert d'argent",  desc: 'Point relais Western Union agréé. Réception/envoi depuis la diaspora. Conversion GNF/EUR/USD.', prix: 'Commission : 1.5 – 3%' },
  { emoji: '🔄', nom: 'Retours & échanges',  desc: 'Gestion des retours vers les boutiques Shopi. Vérification, emballage retour, dépôt transporteur.', prix: 'Gratuit pour les retours Shopi' },
  { emoji: '📋', nom: 'Dédouanement assisté',desc: 'Accompagnement douanier pour colis importés. Réseau d\'agents en douane à Conakry.', prix: '50 000 – 150 000 GNF' },
  { emoji: '📏', nom: 'Pesage & mensuration',desc: 'Pesage précis (balance certifiée), mensuration, photos à l\'arrivée, rapport détaillé.', prix: '2 000 GNF / colis' },
];

export const ZONES: ZoneCard[] = [
  { nom: 'Almamya',     detail: 'Kaloum · Dépôt principal',   badge: 'Dépôt',       badgeType: 'main'    },
  { nom: 'Boulbinet',   detail: 'Kaloum · Couverture totale', badge: 'Principal',   badgeType: 'main'    },
  { nom: 'Coronthie',   detail: 'Kaloum · Remise express',    badge: 'Express',     badgeType: 'main'    },
  { nom: 'Coleah',      detail: 'Matam · Via livreur',        badge: 'Secondaire',  badgeType: 'sec'     },
  { nom: 'Camayenne',   detail: 'Dixinn · Sur demande',       badge: 'Secondaire',  badgeType: 'sec'     },
  { nom: 'Port Conakry',detail: 'Import maritime direct',     badge: 'Partenaire',  badgeType: 'partner' },
];

export const PAYS_PARTENAIRES: PaysPartenaire[] = [
  { flag: '🇫🇷', nom: 'France',        villes: 'Paris, Lyon, Marseille'  },
  { flag: '🇸🇳', nom: 'Sénégal',       villes: 'Dakar, Thiès, Ziguinchor' },
  { flag: '🇨🇮', nom: "Côte d'Ivoire", villes: 'Abidjan, Bouaké'          },
  { flag: '🇧🇪', nom: 'Belgique',      villes: 'Bruxelles, Liège'         },
  { flag: '🇲🇦', nom: 'Maroc',         villes: 'Casablanca, Rabat'        },
  { flag: '🇨🇳', nom: 'Chine',         villes: 'Guangzhou, Yiwu'          },
];

export const TARIFS: TarifRow[] = [
  { service: 'Réception standard',       sub: 'Notification SMS + WhatsApp', prix: 'Gratuit',           note: 'Inclus Shopi'            },
  { service: 'Réception lourde (5–20 kg)', sub: 'Pesage + photos inclus',    prix: '15 000 GNF',        note: '12 750 GNF abonné'       },
  { service: 'Stockage par jour',        sub: 'Sécurisé vidéosurveillé',    prix: '5 000 GNF/j',       note: 'Gratuit 3 premiers jours' },
  { service: 'Livraison Kaloum',         sub: 'Délai 1–2h, suivi GPS',      prix: '10 000 GNF',        note: '8 500 GNF abonné'        },
  { service: 'Livraison Matam / Dixinn', sub: 'Via livreur partenaire',     prix: '20 000 GNF',        note: '17 000 GNF abonné'       },
  { service: 'Expédition Europe',        sub: 'DHL / Chronopost',           prix: 'Sur devis',         note: 'Délai 5–10 jours'        },
  { service: 'Expédition maritime',      sub: 'Groupage disponible',        prix: 'Sur devis',         note: 'Délai 21–45 jours'       },
  { service: 'Dédouanement assisté',     sub: 'Accompagnement complet',     prix: '50 000–150 000 GNF',note: 'Selon valeur déclarée'   },
  { service: 'Transfert Western Union',  sub: 'Point relais agréé',         prix: '1.5 – 3%',          note: 'Selon montant'           },
];

export const AVIS_SCORE: AvisScore = {
  moyenne: 4.9, total: 342,
  repartition: [
    { etoiles: 5, count: 301, pct: 88 },
    { etoiles: 4, count: 31,  pct: 9  },
    { etoiles: 3, count: 7,   pct: 2  },
    { etoiles: 2, count: 2,   pct: 1  },
    { etoiles: 1, count: 1,   pct: 0  },
  ],
  keywords: [
    { mot: 'Fiable', count: 187 }, { mot: 'Rapide', count: 143 },
    { mot: 'Professionnel', count: 128 }, { mot: 'Disponible 24h', count: 96 },
    { mot: 'Bien situé', count: 74 }, { mot: 'Recommande', count: 68 },
    { mot: 'Soigneux', count: 52 },
  ],
};

export const AVIS: AvisItem[] = [
  { id: 'r1', initiales: 'MK', nom: 'Mamadou Kouyaté', note: 5, date: '12 janvier 2025', verifie: true, utile: 34,
    texte: "Amadou est vraiment exceptionnel ! Mon iPhone 15 Pro commandé en France est arrivé en parfait état en seulement 10 jours. Il m'a tenu informé à chaque étape : dédouanement, arrivée au dépôt, puis livraison à domicile dans Kaloum en 1h30. Je recommande !",
    reponse: { auteur: 'Amadou Bah', texte: "Merci Mamadou pour votre confiance ! C'est toujours un plaisir de travailler avec des clients sérieux. N'hésitez pas pour vos prochains achats !" } },
  { id: 'r2', initiales: 'FK', nom: 'Fatoumata Kourouma', note: 5, date: '8 janvier 2025', verifie: true, utile: 28,
    texte: "Je fais confiance à Amadou depuis 2 ans pour tous mes achats depuis la diaspora. Toujours disponible, très réactif sur WhatsApp et traite les colis avec soin. Le stockage sécurisé m'a sauvé la mise plusieurs fois !" },
  { id: 'r3', initiales: 'IS', nom: 'Ibrahima Soumah', note: 4, date: '2 janvier 2025', verifie: true, utile: 12,
    texte: "Bon correspondant, sérieux et ponctuel. Petit délai sur un dédouanement mais bien communiqué. Je referai appel à ses services." },
];

export const GALERIE: GalerieItem[] = [
  { emoji: '🏪', label: 'Façade dépôt', principale: true },
  { emoji: '📦' }, { emoji: '🔐' }, { emoji: '🏗️' }, { emoji: '📷' }, { emoji: '⚖️' }, { emoji: '🗂️' },
];

/* ── Sidebar ── */
export const CONTACTS: ContactRow[] = [
  { icone: 'fa-phone',        label: 'Téléphone principal', valeur: '+224 622 458 901'    },
  { icone: 'fa-envelope',     label: 'Email',               valeur: 'amadou.bah@shopi.gn' },
  { icone: 'fa-location-dot', label: 'Adresse dépôt',       valeur: 'Rue KA-012, Almamya' },
];

export const STATS_SIDEBAR = [
  { v: '1 840', l: 'Missions totales' }, { v: '4.9★', l: 'Note moyenne' },
  { v: '99%',   l: 'Taux fiabilité'  }, { v: '< 2h', l: 'Délai remise'   },
  { v: '28',    l: 'Missions ce mois'}, { v: '0',    l: 'Litiges résolus'},
];

export const VERIFICATIONS: VerifRow[] = [
  { label: 'Identité vérifiée (CNI)',      sub: 'Vérifié le 12 jan. 2021'       },
  { label: 'Adresse vérifiée',             sub: 'Dépôt inspecté mars 2024'      },
  { label: 'Téléphone vérifié',            sub: 'Orange Money confirmé'         },
  { label: 'Couverture assurance Shopi',   sub: "Jusqu'à 5 000 000 GNF"         },
  { label: 'Contrat partenaire signé',     sub: 'Renouvelé jan. 2025'           },
  { label: 'Certification Premium',        sub: 'Renouvellement prévu fév. 2025' },
];

export const SIMILAIRES: SimilaireItem[] = [
  { id: 's1', initiales: 'IS', nom: 'Ibrahima Sow',     meta: '🗺️ Zonal · Matam',    note: 4.8, suivi: false },
  { id: 's2', initiales: 'BJ', nom: 'Binta Jalloh',     meta: '🗺️ Zonal · Kaloum',   note: 4.8, suivi: false },
  { id: 's3', initiales: 'SC', nom: 'Sekou Condé',      meta: '🏠 Régional · Ratoma', note: 4.9, suivi: false },
  { id: 's4', initiales: 'MK', nom: 'Mariama Kouyaté',  meta: '🌍 National · Ratoma', note: 4.7, suivi: false },
];
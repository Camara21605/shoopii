/* ================================================================
 * FICHIER : src/modules/commande/data/commandeMock.ts
 *
 * Données mock d'une commande pour le développement.
 * En production → GET /commandes/:id (voir services/commande.api.ts)
 *
 * ⚠️ Les codes de validation sont présents ici UNIQUEMENT pour la
 *    démo. En réel, chaque acteur reçoit SON code par SMS/notif et
 *    le backend vérifie — le frontend ne connaît jamais les codes
 *    des autres acteurs.
 * ================================================================ */

import type { Commande } from './types';

export const COMMANDE_MOCK: Commande = {
  id:           'SH-4521',
  datePaiement: '14 janvier 2025',
  destination:  'Kaloum, Conakry',

  acteurs: [
    {
      role: 'entreprise', nom: 'TechCorp Guinée', sousTitre: 'Entreprise vendeuse',
      initiales: 'TC', icone: 'fa-store',
      action: "Confirme la commande et prépare le colis. Saisissez le code reçu par l'entreprise.",
    },
    {
      role: 'livreur', nom: 'Mamadou Diallo', sousTitre: 'Livreur',
      initiales: 'MD', icone: 'fa-motorcycle',
      action: "Récupère le colis auprès de l'entreprise. En validant, il confirme à tous qu'il détient le colis.",
    },
    {
      role: 'correspondant', nom: 'Amadou Bah', sousTitre: 'Correspondant — Relais Kaloum',
      initiales: 'AB', icone: 'fa-map-pin',
      action: 'Réceptionne le colis au point relais. En validant, il confirme la réception au dépôt.',
    },
    {
      role: 'client', nom: 'Fatoumata Camara', sousTitre: 'Client (destinataire)',
      initiales: 'FC', icone: 'fa-user',
      action: 'Reçoit le colis. En validant, le client confirme la réception — ce qui déclenche le versement des commissions.',
    },
  ],

  articles: [
    { emoji: '📱', nom: 'iPhone 15 Pro 256 Go', boutique: 'TechCorp Guinée', qty: 1, prix: 12500000 },
    { emoji: '🎧', nom: 'AirPods Pro 2',         boutique: 'TechCorp Guinée', qty: 1, prix: 1850000 },
  ],

  montant: {
    sousTotal:          14350000,
    livraison:          85000,
    fraisCorrespondant: 25000,
    total:              14460000,
  },

  commissions: [
    { role: 'entreprise',    nom: 'TechCorp Guinée', libelle: 'Vente produits',          montant: 14002500, icone: 'fa-store' },
    { role: 'livreur',       nom: 'Mamadou Diallo',  libelle: 'Frais de livraison',      montant: 85000,    icone: 'fa-motorcycle' },
    { role: 'correspondant', nom: 'Amadou Bah',      libelle: 'Frais correspondant',     montant: 25000,    icone: 'fa-map-pin' },
    { role: 'shopi',         nom: 'Shopi',           libelle: 'Commission plateforme (3 %)', montant: 347500, icone: 'fa-percent' },
  ],

  /* Codes démo (à retirer en production) */
  codes: {
    entreprise:    '741852',
    livreur:       '309417',
    correspondant: '628193',
    client:        '175064',
  },
};
/* ================================================================
 * FICHIER : src/modules/home/components/correspondants/data/correspondantsMock.ts
 *
 * Données mock de secours (si l'API n'est pas joignable).
 * La vraie source est GET /suivis/correspondants.
 * ================================================================ */

import type { Correspondant } from './types';

export const CORRESPONDANTS_MOCK: Correspondant[] = [
  { id: 'm1', nom: 'Amadou Bah', initiales: 'AB', zone: 'Almamya, Kaloum · Conakry', commune: 'kaloum',
    bio: "Correspondant fiable depuis 4 ans. Spécialisé dans la réception de colis tech et électronique.",
    type: 'regional', note: 4.9, nbAvis: 342, missions: 1840, fiabilite: 99, experience: '4 ans', enLigne: true, suivi: true },
  { id: 'm2', nom: 'Fatoumata Kouyaté', initiales: 'FK', zone: 'Ratoma · Conakry', commune: 'ratoma',
    bio: "Spécialiste des envois nationaux et internationaux. Réception sécurisée 7j/7.",
    type: 'national', note: 4.8, nbAvis: 215, missions: 1320, fiabilite: 98, experience: '3 ans', enLigne: true, suivi: true },
  { id: 'm3', nom: 'Ibrahima Sow', initiales: 'IS', zone: 'Matam · Conakry', commune: 'matam',
    bio: "Relais de proximité pour la zone Matam. Disponible en semaine.",
    type: 'zonal', note: 4.7, nbAvis: 128, missions: 740, fiabilite: 96, experience: '2 ans', enLigne: true, suivi: false },
];
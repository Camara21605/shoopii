/* ============================================================
 * FICHIER : src/modules/geo/region-kankan.ts
 *
 * Région de Kankan (Haute-Guinée) — pour l'instant la préfecture de Siguiri
 * seule (Kankan, Kérouané, Kouroussa et Mandiana viendront ensuite). Même
 * organisation que region-mamou.ts : chaque sous-préfecture est sa commune
 * rurale, le chef-lieu de préfecture est une commune urbaine (Siguiri-Centre).
 *
 * Sources :
 *   · 12 sous-préfectures historiques : INS, « Liste des sous-préfectures »
 *     (stat-guinee.org) et recensement 2014 (citypopulation.de) ;
 *   · 8 nouvelles sous-préfectures : annuaire statistique INS de la région de
 *     Kankan et décision de nomination des 20 sous-préfets de Siguiri
 *     (guineenews, juin 2026) — Didi, Kourémalé, Tomba-Kansa, Tomboni, Fidako,
 *     Djomabana, Mignada, Koumandjambougou ; Tomba-Kansa, Fidako et
 *     Koumandjambougou sont aussi des communes rurales de la loi de 2024 ;
 *   · quartiers et districts de la commune urbaine : site de la mairie de
 *     Siguiri (quartiers Siguiri Koro, Bolibana, Kouroudakoro, Siguiri Koura,
 *     Fodéba Keïta, Téléladji, Bananinkoro, Saint-Alexis) complété par la carte
 *     scolaire (ecolesenguinee.com, 39 quartiers et districts) — à vérifier
 *     auprès de la mairie ;
 *   · districts des communes rurales : non publiés en ligne — à compléter par
 *     l'Import.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives ;
 * Kiniébakoura absente de la carte, donc sans coordonnées.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

const rurale = (nom: string, code: string, lat?: number, lng?: number): SeedCommune => ({ nom, code, type: 'rurale', lat, lng });

export const REGION_KANKAN: SeedRegion = {
  nom: 'Kankan', code: 'GN-KAN', chefLieu: 'Kankan', lat: 10.38352, lng: -9.30694,
  prefectures: [
    {
      nom: 'Siguiri', code: 'GN-KAN-SIG', chefLieu: 'Siguiri', lat: 11.41953, lng: -9.17515,
      communes: [
        {
          nom: 'Siguiri-Centre', code: 'GN-KAN-SIG-CU', type: 'urbaine', lat: 11.41953, lng: -9.17515,
          quartiers: [
            /* Quartiers de la ville */
            'Siguiri Koro I', 'Siguiri Koro II', 'Siguiri Koura I', 'Siguiri Koura II',
            'Bolibana I', 'Bolibana II', 'Kouroudakoro I', 'Kouroudakoro II',
            'Bananinkoro', 'Saint-Alexis', 'Fodéba Keïta', 'Téléladji', 'Kourouni', 'Énergie', 'ORS',
            /* Districts du territoire communal */
            'Bambala', 'Dankakoro', 'Diatela', 'Djilengbè', 'Fadjoukola', 'Falama',
            'Fodéoulenbougou', 'Gbogoroma', 'Kiniébakoro', 'Kissakolen', 'Kobada', 'Koda',
            'Kofilani', 'Kolenda', 'Moya Fara I', 'Niandankoura', 'Saourou', 'Sèbèkoro',
            'Somonobougou-Niger', 'Sougoula', 'Tabako', 'Tambabougou', 'Tiguibiry', 'Yorola',
          ],
        },
        rurale('Bankon', 'GN-KAN-SIG-BAN', 11.55821, -8.80064),
        rurale('Doko', 'GN-KAN-SIG-DOK', 11.78098, -8.96251),
        rurale('Franwalia', 'GN-KAN-SIG-FRA', 11.70048, -9.38215),
        rurale('Kiniébakoura', 'GN-KAN-SIG-KIN'),
        rurale('Kintinian', 'GN-KAN-SIG-KTN', 11.60349, -9.37573),
        rurale('Maléah', 'GN-KAN-SIG-MAL', 11.80042, -9.71018),
        rurale('Naboun', 'GN-KAN-SIG-NAB', 11.98031, -9.51385),
        rurale('Niagassola', 'GN-KAN-SIG-NIA', 12.31242, -9.1197),
        rurale('Niandankoro', 'GN-KAN-SIG-NDK', 11.07616, -9.24966),
        rurale('Norassoba', 'GN-KAN-SIG-NOR', 10.92423, -9.48097),
        rurale('Nounkounkan', 'GN-KAN-SIG-NOU', 10.96835, -9.38927),
        rurale('Siguirini', 'GN-KAN-SIG-SGN', 11.82392, -10.0378),
        /* Nouvelles sous-préfectures */
        rurale('Didi', 'GN-KAN-SIG-DID', 11.54893, -9.60377),
        rurale('Kourémalé', 'GN-KAN-SIG-KOU', 11.94842, -8.801),
        rurale('Tomba-Kansa', 'GN-KAN-SIG-TOM', 11.7257, -10.18658),
        rurale('Tomboni', 'GN-KAN-SIG-TBN', 11.80662, -9.20611),
        rurale('Fidako', 'GN-KAN-SIG-FID', 12.1055, -9.17278),
        rurale('Djomabana', 'GN-KAN-SIG-DJO', 11.26419, -9.13234),
        rurale('Mignada', 'GN-KAN-SIG-MIG', 11.63871, -9.63352),
        rurale('Koumandjambougou', 'GN-KAN-SIG-KMB', 11.44823, -8.97536),
      ],
    },
  ],
};

/* ============================================================
 * FICHIER : src/modules/geo/region-labe.ts
 *
 * Région de Labé (Moyenne-Guinée) : 5 préfectures — Labé, Koubia, Lélouma,
 * Mali, Tougué. Même organisation que region-mamou.ts : chaque sous-préfecture
 * est sa commune rurale, le chef-lieu de préfecture est une commune urbaine.
 *
 * Sources :
 *   · sous-préfectures : INS, « Liste des sous-préfectures » (stat-guinee.org) ;
 *   · quartiers de la commune urbaine de Labé : Plan de développement local
 *     2025-2029 de la commune (28 quartiers) + 3 quartiers créés en août 2025
 *     (N'djolou Koulounabhé, Domby, Horé-Hollaadé — issus de Pounthioun, Daka 1
 *     et Companya) = 31 ;
 *   · districts des communes rurales et quartiers de Koubia, Lélouma, Mali et
 *     Tougué-Centre : non publiés en ligne — à compléter par l'Import.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

const rurale = (nom: string, code: string, lat?: number, lng?: number): SeedCommune => ({ nom, code, type: 'rurale', lat, lng });

export const REGION_LABE: SeedRegion = {
  nom: 'Labé', code: 'GN-LAB', chefLieu: 'Labé', lat: 11.323, lng: -12.28225,
  prefectures: [
    {
      nom: 'Labé', code: 'GN-LAB-LAB', chefLieu: 'Labé', lat: 11.323, lng: -12.28225,
      communes: [
        {
          nom: 'Labé-Centre', code: 'GN-LAB-LAB-CU', type: 'urbaine', lat: 11.323, lng: -12.28225,
          quartiers: [
            'Bambaya', 'Companya', 'Daka I', 'Daka II', 'Domby', 'Donghol',
            'Donghol Dayèbhè', 'Donghora', 'Dow-Saarè', 'Fady', 'Fafabhè', 'Falo-Bowé',
            'Hoorè Saala', 'Horé-Hollaadé', 'Konkola', 'Koulidara', 'Kouroula', 'Lombonna',
            'Madina', 'Mairie', 'Mosquée', 'N\'djolou Koulounabhé', 'Nadhel', 'Pétéwel',
            'Poréko', 'Pounthioun', 'Saala N\'douyèhè', 'Safatou I', 'Safatou II', 'Tata I',
            'Tata II',
          ],
        },
        rurale('Dalein', 'GN-LAB-LAB-DAL', 11.51632, -12.3078),
        rurale('Daralabé', 'GN-LAB-LAB-DAR', 11.22302, -12.31456),
        rurale('Diari', 'GN-LAB-LAB-DIA', 11.33444, -12.49659),
        rurale('Dionfo', 'GN-LAB-LAB-DIO', 11.33642, -12.05591),
        rurale('Garambé', 'GN-LAB-LAB-GAR', 11.26448, -12.35566),
        rurale('Hafia', 'GN-LAB-LAB-HAF', 11.21817, -12.39269),
        rurale('Kaalan', 'GN-LAB-LAB-KAA', 11.30765, -12.15393),
        rurale('Kouramangui', 'GN-LAB-LAB-KOU', 11.50998, -12.43783),
        rurale('Noussy', 'GN-LAB-LAB-NOU', 11.2696, -12.17269),
        rurale('Popodara', 'GN-LAB-LAB-POP', 11.4013, -12.40484),
        rurale('Sannoun', 'GN-LAB-LAB-SAN', 11.41347, -12.11243),
        rurale('Taranbaly', 'GN-LAB-LAB-TAR'),
        rurale('Tountouroun', 'GN-LAB-LAB-TOU'),
      ],
    },
    {
      nom: 'Koubia', code: 'GN-LAB-KOU', chefLieu: 'Koubia', lat: 11.58603, lng: -11.89433,
      communes: [
        { nom: 'Koubia-Centre', code: 'GN-LAB-KOU-CU', type: 'urbaine', lat: 11.58603, lng: -11.89433 },
        rurale('Fafaya', 'GN-LAB-KOU-FAF', 11.70867, -11.69591),
        rurale('Gadha-Woundou', 'GN-LAB-KOU-GAD', 11.82275, -11.56796),
        rurale('Matakaou', 'GN-LAB-KOU-MAT', 11.71958, -11.94837),
        rurale('Missira', 'GN-LAB-KOU-MIS', 11.44155, -11.97249),
        rurale('Pilimini', 'GN-LAB-KOU-PIL', 11.55257, -12.15163),
      ],
    },
    {
      nom: 'Lélouma', code: 'GN-LAB-LEL', chefLieu: 'Lélouma', lat: 11.42572, lng: -12.68285,
      communes: [
        { nom: 'Lélouma-Centre', code: 'GN-LAB-LEL-CU', type: 'urbaine', lat: 11.42572, lng: -12.68285 },
        rurale('Balaya', 'GN-LAB-LEL-BAL', 11.4256, -12.73238),
        rurale('Djountou', 'GN-LAB-LEL-DJO', 11.48997, -12.53919),
        rurale('Hérico', 'GN-LAB-LEL-HER'),
        rurale('Korbé', 'GN-LAB-LEL-KOR', 11.465, -12.62214),
        rurale('Lafou', 'GN-LAB-LEL-LAF', 11.5867, -12.46526),
        rurale('Linsan-Saran', 'GN-LAB-LEL-LIN', 11.76773, -12.67553),
        rurale('Manda', 'GN-LAB-LEL-MAN'),
        rurale('Parawol', 'GN-LAB-LEL-PAR', 11.35804, -12.63025),
        rurale('Sagalé', 'GN-LAB-LEL-SAG', 11.30898, -12.83216),
        rurale('Tyanguel-Bori', 'GN-LAB-LEL-TYA', 11.63506, -12.53741),
      ],
    },
    {
      nom: 'Mali', code: 'GN-LAB-MAL', chefLieu: 'Mali', lat: 12.07552, lng: -12.29569,
      communes: [
        { nom: 'Mali-Centre', code: 'GN-LAB-MAL-CU', type: 'urbaine', lat: 12.07552, lng: -12.29569 },
        rurale('Balaki', 'GN-LAB-MAL-BAL', 12.15129, -11.83181),
        rurale('Donghol-Sigon', 'GN-LAB-MAL-DON'),
        rurale('Dougountouny', 'GN-LAB-MAL-DOU', 11.85571, -12.61676),
        rurale('Fougou', 'GN-LAB-MAL-FOU', 11.90601, -12.29847),
        rurale('Gayah', 'GN-LAB-MAL-GAY', 12.01281, -12.42674),
        rurale('Hidayatou', 'GN-LAB-MAL-HID', 11.91079, -12.23593),
        rurale('Lébékéré', 'GN-LAB-MAL-LEB'),
        rurale('Madina-Wora', 'GN-LAB-MAL-MAD', 12.02873, -12.49815),
        rurale('Salambandé', 'GN-LAB-MAL-SAL', 11.83043, -11.8855),
        rurale('Téliré', 'GN-LAB-MAL-TEL', 11.8463, -12.0965),
        rurale('Touba', 'GN-LAB-MAL-TOU', 12.18666, -12.66174),
        rurale('Yembéreng', 'GN-LAB-MAL-YEM', 11.8162, -12.34912),
      ],
    },
    {
      nom: 'Tougué', code: 'GN-LAB-TOU', chefLieu: 'Tougué', lat: 11.43946, lng: -11.66295,
      communes: [
        { nom: 'Tougué-Centre', code: 'GN-LAB-TOU-CU', type: 'urbaine', lat: 11.43946, lng: -11.66295 },
        rurale('Fatako', 'GN-LAB-TOU-FAT', 11.21388, -11.88853),
        rurale('Fello-Koundoua', 'GN-LAB-TOU-FEL', 11.82509, -11.32591),
        rurale('Kansangui', 'GN-LAB-TOU-KAN', 11.18724, -11.65202),
        rurale('Kolangui', 'GN-LAB-TOU-KOL'),
        rurale('Kollet', 'GN-LAB-TOU-KET', 11.48786, -11.54781),
        rurale('Konah', 'GN-LAB-TOU-KON', 11.44855, -11.84446),
        rurale('Kouratongo', 'GN-LAB-TOU-KOU', 11.63227, -11.48453),
        rurale('Koyin', 'GN-LAB-TOU-KOY', 11.22097, -11.80967),
        rurale('Tangaly', 'GN-LAB-TOU-TAN'),
      ],
    },
  ],
};

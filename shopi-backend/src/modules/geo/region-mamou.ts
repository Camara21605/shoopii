/* ============================================================
 * FICHIER : src/modules/geo/region-mamou.ts
 *
 * Région de Mamou (Moyenne-Guinée) : 3 préfectures — Mamou, Dalaba, Pita.
 *
 * Le référentiel de Shoneya a 5 niveaux (pays › région › préfecture › commune ›
 * quartier) : il n'a pas de niveau « sous-préfecture ». En Guinée, chaque
 * sous-préfecture correspond à une COMMUNE RURALE de même nom et de même
 * territoire ; le chef-lieu de préfecture est une COMMUNE URBAINE. Elles sont
 * donc enregistrées comme communes (type rurale / urbaine), et leurs districts
 * (ruraux) ou quartiers (urbains) au niveau « quartier ».
 *
 * Sources :
 *   · sous-préfectures : INS, « Liste des sous-préfectures » (stat-guinee.org),
 *     annuaire statistique régional de Mamou 2022 ;
 *   · quartiers de la commune urbaine de Mamou : liste par sous-préfecture de
 *     ecolesenguinee.com (Mamou-Centre, 28 quartiers) ;
 *   · districts des communes rurales et quartiers de Dalaba-Centre et Pita-Centre :
 *     non publiés en ligne — à compléter par l'administration (Import CSV).
 * Coordonnées : position du chef-lieu sur la carte (OpenStreetMap), approximative.
 * ============================================================ */

export interface SeedCommune { nom: string; code: string; type: 'urbaine' | 'rurale'; lat?: number; lng?: number; quartiers?: string[] }
export interface SeedPrefecture { nom: string; code: string; chefLieu: string; lat: number; lng: number; communes: SeedCommune[] }
export interface SeedRegion { nom: string; code: string; chefLieu: string; lat: number; lng: number; prefectures: SeedPrefecture[] }

const rurale = (nom: string, code: string, lat?: number, lng?: number): SeedCommune => ({ nom, code, type: 'rurale', lat, lng });

export const REGION_MAMOU: SeedRegion = {
  nom: 'Mamou', code: 'GN-MAM', chefLieu: 'Mamou', lat: 10.37407, lng: -12.08356,
  prefectures: [
    {
      nom: 'Mamou', code: 'GN-MAM-MAM', chefLieu: 'Mamou', lat: 10.37407, lng: -12.08356,
      communes: [
        {
          nom: 'Mamou-Centre', code: 'GN-MAM-MAM-CU', type: 'urbaine', lat: 10.37407, lng: -12.08356,
          quartiers: [
            'Abattoir I', 'Abattoir II', 'Almamya-Dumez', 'Almamya-Mosquée', 'Almamya-Résidence', 'Almamya-Terrain',
            'Boulbinet', 'Horé Fello I', 'Horé Fello II', 'Horé-Mamou', 'Kimbely I', 'Kimbely II', 'Koumy',
            'Loppet I', 'Loppet II', 'Loppet-École', 'Madina-Km 15', 'Madina-Mosquée', 'Madina-Scierie', 'Madina-Tambassa',
            'Petel I', 'Petel II', 'Poudrière I', 'Poudrière II', 'Sabou', 'Sèrè', 'Télico', 'Thiewgol',
          ],
        },
        rurale('Bouliwel', 'GN-MAM-MAM-BOU', 10.61018, -12.18932),
        rurale('Dounet', 'GN-MAM-MAM-DOU', 10.51337, -11.9187),
        rurale('Gongoret', 'GN-MAM-MAM-GON', 10.77115, -11.95199),
        rurale('Kégnéko', 'GN-MAM-MAM-KEG', 10.54111, -11.78085),
        rurale('Konkouré', 'GN-MAM-MAM-KON', 10.31102, -12.23625),
        rurale('Nyagara', 'GN-MAM-MAM-NYA', 10.76091, -11.79366),
        rurale('Ouré-Kaba', 'GN-MAM-MAM-OUR', 10.13706, -11.66149),
        rurale('Porédaka', 'GN-MAM-MAM-POR', 10.73254, -12.06757),
        rurale('Saramoussaya', 'GN-MAM-MAM-SAR', 10.67964, -11.62995),
        rurale('Soyah', 'GN-MAM-MAM-SOY'),
        rurale('Téguéréya', 'GN-MAM-MAM-TEG'),
        rurale('Timbo', 'GN-MAM-MAM-TIM', 10.63426, -11.82845),
        rurale('Tolo', 'GN-MAM-MAM-TOL', 10.54025, -12.14619),
      ],
    },
    {
      nom: 'Dalaba', code: 'GN-MAM-DAL', chefLieu: 'Dalaba', lat: 10.69119, lng: -12.25162,
      communes: [
        { nom: 'Dalaba-Centre', code: 'GN-MAM-DAL-CU', type: 'urbaine', lat: 10.69119, lng: -12.25162 },
        rurale('Bodié', 'GN-MAM-DAL-BOD', 11.02447, -12.05229),
        rurale('Ditinn', 'GN-MAM-DAL-DIT', 10.8825, -12.1768),
        rurale('Kaala', 'GN-MAM-DAL-KAA', 10.80155, -12.20605),
        rurale('Kankalabé', 'GN-MAM-DAL-KAN', 11.14787, -12.00038),
        rurale('Kébali', 'GN-MAM-DAL-KEB', 10.95706, -12.19575),
        rurale('Koba', 'GN-MAM-DAL-KOB', 10.62917, -12.32162),
        rurale('Mafara', 'GN-MAM-DAL-MAF', 10.90319, -11.97963),
        rurale('Mitty', 'GN-MAM-DAL-MIT', 10.83216, -12.31933),
        rurale('Mombéyah', 'GN-MAM-DAL-MOM', 11.21364, -12.06908),
      ],
    },
    {
      nom: 'Pita', code: 'GN-MAM-PIT', chefLieu: 'Pita', lat: 11.05646, lng: -12.39505,
      communes: [
        { nom: 'Pita-Centre', code: 'GN-MAM-PIT-CU', type: 'urbaine', lat: 11.05646, lng: -12.39505 },
        rurale('Bantignel', 'GN-MAM-PIT-BAN', 11.10971, -12.29958),
        rurale('Bourouwal-Tappé', 'GN-MAM-PIT-BOU', 10.98977, -12.38621),
        rurale('Dongol-Touma', 'GN-MAM-PIT-DON'),
        rurale('Gongore', 'GN-MAM-PIT-GON', 10.82777, -12.40373),
        rurale('Ley-Miro', 'GN-MAM-PIT-LEY'),
        rurale('Maci', 'GN-MAM-PIT-MAC', 10.90276, -12.43189),
        rurale('Ninguélandé', 'GN-MAM-PIT-NIN', 11.18533, -12.66007),
        rurale('Sangaréah', 'GN-MAM-PIT-SAN'),
        rurale('Sintali', 'GN-MAM-PIT-SIN', 11.0907, -12.42528),
        rurale('Timbi-Madina', 'GN-MAM-PIT-TMA', 11.20206, -12.54285),
        rurale('Timbi-Touni', 'GN-MAM-PIT-TTO', 11.12021, -12.50404),
      ],
    },
  ],
};

/* ============================================================
 * FICHIER : src/modules/geo/region-mamou.ts
 *
 * Région de Mamou (Moyenne-Guinée) : 4 préfectures — Mamou, Timbo (préfecture
 * depuis le décret du 20 août 2026), Dalaba, Pita.
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
 *   · Dalaba et Pita : quartiers des communes urbaines (Dalaba-Centre 7,
 *     Pita-Centre 13) et districts de leurs 20 communes rurales, liste par
 *     sous-préfecture de ecolesenguinee.com (carte scolaire) — Syli et
 *     Pellel-Yéro recoupés par l'histoire de Dalaba (maguineeinfos) ; à
 *     vérifier auprès des mairies ;
 *   · districts des 12 communes rurales de Mamou et de Timbo : liste par
 *     sous-préfecture de ecolesenguinee.com (carte scolaire) — à vérifier ;
 *   · Timbo préfecture : décret du 20 août 2026 (guineenews).
 * Coordonnées : position du chef-lieu sur la carte (OpenStreetMap), approximative.
 * ============================================================ */

export interface SeedCommune { nom: string; code: string; type: 'urbaine' | 'rurale'; lat?: number; lng?: number; quartiers?: string[] }
export interface SeedPrefecture {
  nom: string; code: string; chefLieu: string; lat: number; lng: number; communes: SeedCommune[];
  /** Préfecture dont cette préfecture a été détachée (décret du 20 août 2026) : une commune déjà
   *  enregistrée là-bas sous le même nom y est rattachée à la nouvelle préfecture, au lieu d'être recréée. */
  anciennement?: string;
}
export interface SeedRegion { nom: string; code: string; chefLieu: string; lat: number; lng: number; prefectures: SeedPrefecture[] }

/** Commune rurale (= sous-préfecture), avec ses districts quand on les connaît. */
const rurale = (nom: string, code: string, lat?: number, lng?: number, quartiers?: string[]): SeedCommune =>
  ({ nom, code, type: 'rurale', lat, lng, ...(quartiers ? { quartiers } : {}) });

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
        rurale('Bouliwel', 'GN-MAM-MAM-BOU', 10.61018, -12.18932, [
          'Bouliwel-Centre', 'Bounanya', 'Bhawo-Fello', 'Dianya', 'Dounki', 'Kelliwol', 'Lapouwol',
          'Kendouma', 'Loopy', 'Sennadé', 'Soriya',
        ]),
        rurale('Dounet', 'GN-MAM-MAM-DOU', 10.51337, -11.9187, [
          'Dounet-Centre', 'Alphayah', 'Bassambayah', 'Diatabayah', 'Dindeyah', 'Hadji', 'Hindé', 'Fatouyah',
          'Söbeyah', 'Soumbalako-Maoundé',
        ]),
        rurale('Gongoret', 'GN-MAM-MAM-GON', 10.77115, -11.95199, [
          'Gongoret-Centre', 'Kourou', 'Poukou', 'Dougoulen',
        ]),
        rurale('Kégnéko', 'GN-MAM-MAM-KEG', 10.54111, -11.78085, [
          'Kégnéko-Centre', 'Missira', 'Dalaoulen', 'Hérico', 'Harounaya', 'Afia Baniré',
        ]),
        rurale('Konkouré', 'GN-MAM-MAM-KON', 10.31102, -12.23625, [
          'Konkouré-Centre', 'Hoolo', 'Foyé', 'Tamagaly', 'Tambabètè', 'Bilima-Kanté', 'Bilima-Missidè',
        ]),
        rurale('Nyagara', 'GN-MAM-MAM-NYA', 10.76091, -11.79366, [
          'Nyagara-Centre', 'Morifatanden', 'Torobhe', 'Mangol', 'Labico', 'Botorhè',
        ]),
        rurale('Ouré-Kaba', 'GN-MAM-MAM-OUR', 10.13706, -11.66149, [
          'Ouré-Kaba-Centre', 'Seleya', 'Kegnegbe', 'Portofita', 'Diandian', 'Madina', 'Sébékoto',
          'Sogoroya', 'Sitacoto', 'Yomaya-Limban', 'Alphaya', 'Bantamaya', 'Banekoto',
        ]),
        rurale('Porédaka', 'GN-MAM-MAM-POR', 10.73254, -12.06757, [
          'Porédaka', 'Bhouriya', 'Dar-es-Salam', 'Dogol-Dieïdi', 'N\'Diaré', 'Kollissoko', 'Sankaréla',
          'Tounkan',
        ]),
        rurale('Saramoussaya', 'GN-MAM-MAM-SAR', 10.67964, -11.62995, [
          'Saramoussaya-Centre', 'Bourouwil', 'Dounkiba', 'Garankéla', 'Derméla', 'Fodé-Hadji', 'Kénéwol',
          'Kourouya', 'Nyénouya', 'Sarébowal', 'Sokotoro',
        ]),
        rurale('Soyah', 'GN-MAM-MAM-SOY', undefined, undefined, [
          'Soyah-Centre', 'Berteya', 'Farenta', 'Bhoully', 'Kenten', 'Nobè',
        ]),
        rurale('Téguéréya', 'GN-MAM-MAM-TEG', undefined, undefined, [
          'Téguéréya', 'Finala', 'N\'Diarédi', 'Missidé-Kollen', 'Bourouwal', 'Boko',
        ]),
        rurale('Tolo', 'GN-MAM-MAM-TOL', 10.54025, -12.14619, [
          'Tolo-Centre', 'Gouba', 'Moronde', 'Siminko', 'Soumbalako-Togossere',
        ]),
      ],
    },
    {
      /* Préfecture depuis le décret du 20 août 2026 (ancienne sous-préfecture de Mamou) : en attendant
         l'arrêté qui fixe sa composition, elle contient la seule commune de Timbo. */
      nom: 'Timbo', code: 'GN-MAM-TIM', chefLieu: 'Timbo', lat: 10.63426, lng: -11.82845, anciennement: 'Mamou',
      communes: [
        rurale('Timbo', 'GN-MAM-TIM-TIM', 10.63426, -11.82845, [
          'Timbo-Centre', 'Diafouna', 'Dara', 'Kigna-Ourya', 'Seydia I', 'Seydia II',
        ]),
      ],
    },
    {
      nom: 'Dalaba', code: 'GN-MAM-DAL', chefLieu: 'Dalaba', lat: 10.69119, lng: -12.25162,
      communes: [
        {
          nom: 'Dalaba-Centre', code: 'GN-MAM-DAL-CU', type: 'urbaine', lat: 10.69119, lng: -12.25162,
          quartiers: [
            'Sily', 'Pellel-Yéro', 'Tangama', 'Diaguissa', 'Kollaguel', 'Dar-es-Salam', 'Dalaba-Missidé',
          ],
        },
        rurale('Bodié', 'GN-MAM-DAL-BOD', 11.02447, -12.05229, [
          'Bodié-Centre', 'Manta', 'M\'Bouro', 'Diabéré-Pilly', 'Bourouwal-Diawbhé', 'Maranda',
        ]),
        rurale('Ditinn', 'GN-MAM-DAL-DIT', 10.8825, -12.1768, [
          'Ditinn-Centre', 'Botobofel', 'Fougoumba', 'Diambrouya',
        ]),
        rurale('Kaala', 'GN-MAM-DAL-KAA', 10.80155, -12.20605, [
          'Kaala-Centre', 'Hérico', 'N\'Dantary', 'Pellal', 'Koïn-Hénéré', 'Kollakoye',
        ]),
        rurale('Kankalabé', 'GN-MAM-DAL-KAN', 11.14787, -12.00038, [
          'Kankalabé-Centre', 'Koufa', 'Thioro', 'N\'Dantaba', 'Gobiré', 'Séfouré', 'Doghol',
        ]),
        rurale('Kébali', 'GN-MAM-DAL-KEB', 10.95706, -12.19575, [
          'Kébaly-Centre', 'Hérico', 'Banga', 'Diouriya', 'Kahel', 'Kondisso', 'Boussoura', 'Miriré',
        ]),
        rurale('Koba', 'GN-MAM-DAL-KOB', 10.62917, -12.32162, [
          'Koba-Centre', 'Fello-Malanga', 'Hafia', 'Hafia-Kokou', 'Holladé', 'Horé-Djoli', 'Kakory', 'Lélé',
          'Loopé', 'Thiewgol',
        ]),
        rurale('Mafara', 'GN-MAM-DAL-MAF', 10.90319, -11.97963, [
          'Mafara-Centre', 'Tamikouré', 'Kétiguia', 'Kourou-Sériabhé', 'Dondé', 'Pennoun',
        ]),
        rurale('Mitty', 'GN-MAM-DAL-MIT', 10.83216, -12.31933, [
          'Mitty-Centre', 'Béréko', 'Fonfoya', 'Djiguiwel', 'Sébhory', 'Bindy', 'Parawi', 'Petty', 'Lélato',
          'Yalagué', 'Djangolo',
        ]),
        rurale('Mombéyah', 'GN-MAM-DAL-MOM', 11.21364, -12.06908, [
          'Mombéya-Centre', 'Galy', 'Hafia', 'Dounki', 'Nyékéma', 'Dougaya', 'Kénéné', 'Fogo',
        ]),
      ],
    },
    {
      nom: 'Pita', code: 'GN-MAM-PIT', chefLieu: 'Pita', lat: 11.05646, lng: -12.39505,
      communes: [
        {
          nom: 'Pita-Centre', code: 'GN-MAM-PIT-CU', type: 'urbaine', lat: 11.05646, lng: -12.39505,
          quartiers: [
            'Bendougou', 'Dow-Sarè', 'Gadha-Koubi', 'Guémé I', 'Guémé II', 'Hafia', 'Ley-Sarè', 'Marché I',
            'Marché II', 'Missira', 'N\'Douyebhe-Sally', 'Salloubhè', 'Sewa',
          ],
        },
        rurale('Bantignel', 'GN-MAM-PIT-BAN', 11.10971, -12.29958, [
          'Bantignel-Maoudé', 'Bantignel-Tokoséré', 'Billé', 'Bourouwal-Holladé', 'Bourouwal-Lahedji',
          'Dar-Es-Salam', 'Donghel', 'Mélikansa', 'Missidé-Hamdallaye', 'Missidé-Hindé', 'Sallia-École',
        ]),
        rurale('Bourouwal-Tappé', 'GN-MAM-PIT-BOU', 10.98977, -12.38621, [
          'Bourouwal-Tappé-Centre', 'Hooré-Gnèlè', 'Ley-Gnèlè', 'Bomboli', 'Hakkundè-Mity',
          'Gadha-Bhoundouwol',
        ]),
        rurale('Dongol-Touma', 'GN-MAM-PIT-DON', undefined, undefined, [
          'Donghol-Centre', 'Bambaya', 'Boulléré', 'Douky', 'Doukoukou', 'Guèmè', 'Taïré', 'Kadiel',
          'Kalilamban', 'N\'Dalao', 'Pellal',
        ]),
        rurale('Gongore', 'GN-MAM-PIT-GON', 10.82777, -12.40373, [
          'Gongorè-Centre', 'Hamdallaye', 'Bambéto', 'Djindji', 'Aiguel', 'Deben', 'Madina-Legue',
          'Koura-Woure', 'Thiehel',
        ]),
        rurale('Ley-Miro', 'GN-MAM-PIT-LEY', undefined, undefined, [
          'Ley-Miro-Centre', 'Ley-Diohé', 'Waréyah', 'Diounkoun', 'Faro', 'Kouyé', 'Fétowol',
        ]),
        rurale('Maci', 'GN-MAM-PIT-MAC', 10.90276, -12.43189, [
          'Maci I', 'Maci II', 'Bhoully', 'Kambaco', 'Palaga', 'N\'Dantary', 'Donghol', 'Litty',
          'Ley-Tangan', 'N\'Diré', 'Madina-Lebérè', 'Tangan', 'Thiewére', 'Djerenna',
        ]),
        rurale('Ninguélandé', 'GN-MAM-PIT-NIN', 11.18533, -12.66007, [
          'Ninguélandé-Centre', 'Debeya', 'Yorgo-Pellel', 'Loukouta', 'Gninkan', 'Hamdallaye-Bourouré',
          'Foyé-Brouwal', 'Safa', 'Pellal', 'Wendou', 'Ley-Fita',
        ]),
        rurale('Sangaréah', 'GN-MAM-PIT-SAN', undefined, undefined, [
          'Sangaréah-Centre', 'Dianyah', 'Yéréyah', 'Gnanso', 'Démoukoulima', 'Saari', 'Ninguétèrè',
          'Allèrè-Centre', 'Sanka', 'Kougouroutou', 'Fonfo', 'Soïleinta', 'Ganimbaya',
        ]),
        rurale('Sintali', 'GN-MAM-PIT-SIN', 11.0907, -12.42528, [
          'Sintaly-Centre', 'Bourkadje', 'Lalia-Maoudé', 'Kokoulo', 'Saraya',
        ]),
        rurale('Timbi-Madina', 'GN-MAM-PIT-TMA', 11.20206, -12.54285, [
          'Madina-Centre', 'Djoundol', 'Labha', 'Séré-Bouré', 'Doumba', 'Bamikouré', 'Sonké', 'Thapata',
          'Tokossèrè', 'Kourou-Mangui', 'Kourou-Rédou-Céré', 'Boummalol', 'Dampo', 'Aïndé',
        ]),
        rurale('Timbi-Touni', 'GN-MAM-PIT-TTO', 11.12021, -12.50404, [
          'Timbi-Tounni-Centre', 'Thioukou', 'Bendékouré', 'Diaga', 'Horé-Oury', 'Mangol', 'Aïdé-Boussoura',
          'Diabereyarè', 'Diougassi', 'Wanssan', 'Pellel-Bantan', 'Pellel-Modyabé',
        ]),
      ],
    },
  ],
};

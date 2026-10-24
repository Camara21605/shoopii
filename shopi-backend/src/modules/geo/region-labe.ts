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
 *   · districts des 49 communes rurales et quartiers de Koubia, Lélouma, Mali et
 *     Tougué-Centre : liste par sous-préfecture de ecolesenguinee.com (carte
 *     scolaire) — à vérifier auprès des mairies.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

/** Commune rurale (= sous-préfecture), avec ses districts quand on les connaît. */
const rurale = (nom: string, code: string, lat?: number, lng?: number, quartiers?: string[]): SeedCommune =>
  ({ nom, code, type: 'rurale', lat, lng, ...(quartiers ? { quartiers } : {}) });

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
        rurale('Dalein', 'GN-LAB-LAB-DAL', 11.51632, -12.3078, [
          'Dalein-Centre', 'Doghi', 'Kansakouma', 'Koundou-Daghi', 'N\'Dantawi-Mari', 'Saré-Kaly', 'Bambé',
          'Dalein-Hindé', 'Hooré-Wouloum', 'Madina-Kansaghi',
        ]),
        rurale('Daralabé', 'GN-LAB-LAB-DAR', 11.22302, -12.31456, [
          'Dara-Centre', 'Kouraba', 'Gaya', 'Féllo-Bantan', 'Dara-Kéthioun', 'Madina-N\'Diré',
        ]),
        rurale('Diari', 'GN-LAB-LAB-DIA', 11.33444, -12.49659, [
          'Diari-Centre', 'Donta', 'Douka-N\'Hiougueyabhé', 'Koula-Mawndè', 'Koula-Tokoussèrè',
        ]),
        rurale('Dionfo', 'GN-LAB-LAB-DIO', 11.33642, -12.05591, [
          'Dionfo-Centre', 'Bourouboto', 'Besseya', 'Pouroya', 'Madina-Hafia', 'N\'Deylal', 'Sengouma',
        ]),
        rurale('Garambé', 'GN-LAB-LAB-GAR', 11.26448, -12.35566, [
          'Garambé-Centre', 'Seghin', 'Labé-Dheppéré',
        ]),
        rurale('Hafia', 'GN-LAB-LAB-HAF', 11.21817, -12.39269, [
          'Hafia-Centre', 'Bagnan', 'Dambata', 'Gonkou', 'Hansaghèrè', 'Hindè', 'Sempétein', 'Sofoya',
        ]),
        rurale('Kaalan', 'GN-LAB-LAB-KAA', 11.30765, -12.15393, [
          'Kaalan-Centre', 'Darou', 'Missidé-Tiga', 'Madina-Para',
        ]),
        rurale('Kouramangui', 'GN-LAB-LAB-KOU', 11.50998, -12.43783, [
          'Kouramangui', 'Bouroudji', 'Bowé-Bhoubha', 'Horè-Félo', 'Horè-Kassa', 'Ley-Thiandhi', 'Téguégnen',
        ]),
        rurale('Noussy', 'GN-LAB-LAB-NOU', 11.2696, -12.17269, [
          'Noussy-Centre', 'Diawoya', 'Kankadi', 'Kassagui', 'Koundjéa', 'Kourako', 'Kouré', 'Mobhi',
          'Moloko', 'N\'Dantawi', 'Tombon',
        ]),
        rurale('Popodara', 'GN-LAB-LAB-POP', 11.4013, -12.40484, [
          'Popodara I', 'Popodara II', 'Sérima', 'Satina', 'Sombily', 'Gardi', 'Douka', 'Sillorbhé',
          'Toulet', 'Kigna',
        ]),
        rurale('Sannoun', 'GN-LAB-LAB-SAN', 11.41347, -12.11243, [
          'Sannoun-Centre', 'Hamdallaye', 'Diogoma', 'Kondel', 'Diguilin',
        ]),
        rurale('Taranbaly', 'GN-LAB-LAB-TAR', undefined, undefined, [
          'Tarambaly', 'Konkoren', 'Madinatou-Salamy', 'Dar-Es-Salam',
        ]),
        rurale('Tountouroun', 'GN-LAB-LAB-TOU', undefined, undefined, [
          'Gambie', 'Lariah', 'Niaoro', 'Toolou', 'Balaya', 'Kambaya', 'Tounny',
        ]),
      ],
    },
    {
      nom: 'Koubia', code: 'GN-LAB-KOU', chefLieu: 'Koubia', lat: 11.58603, lng: -11.89433,
      communes: [
        {
          nom: 'Koubia-Centre', code: 'GN-LAB-KOU-CU', type: 'urbaine', lat: 11.58603, lng: -11.89433,
          quartiers: [
            'Bassarata', 'Gordio', 'Hérico', 'Kabéléya', 'Kiri', 'Koubia I', 'Koubia II', 'Madina-Korbè',
            'Madina-Kossi', 'Malanma', 'Missira Timbobhé', 'Moromi', 'Timba',
          ],
        },
        rurale('Fafaya', 'GN-LAB-KOU-FAF', 11.70867, -11.69591, [
          'Fafaya-Centre', 'Boussoura', 'Madina-Bambaya', 'Simili', 'Marwata', 'Bassara', 'Darou',
          'Souloundé', 'Dadhiyabhé', 'Palét',
        ]),
        rurale('Gadha-Woundou', 'GN-LAB-KOU-GAD', 11.82275, -11.56796, [
          'Ley-Fello', 'N\'Diré', 'Boriko', 'Dalaba', 'Fissaya', 'Niara', 'Timbéring',
        ]),
        rurale('Matakaou', 'GN-LAB-KOU-MAT', 11.71958, -11.94837, [
          'Matakaou-Centre', 'Niannou-Missidé', 'Madina-Niannou', 'Soummah', 'Téliré', 'Kontoma',
          'Dara-Niannou', 'Bassara-Niannou',
        ]),
        rurale('Missira', 'GN-LAB-KOU-MIS', 11.44155, -11.97249, [
          'Missira-Centre', 'Bolé-N\'Dantaba', 'Koundjéa', 'Nyla', 'Saré-Kindia', 'Tountéba',
        ]),
        rurale('Pilimini', 'GN-LAB-KOU-PIL', 11.55257, -12.15163, [
          'Pilimini-Centre', 'Bagata', 'Bamba', 'Bansouma', 'Dara-Pelli', 'Koundou-Tyankoye', 'Ley-Sougué',
          'Madina-Beely', 'Madina-Dondé', 'Madina-Sougué', 'M\'Boudaré', 'Niakaya', 'Silamakaya',
          'Saré-Lengué', 'Thiéwiré', 'Tolin',
        ]),
      ],
    },
    {
      nom: 'Lélouma', code: 'GN-LAB-LEL', chefLieu: 'Lélouma', lat: 11.42572, lng: -12.68285,
      communes: [
        {
          nom: 'Lélouma-Centre', code: 'GN-LAB-LEL-CU', type: 'urbaine', lat: 11.42572, lng: -12.68285,
          quartiers: [
            'Diala I', 'Diala II', 'Djinkan', 'Kénéry', 'Pétel', 'Poyé', 'Sanama',
          ],
        },
        rurale('Balaya', 'GN-LAB-LEL-BAL', 11.4256, -12.73238, [
          'Balaya-Centre', 'Djidala', 'Dar-Es-Salam', 'Hooré-Djoli', 'Lambaghel', 'Madinadian',
          'Thiaghel-Diko',
        ]),
        rurale('Djountou', 'GN-LAB-LEL-DJO', 11.48997, -12.53919, [
          'Diountou-Centre', 'Nyagantou-Tinkin', 'Faréya', 'N\'Dantari-Thioboye', 'Koréghani', 'Labico',
          'Thiallou', 'Diountou-Pétoye',
        ]),
        rurale('Hérico', 'GN-LAB-LEL-HER', undefined, undefined, [
          'Hérico-Centre', 'Djiguè', 'Wédou-Koula', 'Hènèrè', 'Thiélirè', 'Towgo', 'Madina-Birouwal',
          'Wédou-Féto', 'Pounta-N\'Deylel',
        ]),
        rurale('Korbé', 'GN-LAB-LEL-KOR', 11.465, -12.62214, [
          'Korbè-Centre', 'Ley-Hoolo', 'N\'Gnéguéré', 'Kenté',
        ]),
        rurale('Lafou', 'GN-LAB-LEL-LAF', 11.5867, -12.46526, [
          'Lafou-Centre', 'Zawia', 'Bombiro-Bourou', 'Horé-Bombi', 'Donghol-Timbobhè', 'Towdé', 'Péguéty',
          'Laréwel',
        ]),
        rurale('Linsan-Saran', 'GN-LAB-LEL-LIN', 11.76773, -12.67553, [
          'Linsan I', 'Linsan II', 'Kokolou', 'Télibofi', 'Kolia', 'Kagné-Gamdé',
        ]),
        rurale('Manda', 'GN-LAB-LEL-MAN', undefined, undefined, [
          'Sérné', 'Maléya', 'Manda-Foulbhé', 'Bhoudhou-Barkè', 'Diafounou', 'Kamapinguè',
        ]),
        rurale('Parawol', 'GN-LAB-LEL-PAR', 11.35804, -12.63025, [
          'Parawol-Centre', 'Goundoupi', 'Dondé', 'Lonna', 'Bonkon', 'Sandaly', 'Thiaé-Tomasso',
        ]),
        rurale('Sagalé', 'GN-LAB-LEL-SAG', 11.30898, -12.83216, [
          'Sagalé-Centre', 'Téliwel', 'Bamikountou', 'Oury-Tounni', 'Thindoye', 'Thiéwé', 'Mouminia',
        ]),
        rurale('Tyanguel-Bori', 'GN-LAB-LEL-TYA', 11.63506, -12.53741, [
          'Tyanguel-Bori-Centre', 'Ley-Féllo', 'Hooré-Holladè', 'Bossé', 'Déna', 'N\'Dantari-Oury',
          'Kimbéli', 'Ley-Lagui', 'Séintou', 'Missira', 'N\'Dita',
        ]),
      ],
    },
    {
      nom: 'Mali', code: 'GN-LAB-MAL', chefLieu: 'Mali', lat: 12.07552, lng: -12.29569,
      communes: [
        {
          nom: 'Mali-Centre', code: 'GN-LAB-MAL-CU', type: 'urbaine', lat: 12.07552, lng: -12.29569,
          quartiers: [
            'Bamdouya', 'Bara', 'Bérébéré', 'Bogoma', 'Boundhou-Holladé', 'Donghol-Amoroyabhé',
            'Donghol-Kasso', 'Horè-Fèto-Yandy', 'Kortomèrè', 'Koumba', 'Ley-Thiéhel', 'Mali I', 'Mali II',
            'Mali III', 'Mali-Missidé', 'Mali-Mosquée', 'N\'Dantawi', 'Pakaya', 'Sopary', 'Tensira',
            'Wanwan',
          ],
        },
        rurale('Balaki', 'GN-LAB-MAL-BAL', 12.15129, -11.83181, [
          'Balaki-Centre', 'Bouria', 'Djoulabaya', 'Foulaya', 'Kounsi', 'Koppou', 'Madina-Founbhè', 'Niafou',
        ]),
        rurale('Donghol-Sigon', 'GN-LAB-MAL-DON', undefined, undefined, [
          'Donghol-Sigon-Centre', 'Dougaya', 'Hooré-Litty', 'Sériya', 'Bandéya', 'Mayadine', 'Yarikoly',
          'Fètorè', 'Sarahéry',
        ]),
        rurale('Dougountouny', 'GN-LAB-MAL-DOU', 11.85571, -12.61676, [
          'Dougountouny-Centre', 'Bamba-Saabèrè', 'Boulérè', 'Dara', 'Djeindjein', 'Kokouma', 'Wansan',
        ]),
        rurale('Fougou', 'GN-LAB-MAL-FOU', 11.90601, -12.29847, [
          'Fougou-Centre', 'Kansaghel', 'Samantan', 'Bamba', 'Kobé-Yéléta', 'Kilan', 'Doullaya',
        ]),
        rurale('Gayah', 'GN-LAB-MAL-GAY', 12.01281, -12.42674, [
          'Gayah-Centre', 'Hoolo', 'Séou', 'Darabély', 'Démougayah',
        ]),
        rurale('Hidayatou', 'GN-LAB-MAL-HID', 11.91079, -12.23593, [
          'Hidayatou I', 'Hidayatou II', 'Missira-Dalama', 'Fériféto', 'Kambara', 'N\'Guérouwel', 'Kounda',
          'Kenséya', 'Téimbou',
        ]),
        rurale('Lébékéré', 'GN-LAB-MAL-LEB', undefined, undefined, [
          'Lébékéré-Centre', 'Fina', 'Sinthiou-Yandy', 'Kanta-Thioudy', 'Sabé', 'Kérouané', 'Korihoye',
          'Belessé',
        ]),
        rurale('Madina-Wora', 'GN-LAB-MAL-MAD', 12.02873, -12.49815, [
          'Madina-Wora-Centre', 'Bakony', 'Cécé', 'Daly', 'Hafia-Kaédjora', 'Hamdallaye', 'Pélli-Saarè',
          'Sougué', 'Wora-Missidé',
        ]),
        rurale('Salambandé', 'GN-LAB-MAL-SAL', 11.83043, -11.8855, [
          'Madina-Centre', 'Hooré-Fèllo', 'Ghahira', 'Denghen', 'Koya', 'Dioudiou',
        ]),
        rurale('Téliré', 'GN-LAB-MAL-TEL', 11.8463, -12.0965, [
          'Téliré-Centre', 'Singuély', 'Daramèrè', 'Dar-Es-Salam', 'Kambaya', 'Madina-Digannadji', 'Méliya',
          'Missira-Hamdallaye',
        ]),
        rurale('Touba', 'GN-LAB-MAL-TOU', 12.18666, -12.66174, [
          'Touba-Centre', 'Koya', 'Fanga', 'Nagoye', 'Bandani', 'Sangui',
        ]),
        rurale('Yembéreng', 'GN-LAB-MAL-YEM', 11.8162, -12.34912, [
          'Yembéreng-Centre', 'Donghol', 'Goumba', 'Hooré-N\'Dala', 'Hooré-Sarè', 'Ténkéta', 'Kèlin',
          'M\'Bara', 'Pellal', 'Sinthiourou',
        ]),
      ],
    },
    {
      nom: 'Tougué', code: 'GN-LAB-TOU', chefLieu: 'Tougué', lat: 11.43946, lng: -11.66295,
      communes: [
        {
          nom: 'Tougué-Centre', code: 'GN-LAB-TOU-CU', type: 'urbaine', lat: 11.43946, lng: -11.66295,
          quartiers: [
            'Ballama', 'Bolet', 'Ganfata', 'Kalanka', 'Kambaya', 'Kégna', 'Kéléla', 'Pandjé-Fello',
            'Sandaké', 'Souméta', 'Soumpoura', 'Tougué I', 'Tougué II', 'Woulinko', 'Wourétimbé',
          ],
        },
        rurale('Fatako', 'GN-LAB-TOU-FAT', 11.21388, -11.88853, [
          'Fatako-Centre', 'Fogo', 'Wédou', 'Korbonya', 'Bouméko',
        ]),
        rurale('Fello-Koundoua', 'GN-LAB-TOU-FEL', 11.82509, -11.32591, [
          'Fello-Koundoua', 'Takabara', 'Balagan', 'N\'Géssa-Woula', 'N\'Diré-Yanguéya',
        ]),
        rurale('Kansangui', 'GN-LAB-TOU-KAN', 11.18724, -11.65202, [
          'Kansangui-Centre', 'Kémaya', 'Laréko', 'Soulé', 'Sangouya', 'Kondjéya',
        ]),
        rurale('Kolangui', 'GN-LAB-TOU-KOL', undefined, undefined, [
          'Kolangui-Centre', 'Labha', 'Nhannharan', 'Fello-Diafounabhé', 'Afia',
        ]),
        rurale('Kollet', 'GN-LAB-TOU-KET', 11.48786, -11.54781, [
          'Kollet-Centre', 'Belakouré', 'Dabalaya', 'Darah', 'Démouko', 'Diawléko', 'Douroun', 'Faghan',
          'Fello-Kollet', 'Kabary', 'Kégnéwoula', 'Kirfi', 'Lagui', 'Mosquée', 'Niéniéméré',
        ]),
        rurale('Konah', 'GN-LAB-TOU-KON', 11.44855, -11.84446, [
          'Konah I', 'Konah II', 'Tounkourouma', 'Hamdallaye', 'Parawol', 'Férégandé', 'Bourouwal', 'Parawi',
        ]),
        rurale('Kouratongo', 'GN-LAB-TOU-KOU', 11.63227, -11.48453, [
          'Kouratongo', 'Darou', 'Fello-Madina', 'Horé-Kollet', 'Kollet-Missidé', 'Koumbama', 'Kounet',
          'Laafa-Boubé', 'Lallabara',
        ]),
        rurale('Koyin', 'GN-LAB-TOU-KOY', 11.22097, -11.80967, [
          'Koïn I', 'Koïn II', 'Solokouré', 'Malipan', 'Siguira', 'Kaffa', 'Thiaghel', 'Wédou-Malanga',
        ]),
        rurale('Tangaly', 'GN-LAB-TOU-TAN', undefined, undefined, [
          'Tangaly', 'Bâdy', 'Barita', 'Korfo',
        ]),
      ],
    },
  ],
};

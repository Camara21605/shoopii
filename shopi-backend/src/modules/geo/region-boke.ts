/* ============================================================
 * FICHIER : src/modules/geo/region-boke.ts
 *
 * Région de Boké (Basse-Guinée) : 6 préfectures — Boké, Kamsar, Boffa, Fria,
 * Gaoual, Koundara. Kamsar, ancienne sous-préfecture de Boké, est préfecture
 * depuis le décret du 20 août 2026 ; l'arrêté qui doit fixer sa composition
 * n'étant pas publié, elle contient pour l'instant la seule commune de Kamsar,
 * et les autres sous-préfectures restent dans Boké.
 *
 * Même organisation que region-mamou.ts : chaque sous-préfecture est sa commune
 * rurale (avec ses districts), le chef-lieu de préfecture est une commune
 * urbaine (« X-Centre », avec ses quartiers).
 *
 * Sources :
 *   · 32 sous-préfectures : INS, « Liste des sous-préfectures » et annuaire
 *     statistique de la région de Boké ; décret du 20 août 2026 (guineenews) ;
 *   · quartiers et districts : liste par sous-préfecture de ecolesenguinee.com
 *     (carte scolaire) — à vérifier auprès des mairies.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives ; les
 * lieux absents ou ambigus restent sans coordonnées.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

/** Commune rurale (= sous-préfecture), avec ses districts quand on les connaît. */
const rurale = (nom: string, code: string, lat?: number, lng?: number, quartiers?: string[]): SeedCommune =>
  ({ nom, code, type: 'rurale', lat, lng, ...(quartiers ? { quartiers } : {}) });

export const REGION_BOKE: SeedRegion = {
  nom: 'Boké', code: 'GN-BOK', chefLieu: 'Boké', lat: 10.95224, lng: -14.27606,
  prefectures: [
    {
      nom: 'Boké', code: 'GN-BOK-BOK', chefLieu: 'Boké', lat: 10.95224, lng: -14.27606,
      communes: [
        {
          nom: 'Boké-Centre', code: 'GN-BOK-BOK-CU', type: 'urbaine', lat: 10.95224, lng: -14.27606,
          quartiers: [
            'Baralandé', 'Corréra', 'Dibia', 'Dioumaya', 'Goreye', 'Guilléré', 'Kadiguira', 'Kougnéwadé I',
            'Kougnéwadé II', 'Koulifanya', 'Lambanyi', 'Madina Kébéya', 'Tomboya', 'Wakrya', 'Yomboya',
          ],
        },
        rurale('Bintimodiya', 'GN-BOK-BOK-BIN', 10.65204, -14.44887, [
          'Bintimodia-Centre', 'Koftonden', 'Lintang', 'Maré', 'Kankako', 'Garama', 'Kataco',
          'Koliah Sanamato',
        ]),
        rurale('Dabiss', 'GN-BOK-BOK-DAB', 11.19365, -14.54063, [
          'Dabiss-Centre', 'Kouda', 'Silikonko', 'Bhoundoulengué', 'Parabole', 'N\'Yamara', 'Hamidallaye',
          'Tomboya',
        ]),
        rurale('Kanfarandé', 'GN-BOK-BOK-KAN', 10.83588, -14.54137, [
          'Kanfarandé-Centre', 'Kapsine', 'Dabribon', 'Kasmack', 'Katfoura', 'Kambilam', 'Kadignet',
          'Kibanco', 'Tarikhouré', 'Dobaly', 'Lansanaya', 'Kapkin', 'Boffa-Dar', 'Koukouba', 'Kalagba',
        ]),
        rurale('Kolaboui', 'GN-BOK-BOK-KOL', 10.79578, -14.39944, [
          'Kolaboui-Centre', 'Bokaréa', 'Dabankou', 'Dakonta', 'Diakhabiya', 'Diassia', 'Fodekonteya',
          'Kamikolo', 'Lefoureboui', 'Sarabaya', 'Satènènya', 'Sogoboli', 'Songolon', 'Tabondeya', 'Tassara',
          'Tassibon',
        ]),
        rurale('Malapouyah', 'GN-BOK-BOK-MAL', undefined, undefined, [
          'Malapouya-Centre', 'Balla', 'Kounsikansi', 'Hafia', 'Djolol',
        ]),
        rurale('Sangarédi', 'GN-BOK-BOK-SAN', 11.104, -13.8106, [
          'Aye-Koye', 'Balandougou', 'Bappa Sergent', 'Boullèrè', 'Guildé', 'Kourawel', 'Lavage', 'Silidara',
          'Souka', 'Thiankounnaye', 'Wossou',
        ]),
        rurale('Sansalé', 'GN-BOK-BOK-SSL', 11.11575, -14.84609, [
          'Sansalé-Centre', 'Fiff', 'Gallé-Tchola', 'Tanènè Kandiafara', 'Yarga',
        ]),
        rurale('Tanènè', 'GN-BOK-BOK-TAN', undefined, undefined, [
          'Tanènè-Centre', 'Boussoura', 'Dambantchan', 'Djiguity', 'N\'Dangara', 'Kaboyé', 'Katougouma',
          'Kimiya', 'Kintao-Daconta',
        ]),
      ],
    },
    {
      nom: 'Kamsar', code: 'GN-BOK-KAM', chefLieu: 'Kamsar', lat: 10.66439, lng: -14.58333, anciennement: 'Boké',
      communes: [
        rurale('Kamsar', 'GN-BOK-KAM-KAM', 10.66439, -14.58333, [
          'Kamsar-Centre', 'Kamsar Cité', 'Binari', 'Filima', 'Kamakouloun', 'Kassongony', 'Kawass',
          'M\'Botiny', 'Madina Borboff', 'Taigbé', 'Kouffin', 'Missira', 'Katongoro', 'Kakilensi',
        ]),
      ],
    },
    {
      nom: 'Boffa', code: 'GN-BOK-BOF', chefLieu: 'Boffa', lat: 10.18123, lng: -14.0377,
      communes: [
        {
          nom: 'Boffa-Centre', code: 'GN-BOK-BOF-CU', type: 'urbaine', lat: 10.18123, lng: -14.0377,
          quartiers: [
            'Almamiya I', 'Almamiya II', 'Balandougou', 'Bolondé I', 'Bolondé II', 'Dar-Es-Salam', 'Dobiret',
            'Domighia', 'Farenya', 'Khatia', 'Kossinsing', 'Lakhata', 'Lonking', 'Marara', 'Sakama',
            'Sekhebadé', 'Thia', 'Torodoyah', 'Walia', 'Wèrèyah', 'Yimaya',
          ],
        },
        rurale('Colia', 'GN-BOK-BOF-COL', 10.41191, -14.04707, [
          'Colia-Centre', 'Colia Tafory', 'Gobidje', 'Khalo', 'Korera', 'Kounfa', 'Lalafanyé', 'Longo',
          'Madina Houbbou', 'Mellekhouré', 'Tagbé', 'Yoya',
        ]),
        rurale('Douprou', 'GN-BOK-BOF-DOU', undefined, undefined, [
          'Douprou-Centre', 'Bourèkhèbadé', 'Bandé-Gnindé', 'Koukoudé', 'Koumbaya', 'Koundindé', 'Poukoun',
          'Siranka', 'Sobanet',
        ]),
        rurale('Koba-Tatema', 'GN-BOK-BOF-KOB', undefined, undefined, [
          'Bangouya', 'Bassengué', 'Booro-Kito', 'Dixinn I', 'Dixinn II', 'Donyah', 'Karamokoyah',
          'Kobararé', 'Konibale', 'Kotteya-Kito', 'M\'Bendia', 'Makinsy', 'Sayonya', 'Souguébonyi',
          'Taboriah I', 'Taboriah II', 'Tanènè', 'Tatema', 'Tintima', 'Yangoya Kito', 'Yaraya',
        ]),
        rurale('Lisso', 'GN-BOK-BOF-LIS', 10.22315, -13.89709, [
          'Lisso-Centre', 'Wondetty', 'Bondy', 'Tamalan', 'Missira Moria', 'N\'Dantari', 'Touba', 'Gobidjé',
          'Sénguélenkhouré', 'Dètè Khoundoukhoun',
        ]),
        rurale('Mankountan', 'GN-BOK-BOF-MAN', 10.53765, -14.44304, [
          'Mankountan-Centre', 'Bigori', 'Bongolon', 'Dansy', 'Kalèxè', 'Kolon', 'Katongoron', 'Kakala',
          'Madia', 'Sibaly', 'Toumbéta', 'Yampony',
        ]),
        rurale('Tamita', 'GN-BOK-BOF-TAM', 10.14785, -13.93256, [
          'Tamita-Centre', 'Donya', 'Dotoret', 'Foutoubounyi', 'Ganganta', 'Gbassaya', 'Kèlèya', 'Khambaya',
          'Khorira', 'Missira', 'Mouraya', 'Soumbouyadi', 'Yembereng', 'Yenguissa', 'Boota', 'Farema',
          'Fatagbolo',
        ]),
        rurale('Tougnifily', 'GN-BOK-BOF-TOU', 10.39619, -14.42394, [
          'Tougnifily-Centre', 'Brika', 'Diogoya', 'Fonfo', 'Foulaya', 'Kalékalé', 'Kantely', 'Khantata',
          'Khissiling', 'Kifinda', 'Kinyaya', 'Mamiya', 'Mintany', 'Monchon', 'Nalokhouré', 'Tambaya',
          'Tanènè', 'Tomata',
        ]),
      ],
    },
    {
      nom: 'Fria', code: 'GN-BOK-FRI', chefLieu: 'Fria', lat: 10.36304, lng: -13.58118,
      communes: [
        {
          nom: 'Fria-Centre', code: 'GN-BOK-FRI-CU', type: 'urbaine', lat: 10.36304, lng: -13.58118,
          quartiers: [
            'Alpha Yaya', 'Aviation I', 'Aviation II', 'Fatala', 'Katourou I École', 'Katourou I Mosquée',
            'Katourou II', 'Katourou III', 'Kolonfikhè', 'Kondekhouré', 'Kounsikhimbely', 'Sabendè I',
            'Sabendè II', 'Tabossy I', 'Tabossy II', 'Tigué I Mosquée', 'Tigué Lako',
          ],
        },
        rurale('Baguinet', 'GN-BOK-FRI-BAG', 10.49986, -13.52101, [
          'Baguinet-Centre', 'Baguinet Kiratagui', 'Madina-Sinthiourou', 'Simbakhouloun', 'Fria Village',
          'Fadjeta', 'Dorondji', 'Gnankakhouré',
        ]),
        rurale('Banguigny', 'GN-BOK-FRI-BAN', 10.67491, -13.60065, [
          'Banguigny-Centre', 'Missira', 'Madina Tossokèrè', 'Hoorè Para', 'Koola', 'Toulel',
        ]),
        rurale('Tormelin', 'GN-BOK-FRI-TOR', 10.29502, -13.71903, [
          'Tormelin-Centre', 'Tanènè', 'Mambori Konkobaya', 'Doumboukounsi', 'Mambori Foreya', 'Woulounkobi',
        ]),
      ],
    },
    {
      nom: 'Gaoual', code: 'GN-BOK-GAO', chefLieu: 'Gaoual', lat: 11.7541, lng: -13.20033,
      communes: [
        {
          nom: 'Gaoual-Centre', code: 'GN-BOK-GAO-CU', type: 'urbaine', lat: 11.7541, lng: -13.20033,
          quartiers: [
            'Barkèrè', 'Bassanto', 'Dandou', 'Hafia', 'Houmbaya', 'Kayan', 'Madina Kembera', 'Sinthiourou',
            'Toulon',
          ],
        },
        rurale('Foulamory', 'GN-BOK-GAO-FOU', 12.15996, -13.83952, [
          'Foulamory', 'Foulamory-Centre', 'Kithiar', 'Kankody', 'Kambambolou', 'Tabadjan',
        ]),
        rurale('Kakony', 'GN-BOK-GAO-KAK', 11.31163, -13.17399, [
          'Kakony-Centre', 'Gallé Dara', 'Saré-Ousmane', 'Sinthiou-Wara', 'Kassay-Bamba', 'Boulleré',
          'Madina', 'Téliré', 'Kabobo', 'Daroun', 'Sombili', 'N\'Dantari',
        ]),
        rurale('Koumbia', 'GN-BOK-GAO-KOU', 11.775, -13.49471, [
          'Koumbia', 'Darabowé', 'Woupirdé', 'Hakouné Thiandhi', 'Pety', 'Goundoupi',
          'Dar-Es-Salam-Sinthiou', 'Kamèlé', 'Nétéré', 'Bhouly', 'Kembéra', 'Dombiadji', 'Madina-Bowé',
          'Hounsiré', 'Taguira', 'Bessilé', 'Saré-Tara', 'Guidaly', 'Madina-Guilédji', 'Diouria',
          'Madina Diaka', 'Haccounde-Thandal',
        ]),
        rurale('Kounsitel', 'GN-BOK-GAO-KNS', 11.80393, -13.0744, [
          'Kounsitel-Centre', 'Kénéri', 'Boukouna', 'Himaya', 'Dengueteri',
        ]),
        rurale('Malanta', 'GN-BOK-GAO-MAL', 11.48504, -12.82542, [
          'Malanta-Centre', 'Goungouroun', 'Doghi-Dabhi', 'Dantaba', 'Yilimé', 'Kounsi',
        ]),
        rurale('Touba', 'GN-BOK-GAO-TOU', undefined, undefined, [
          'Touba-Centre', 'Bitting', 'Saali', 'Soolou', 'Fanga', 'Kolossa', 'Kalya', 'Tamby', 'Naata',
        ]),
        rurale('Wendou M\'Bour', 'GN-BOK-GAO-WEN', 11.43351, -13.87522, [
          'Wendou M\'Bour-Centre', 'Walingui', 'Dalao', 'Maouba', 'Sinthiourou Toumbé', 'Tenkéta', 'Barkèrè',
          'Parawali',
        ]),
      ],
    },
    {
      nom: 'Koundara', code: 'GN-BOK-KOU', chefLieu: 'Koundara', lat: 12.48515, lng: -13.29851,
      communes: [
        {
          nom: 'Koundara-Centre', code: 'GN-BOK-KOU-CU', type: 'urbaine', lat: 12.48515, lng: -13.29851,
          quartiers: [
            'Athiabaly', 'Boussoura', 'Dar-Es-Salam', 'École', 'Hafia', 'Hamdallaye', 'Kandiada', 'Mosquée',
          ],
        },
        rurale('Guingan', 'GN-BOK-KOU-GUI', 12.38784, -12.96374, [
          'Guingan-Centre', 'Doïdoï', 'Thiaguisse', 'Koudian', 'Londal', 'Poughar', 'Benssane', 'Kifaya',
          'Hallire', 'Weliya', 'Akoul',
        ]),
        rurale('Kamaby', 'GN-BOK-KOU-KAM', 12.39806, -13.40782, [
          'Kamaby I', 'Kamaby II', 'Sinthian Bory', 'Doukourella', 'Sinthian Pathé', 'Akadasso', 'Tabadel',
        ]),
        rurale('Sambaïlo', 'GN-BOK-KOU-SAM', 12.58241, -13.37191, [
          'Sambaïlo-Centre', 'Sambaldé Kapparabina', 'Salemata', 'Missira',
        ]),
        rurale('Saréboïdo', 'GN-BOK-KOU-SAR', 12.40438, -13.52897, [
          'Saréboïdo I', 'Saréboïdo II', 'Sanka', 'Kouttan', 'Sinthian Sékou', 'Kathiaourou', 'Béssé-Ouro',
          'Sarékaly', 'Paounka', 'Marou', 'Madina-Badiar', 'Sounkoutou', 'Barkérè', 'Altou',
        ]),
        rurale('Termessé', 'GN-BOK-KOU-TER', 12.31763, -12.78826, [
          'Termessé-Centre', 'Botomely', 'Hamdallaye', 'Idhar', 'Kossi', 'Koubia', 'Lambagole', 'Ley Kone',
          'Nandouba',
        ]),
        rurale('Youkounkoun', 'GN-BOK-KOU-YOU', 12.53483, -13.12129, [
          'Youkounkoun-Centre', 'Ourack', 'Ouyane', 'Ithiou', 'Kidack',
        ]),
      ],
    },
  ],
};

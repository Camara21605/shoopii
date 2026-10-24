/* ============================================================
 * FICHIER : src/modules/geo/region-siguiri.ts
 *
 * Région de Siguiri (Haute-Guinée) — créée par le décret présidentiel du
 * 20 août 2026 (Beyla et Siguiri érigées en régions administratives). Elle
 * compte la préfecture de Siguiri et les nouvelles préfectures de Doko,
 * Siguirini et Kintinian (anciennes sous-préfectures de Siguiri). En attendant
 * l'arrêté qui fixe leur composition, chacune contient la seule commune de son
 * chef-lieu, et les autres sous-préfectures restent dans Siguiri.
 *
 * Bases existantes : la préfecture de Siguiri déjà enregistrée dans la région
 * de Kankan est rattachée à la région de Siguiri (regionAnciennement), et les
 * communes Doko, Siguirini et Kintinian à leur nouvelle préfecture
 * (anciennement) — sans doublon, chaque déplacement journalisé.
 *
 * Sources :
 *   · décret du 20 août 2026 : guineenews, guinee7, reporterguinee ;
 *   · 20 sous-préfectures : INS (annuaire de la région de Kankan) et
 *     nominations des sous-préfets de juin 2026 (guineenews) ;
 *   · quartiers et districts de Siguiri-Centre : mairie de Siguiri + carte
 *     scolaire ; districts des communes rurales : liste par sous-préfecture de
 *     ecolesenguinee.com — à vérifier. Les villages passés aux nouvelles
 *     sous-préfectures (Mignada, Tomboni, Fidako, Koumandjambougou, Didi) ne
 *     sont pas répétés dans leur ancienne sous-préfecture.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

/** Commune rurale (= sous-préfecture), avec ses districts quand on les connaît. */
const rurale = (nom: string, code: string, lat?: number, lng?: number, quartiers?: string[]): SeedCommune =>
  ({ nom, code, type: 'rurale', lat, lng, ...(quartiers ? { quartiers } : {}) });

export const REGION_SIGUIRI: SeedRegion = {
  nom: 'Siguiri', code: 'GN-SIG', chefLieu: 'Siguiri', lat: 11.41953, lng: -9.17515,
  prefectures: [
    {
      nom: 'Siguiri', code: 'GN-SIG-SIG', chefLieu: 'Siguiri', lat: 11.41953, lng: -9.17515, regionAnciennement: 'Kankan',
      communes: [
        {
          nom: 'Siguiri-Centre', code: 'GN-SIG-SIG-CU', type: 'urbaine', lat: 11.41953, lng: -9.17515,
          quartiers: [
            'Siguiri Koro I', 'Siguiri Koro II', 'Siguiri Koura I', 'Siguiri Koura II', 'Bolibana I',
            'Bolibana II', 'Kouroudakoro I', 'Kouroudakoro II', 'Bananinkoro', 'Saint-Alexis',
            'Fodéba Keïta', 'Téléladji', 'Kourouni', 'Énergie', 'ORS', 'Bambala', 'Dankakoro', 'Diatela',
            'Djilengbè', 'Fadjoukola', 'Falama', 'Fodéoulenbougou', 'Gbogoroma', 'Kiniébakoro', 'Kissakolen',
            'Kobada', 'Koda', 'Kofilani', 'Kolenda', 'Moya Fara I', 'Niandankoura', 'Saourou', 'Sèbèkoro',
            'Somonobougou-Niger', 'Sougoula', 'Tabako', 'Tambabougou', 'Tiguibiry', 'Yorola',
          ],
        },
        rurale('Bankon', 'GN-SIG-SIG-BAN', 11.55821, -8.80064, [
          'Bankon', 'Dala', 'Dalagbèda', 'Kignèbalen', 'Kodjou', 'Komakolenda', 'Massaréna', 'Nafadji',
          'Somonobougou',
        ]),
        rurale('Franwalia', 'GN-SIG-SIG-FRA', 11.70048, -9.38215, [
          'Franwalia', 'Franwalia-Centre II', 'Mamoudoula', 'Bougouroun', 'Bougouroun-Centre II',
          'Bouramaya', 'Faraban', 'Fèfè', 'Kossongna', 'Bendougou', 'Djambaya', 'Koudédi', 'Komah', 'Kamaya',
          'Sobata', 'Sambaya', 'Kofilani', 'Kotoma', 'Djintamba', 'Woroya', 'Sackola', 'Hérémakono',
        ]),
        rurale('Kiniébakoura', 'GN-SIG-SIG-KIN', undefined, undefined, [
          'Kiniébakoura I', 'Kiniébakoura II', 'Baffinda',
        ]),
        rurale('Maléah', 'GN-SIG-SIG-MAL', 11.80042, -9.71018, [
          'Maléah', 'Bandjougoula', 'Samendé', 'Noumandjana', 'Soumbakouloun', 'Diateya', 'Gouffoudé',
          'Hafia', 'Hamdallaye-Kouroukan', 'Hamdallaye-Centre', 'Santiguiya', 'Mègnè-Koma', 'Maléah-Konomè',
          'Dianka', 'Kaana', 'Kignèba', 'Leybaya', 'Danaya', 'Amina-Djalonka', 'Sinimbaya', 'Kobedara',
          'Kobedara-Koko', 'Saraya',
        ]),
        rurale('Naboun', 'GN-SIG-SIG-NAB', 11.98031, -9.51385, [
          'Naboun-Centre', 'Naboun-Koura', 'Naboukoro', 'Soumbaraya', 'Soumbaraya I', 'Soumbaraya II',
          'Soumbaraya III', 'Boukaria', 'Boukaria I', 'Boukaria II', 'Dibiya', 'Dibiya I', 'Dibiya II',
          'Hérémakono', 'Kignèdi', 'Djinko', 'Kignero', 'Balenda', 'Gnèrè', 'Komourounifè',
        ]),
        rurale('Niagassola', 'GN-SIG-SIG-NIA', 12.31242, -9.1197, [
          'Niagassola', 'Banladougou', 'Bananikoro', 'Férèkou', 'Dialawassa I', 'Siniko', 'Tondo',
          'Tombalen', 'Kououbala', 'Kondoko', 'Kignebani', 'Kignénindo', 'Kaninko', 'Sanankoro',
          'Seouroukolambi', 'Faraboloni', 'Madina', 'Kanimba-Kalako', 'Makandjana', 'Djékikourou',
          'Sokoromansa', 'Balandougou', 'Balandougou-Centre',
        ]),
        rurale('Niandankoro', 'GN-SIG-SIG-NDK', 11.07616, -9.24966, [
          'Niandankoro I', 'Niandankoro II', 'Farada', 'Kada', 'Banfara', 'Damissakoro', 'Damissakoura',
          'Waran I', 'Waran II', 'Gbassany', 'Sokoro', 'Gbassamba', 'Farakoun',
        ]),
        rurale('Norassoba', 'GN-SIG-SIG-NOR', 10.92423, -9.48097, [
          'Drah', 'Kodjaranin', 'Gbedekoba', 'Fadou', 'Kossoko-Koungbè', 'Konkonon', 'Gnamatomba',
          'Hérémakonon', 'Faradjanin', 'Kossokoba', 'Siladalakolen', 'Fankatombon', 'Bankolenkro', 'Wèrèda',
          'Talininkro', 'Talibonin', 'Sebefaranin', 'Gbrébrékolen', 'Bendou', 'Todakoudounkan',
          'Tassiliman I', 'Tassiliman II', 'Signandala', 'Toudoukounaba', 'Wélé-Wéléya', 'Woussoukourou',
          'Diabotè-Sidy', 'Balanin', 'Kobala', 'Leleda', 'Frabgèba', 'Dalaninkan', 'Lemourou-Tombon',
          'Lemourou-Dalakan', 'Kolendou', 'Madina-Bereko', 'Fandja I', 'Fandja II', 'Norakoro I',
          'Norakoro II', 'Gbenkrokoro I', 'Gbenkrokoro II', 'Landy', 'Serekoronin', 'Djoma-Kouman',
          'Djoma-Djalla', 'Mankandjan', 'Nanen-Traoré',
        ]),
        rurale('Nounkounkan', 'GN-SIG-SIG-NOU', 10.96835, -9.38927, [
          'Nounkounkan I', 'Nounkounkan II', 'Nounkounkan III', 'Sokoura', 'Banfelekoro', 'Banfelekoro II',
          'Banfelekoura', 'Sounsounkoundou', 'Balandou', 'Makono', 'Tombomba', 'Siko', 'Faranindjan',
          'Balandougou II',
        ]),
        rurale('Didi', 'GN-SIG-SIG-DID', 11.54893, -9.60377, [
          'Didi I', 'Nafadji', 'Daaba', 'Mankity', 'Fifa', 'Korèkorè', 'Faraba', 'Alahine', 'Makonon',
        ]),
        rurale('Kourémalé', 'GN-SIG-SIG-KOU', 11.94842, -8.801, [
          'Kourémalé', 'Badamako', 'Konfra', 'Körè-Körè I', 'Körè-Körè II',
        ]),
        rurale('Tomba-Kansa', 'GN-SIG-SIG-TOM', 11.7257, -10.18658, [
          'Tomba-Kansa I', 'Tomba-Kansa II', 'Tomba-Kobila', 'Tombani', 'Bougoulan', 'Bérétéla',
        ]),
        rurale('Tomboni', 'GN-SIG-SIG-TBN', 11.80662, -9.20611, [
          'Tomboni', 'Sounounna-Oudaködö', 'Diabrèko', 'Kognanfra II', 'Fanka', 'Dalamban',
        ]),
        rurale('Fidako', 'GN-SIG-SIG-FID', 12.1055, -9.17278, [
          'Fidako', 'Farabalen', 'Seourou', 'Kignékourou', 'Kignélemba', 'Kédala', 'Konkoufara',
          'Kouyakouya', 'Dar-es-Salam', 'Dora', 'Magnaka', 'Kodjoukoulen',
        ]),
        rurale('Djomabana', 'GN-SIG-SIG-DJO', 11.26419, -9.13234, [
          'Djomabana I', 'Djomabana II', 'Toguioulen I', 'Toguioulen II', 'Frénkamaya', 'Djéya', 'Karakoro',
          'Konomakoura I', 'Konomakoura II', 'Baladougou', 'Toguifing', 'Bafinkoba', 'Faradjan',
        ]),
        rurale('Mignada', 'GN-SIG-SIG-MIG', 11.63871, -9.63352, [
          'Mignada', 'Bréko', 'Missira', 'Dantinia',
        ]),
        rurale('Koumandjambougou', 'GN-SIG-SIG-KMB', 11.44823, -8.97536, [
          'Koumandjambougou', 'Kokoum', 'Leyba', 'Mansala',
        ]),
      ],
    },
    {
      /* Préfecture depuis le décret du 20 août 2026 (ancienne sous-préfecture de Siguiri) : en attendant l'arrêté qui fixe sa
         composition, elle contient la seule commune de son chef-lieu. */
      nom: 'Doko', code: 'GN-SIG-DOK', chefLieu: 'Doko', lat: 11.78098, lng: -8.96251, anciennement: 'Siguiri',
      communes: [
        rurale('Doko', 'GN-SIG-DOK-DOK', 11.78098, -8.96251, [
          'Doko-Centre', 'Kolenda', 'Soumbarakolen', 'Sékélamansadji', 'Sidao', 'Tomboko', 'Tatakourou',
          'Bembeta', 'Souloukouni', 'Soumbarakoba', 'Bourénfè', 'Bida', 'Gbededa', 'Kounkoun', 'Tonso',
          'Gaarema', 'Oudala', 'Tomifra', 'Kolita', 'Toukono', 'Kourako', 'Kodjarani', 'Bokoko',
          'Sérédéndén', 'Fanafanko', 'Tondji II', 'Nafadji', 'Alahinè', 'Kignebakoro', 'Silabada', 'Makanko',
          'Seindougou',
        ]),
      ],
    },
    {
      /* Préfecture depuis le décret du 20 août 2026 (ancienne sous-préfecture de Siguiri) : en attendant l'arrêté qui fixe sa
         composition, elle contient la seule commune de son chef-lieu. */
      nom: 'Siguirini', code: 'GN-SIG-SGN', chefLieu: 'Siguirini', lat: 11.82392, lng: -10.0378, anciennement: 'Siguiri',
      communes: [
        rurale('Siguirini', 'GN-SIG-SGN-SGN', 11.82392, -10.0378, [
          'Siguirini', 'Amina', 'Gnémbou', 'Boubèrè', 'Bèrèla', 'Léro I', 'Léro II', 'Solabé', 'Bendougouni',
          'Mankadjan', 'Barkère', 'Nora', 'Diguibania', 'Kakama', 'Nimissatou', 'Balandougou', 'Nétémafara',
          'Kôtè', 'Moussala', 'Diguiling', 'Sokoro',
        ]),
      ],
    },
    {
      /* Préfecture depuis le décret du 20 août 2026 (ancienne sous-préfecture de Siguiri) : en attendant l'arrêté qui fixe sa
         composition, elle contient la seule commune de son chef-lieu. */
      nom: 'Kintinian', code: 'GN-SIG-KTN', chefLieu: 'Kintinian', lat: 11.60349, lng: -9.37573, anciennement: 'Siguiri',
      communes: [
        rurale('Kintinian', 'GN-SIG-KTN-KTN', 11.60349, -9.37573, [
          'Kintinian I', 'Kintinian II', 'Heremakonon', 'Dialakô', 'Balato I', 'Balato II', 'Balato III',
          'Tintissabani', 'Doubaya', 'Diarraya', 'Setiguiya', 'Setigui I', 'Setigui II', 'Boukaria',
          'Boukaria II', 'Boukaria-Concasseur', 'Boukaria-Cité', 'Fuensorkolen', 'Dambili', 'Lenkekôrô',
          'Fadougou', 'Fatoya', 'Fatoya I', 'Fatoya II', 'Samani', 'Samani I', 'Samani II', 'Kourouny',
          'Kamatiguia', 'Dar-es-Salam', 'Kofilany', 'Kourouda', 'Camagan', 'Kérouané',
        ]),
      ],
    },
  ],
};

/* ============================================================
 * FICHIER : src/modules/geo/region-kankan.ts
 *
 * Région de Kankan (Haute-Guinée) : 5 préfectures — Kankan, Kérouané,
 * Kouroussa, Mandiana, Siguiri. Même organisation que region-mamou.ts : chaque
 * sous-préfecture est sa commune rurale, le chef-lieu de préfecture est une
 * commune urbaine (« X-Centre »).
 *
 * Sources :
 *   · sous-préfectures historiques : INS, « Liste des sous-préfectures »
 *     (stat-guinee.org) et recensement 2014 (citypopulation.de) ;
 *   · nouvelles sous-préfectures : annuaire statistique INS de la région de
 *     Kankan + décisions de nomination des sous-préfets de juin 2026
 *     (guineenews pour Siguiri — 20 ; foutanet / guinee3 pour Kankan — 15,
 *     Kouroussa — 14, Mandiana — 12, Kérouané — 7). Tomba-Kansa, Fidako,
 *     Koumandjambougou (Siguiri) et Kanséréyah (Kouroussa) sont aussi des
 *     communes rurales de la loi de 2024 ;
 *   · 27 quartiers de la commune urbaine de Kankan : INS, projection 2024
 *     (tableau repris par l'étude « Croissance démographique et répartition
 *     socio-spatiale » sur Kankan), recoupé avec la liste de la Croix-Rouge
 *     (IFRC, inondations de Kankan) ;
 *   · quartiers et districts de Siguiri-Centre : site de la mairie de Siguiri
 *     (Siguiri Koro, Bolibana, Kouroudakoro, Siguiri Koura, Fodéba Keïta,
 *     Téléladji, Bananinkoro, Saint-Alexis) complété par la carte scolaire
 *     (ecolesenguinee.com, 39 quartiers et districts) — à vérifier ;
 *   · quartiers de Kérouané-Centre (13), Kouroussa-Centre (10) et
 *     Mandiana-Centre (7) : carte scolaire (ecolesenguinee.com), recoupée avec
 *     la presse (Doula, Komoniko à Kouroussa — africaguinee, guineenews ;
 *     Mandiana I, Oudiala à Mandiana — La voix du Peuple) — à vérifier auprès
 *     des mairies ;
 *   · districts des communes rurales : non publiés en ligne — à compléter par
 *     l'Import.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives ; les
 * lieux absents de la carte restent sans coordonnées.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

const rurale = (nom: string, code: string, lat?: number, lng?: number): SeedCommune => ({ nom, code, type: 'rurale', lat, lng });

export const REGION_KANKAN: SeedRegion = {
  nom: 'Kankan', code: 'GN-KAN', chefLieu: 'Kankan', lat: 10.38352, lng: -9.30694,
  prefectures: [
    {
      nom: 'Kankan', code: 'GN-KAN-KAN', chefLieu: 'Kankan', lat: 10.38352, lng: -9.30694,
      communes: [
        {
          nom: 'Kankan-Centre', code: 'GN-KAN-KAN-CU', type: 'urbaine', lat: 10.38352, lng: -9.30694,
          quartiers: [
            'Aviation', 'Banankoroda', 'Bordo', 'Briqueterie', 'Dalako', 'Dar-Es-Salam', 'Djodon',
            'Énergie', 'Farako I', 'Farako II', 'Fourban', 'Gare', 'Hermakonon I', 'Hermakonon II',
            'Kabada I', 'Kabada II', 'Kankankoura', 'Konkonikoro', 'Korialen', 'Madina', 'Météo',
            'Missira', 'Salamanida', 'Senkefara I', 'Senkefara II', 'Sogbè', 'Timbo',
          ],
        },
        rurale('Balandougou', 'GN-KAN-KAN-BAL', 10.39456, -9.25674),
        rurale('Batè-Nafadji', 'GN-KAN-KAN-BAT', 10.65949, -9.24797),
        rurale('Boula', 'GN-KAN-KAN-BOU', 9.7762, -8.49022),
        rurale('Gbérédou-Baranama', 'GN-KAN-KAN-GBE', 10.36585, -9.5464),
        rurale('Karifamoriyah', 'GN-KAN-KAN-KAR', 10.41811, -9.26857),
        rurale('Koumban', 'GN-KAN-KAN-KOU', 10.21173, -9.47074),
        rurale('Mamouroudou', 'GN-KAN-KAN-MAM', 9.54486, -9.31722),
        rurale('Missamana', 'GN-KAN-KAN-MIS', 10.29116, -9.04428),
        rurale('Moribayah', 'GN-KAN-KAN-MOR', 9.88182, -9.54783),
        rurale('Sabadou-Baranama', 'GN-KAN-KAN-SAB', 10.13007, -8.76241),
        rurale('Tinti-Oulen', 'GN-KAN-KAN-TIN', 10.21959, -9.208),
        rurale('Tokounou', 'GN-KAN-KAN-TOK', 9.65467, -9.77606),
        /* Nouvelles sous-préfectures */
        rurale('Djimbala', 'GN-KAN-KAN-DJI', 10.38972, -8.98052),
        rurale('Fodécariah-Balimana', 'GN-KAN-KAN-FOD', 10.85452, -9.21783),
        rurale('Djélibakoro', 'GN-KAN-KAN-DJE', 11.05286, -9.23665),
      ],
    },
    {
      nom: 'Kérouané', code: 'GN-KAN-KER', chefLieu: 'Kérouané', lat: 9.27057, lng: -9.00762,
      communes: [
        {
          nom: 'Kérouané-Centre', code: 'GN-KAN-KER-CU', type: 'urbaine', lat: 9.27057, lng: -9.00762,
          quartiers: [
            'Bafonro', 'Diala', 'Iraya', 'Kamandou', 'Koundjan', 'Manifadou', 'Matènèmoridou',
            'M\'Balia', 'Naniférédou', 'Nasser-Marché', 'Nasser-Mosquée', 'Nouny-Touré', 'Souloukoudenkala',
          ],
        },
        rurale('Banankoro', 'GN-KAN-KER-BAN', 9.17975, -9.29979),
        rurale('Damaro', 'GN-KAN-KER-DAM', 9.12911, -8.90117),
        rurale('Komodou', 'GN-KAN-KER-KOM', 9.63642, -9.05763),
        rurale('Kounsankoro', 'GN-KAN-KER-KOU', 9.03454, -8.99658),
        rurale('Linko', 'GN-KAN-KER-LIN'),
        rurale('Sibiribaro', 'GN-KAN-KER-SIB', 8.98214, -9.21956),
        rurale('Soromaya', 'GN-KAN-KER-SOR'),
      ],
    },
    {
      nom: 'Kouroussa', code: 'GN-KAN-KOU', chefLieu: 'Kouroussa', lat: 10.65136, lng: -9.881,
      communes: [
        {
          nom: 'Kouroussa-Centre', code: 'GN-KAN-KOU-CU', type: 'urbaine', lat: 10.65136, lng: -9.881,
          quartiers: [
            'Diaragbéla I', 'Diaragbéla II', 'Doula', 'Komoniko', 'Kouroussa Koura', 'Saman',
            'Samankouda', 'Sando', 'Wassabada', 'Wassako',
          ],
        },
        rurale('Babila', 'GN-KAN-KOU-BAB', 10.65418, -9.68325),
        rurale('Balato', 'GN-KAN-KOU-BAL', 10.71531, -9.56602),
        rurale('Banfèlè', 'GN-KAN-KOU-BAN', 10.15541, -10.12661),
        rurale('Baro', 'GN-KAN-KOU-BAR', 10.60767, -9.70364),
        rurale('Cisséla', 'GN-KAN-KOU-CIS', 10.82531, -10.60923),
        rurale('Douako', 'GN-KAN-KOU-DOU', 9.73767, -10.17221),
        rurale('Doura', 'GN-KAN-KOU-DOR'),
        rurale('Kiniéro', 'GN-KAN-KOU-KIN', 10.39379, -9.75221),
        rurale('Komola-Koura', 'GN-KAN-KOU-KOM', 11.04396, -10.40075),
        rurale('Koumana', 'GN-KAN-KOU-KMN', 10.68607, -9.66193),
        rurale('Sanguiana', 'GN-KAN-KOU-SAN', 10.79073, -10.18346),
        /* Nouvelles sous-préfectures */
        rurale('Fadou-Saba', 'GN-KAN-KOU-FAD', 10.99748, -10.52846),
        rurale('Kanséréyah', 'GN-KAN-KOU-KSR', 9.94332, -10.26264),
        rurale('Kouroukoro', 'GN-KAN-KOU-KRK', 10.92377, -10.74887),
      ],
    },
    {
      nom: 'Mandiana', code: 'GN-KAN-MAN', chefLieu: 'Mandiana', lat: 10.62211, lng: -8.69495,
      communes: [
        {
          nom: 'Mandiana-Centre', code: 'GN-KAN-MAN-CU', type: 'urbaine', lat: 10.62211, lng: -8.69495,
          quartiers: ['Château', 'Hérémakonon', 'Kissidoukoura', 'Mandiana I', 'Noumoussoulou', 'Oudiala', 'Zangbèla'],
        },
        rurale('Balandougouba', 'GN-KAN-MAN-BAL', 11.3256, -8.4103),
        rurale('Dialakoro', 'GN-KAN-MAN-DIA', 11.44087, -8.88437),
        rurale('Faralako', 'GN-KAN-MAN-FAR', 10.66759, -8.69729),
        rurale('Kantoumanina', 'GN-KAN-MAN-KAN', 10.47865, -8.65569),
        rurale('Kiniéran', 'GN-KAN-MAN-KIN', 11.0827, -8.82516),
        rurale('Kondianakoro', 'GN-KAN-MAN-KON'),
        rurale('Koundian', 'GN-KAN-MAN-KOU', 10.92037, -8.90795),
        rurale('Morodou', 'GN-KAN-MAN-MOR', 10.83781, -8.66685),
        rurale('Niantanina', 'GN-KAN-MAN-NIA', 10.95962, -8.33221),
        rurale('Saladou', 'GN-KAN-MAN-SAL', 10.27672, -8.32722),
        rurale('Sansando', 'GN-KAN-MAN-SAN', 11.07427, -9.19191),
        /* Nouvelle sous-préfecture */
        rurale('Kodiaran', 'GN-KAN-MAN-KOD', 10.55631, -8.88834),
      ],
    },
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

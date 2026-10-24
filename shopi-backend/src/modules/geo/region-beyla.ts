/* ============================================================
 * FICHIER : src/modules/geo/region-beyla.ts
 *
 * Région de Beyla (Guinée forestière) — créée par décret présidentiel du
 * 20 août 2026 (Beyla et Siguiri érigées en régions administratives, onze
 * sous-préfectures érigées en préfectures). Elle compte :
 *   · la préfecture de Beyla ;
 *   · les nouvelles préfectures de Sinko et de Karala (anciennes
 *     sous-préfectures de Beyla) et de Kouankan (ancienne sous-préfecture de
 *     Macenta).
 * Le décret renvoie à un arrêté du ministre de l'Administration du territoire
 * pour l'organisation des nouvelles préfectures : tant qu'il n'est pas publié,
 * chacune contient la seule commune de son chef-lieu, et les autres
 * sous-préfectures restent dans Beyla.
 *
 * Même organisation que region-mamou.ts : chaque sous-préfecture est sa commune
 * rurale (avec ses districts), le chef-lieu de Beyla est une commune urbaine
 * (Beyla-Centre, avec ses quartiers).
 *
 * Sources :
 *   · décret du 20 août 2026 : guineenews, affichesguineennes, accentguinee ;
 *   · sous-préfectures de Beyla : annuaire statistique INS de la région de
 *     Nzérékoré (15, dont Thiéwa et Fonodou), recensement 2014
 *     (citypopulation.de) ; Fonodou, commune rurale de la loi de 2024 ;
 *   · quartiers et districts : liste par sous-préfecture de ecolesenguinee.com
 *     (carte scolaire) — à vérifier ; Fonodou n'y a pas de page (districts à
 *     compléter par l'Import) ; le village « Sokourala » n'est pas repris dans
 *     Samana, Sokourala étant une sous-préfecture.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives ;
 * Fonodou et Tiéwa, absentes de la carte, restent sans coordonnées.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

/** Commune rurale (= sous-préfecture), avec ses districts quand on les connaît. */
const rurale = (nom: string, code: string, lat?: number, lng?: number, quartiers?: string[]): SeedCommune =>
  ({ nom, code, type: 'rurale', lat, lng, ...(quartiers ? { quartiers } : {}) });

export const REGION_BEYLA: SeedRegion = {
  nom: 'Beyla', code: 'GN-BEY', chefLieu: 'Beyla', lat: 8.68985, lng: -8.64835,
  prefectures: [
    {
      nom: 'Beyla', code: 'GN-BEY-BEY', chefLieu: 'Beyla', lat: 8.68985, lng: -8.64835,
      communes: [
        {
          nom: 'Beyla-Centre', code: 'GN-BEY-BEY-CU', type: 'urbaine', lat: 8.68985, lng: -8.64835,
          quartiers: [
            'Banankoro', 'Boiro', 'Dabadou', 'Diakolidou-Sobakono', 'Diakolidou-Tinikan', 'Diakoro',
            'Doukouréla', 'Dramé-Oumar', 'Fooma', 'Frebory-Camara', 'Gboro', 'Kéèmèbourama', 'Kissidou',
            'Koimoridou', 'M\'Balia', 'Morissangarédou', 'Mougnèdou', 'Pyaro', 'Samory-Touré', 'Tablala',
          ],
        },
        rurale('Boola', 'GN-BEY-BEY-BOO', 8.35835, -8.71579, [
          'N\'Balia-Camara', 'Dramé-Oumar', 'Mamady-Konaté', 'Madéra-Keita', 'Brikoïdou I', 'Brikoïdou II',
          'Ouenzou I', 'Ouenzou II', 'Yapangaye', 'Fouama', 'Koïdou', 'Sotidou', 'Boumoukoro',
          'Diabamoridou', 'Domanidou', 'Famodou', 'Djéouleno', 'Djissaférédou', 'Saoussoudou',
          'Diakorodou-Tininka', 'Vagbanata', 'Sibamou', 'Orata',
        ]),
        rurale('Diarraguerela', 'GN-BEY-BEY-DIA', 8.63846, -8.52031, [
          'Diaraguerela-Centre', 'Dougbadou', 'Doubgela', 'Fereboridou', 'Thiamodou', 'Toubakouno',
          'Vaferedou',
        ]),
        rurale('Diassodou', 'GN-BEY-BEY-DSS', 9.11147, -8.33986, [
          'Diassodou-Centre', 'Diarradou', 'Soribadou', 'Bembeya', 'Wanzona', 'Waro', 'Woro-Worodou',
        ]),
        rurale('Fonodou', 'GN-BEY-BEY-FON'),
        rurale('Fouala', 'GN-BEY-BEY-FOU', 8.97455, -8.33115, [
          'Foualah', 'Allamadou', 'Bouaredou', 'Doubadou', 'Malledou', 'Assadjimedou', 'Djibadoukoro',
          'Teninkemoridou', 'Morikendou', 'Tangbodou', 'Baidou', 'Zogbodou', 'Kouredjidou', 'Gnanssoumadou',
          'Farabana', 'Adjidou', 'Sarankesoridou', 'Feregbela',
        ]),
        rurale('Gbackédou', 'GN-BEY-BEY-GBA', 8.74323, -8.4104, [
          'Gbackédou', 'Missiboro', 'Sangbandou', 'Koubédou', 'Djakofomodou', 'Kafobaro', 'Moridou',
          'Fouaro', 'Bromadou', 'Cécédou', 'Fakouroudou', 'Koyola', 'Thiakouny', 'Yamodou', 'Koromadou',
        ]),
        rurale('Gbessoba', 'GN-BEY-BEY-GBE', 8.75269, -8.08516, [
          'Gbessoba-Centre', 'Tanantou', 'Borola', 'Tonodou', 'Mougnèdou', 'Mangba', 'Tombala', 'Kabadou',
          'Yarankadou', 'Facinédou', 'Sérégbédou', 'Djiffa', 'Siragba', 'Blangba', 'Fouasso', 'Fakourousso',
          'Biramadou', 'Morigba', 'Seya', 'Bakokoro', 'Tinkoro', 'Djéméné', 'Souroula',
        ]),
        rurale('Koumandou', 'GN-BEY-BEY-KOU', 9.16451, -7.99112, [
          'Koumandou-Centre', 'Bassadou', 'Belèkoro', 'Toubakoro', 'Kemosso', 'Famorodou', 'Diaradou',
          'Saaran', 'Vassiadou', 'Fassousso', 'Djemou', 'Soumansso', 'Togobala', 'Férédou',
        ]),
        rurale('Moussadou', 'GN-BEY-BEY-MOU', 8.7697, -8.60811, [
          'Moussadou-Centre', 'Famoila', 'Sarabédou', 'Diakoro', 'Wanino', 'Suéro', 'Fromaro', 'Sidikidou',
          'Diaboidou', 'Tignèko', 'Fakouloundou', 'Djigbèkoro', 'Kamandou',
        ]),
        rurale('Nionsomoridou', 'GN-BEY-BEY-NIO', 8.722, -8.83812, [
          'Nionsomoridou', 'Mafindou', 'Yèntèdou', 'Sossaba', 'Moribadou', 'Kissiboula', 'Sondou',
          'Tamikola', 'Traoréla', 'Kamandou',
        ]),
        rurale('Samana', 'GN-BEY-BEY-SAM', 9.11413, -8.55681, [
          'Samana I', 'Djibadou', 'Sokodou', 'Fakouroudou', 'Maramala', 'Sinedou', 'Kamandou', 'Gbodou',
          'Gnamankou-Feredou', 'Tamanko', 'Kobala', 'Bassadou', 'Sabouya', 'Sialy', 'Sogboro', 'Filadou',
        ]),
        rurale('Sokourala', 'GN-BEY-BEY-SOK', 9.21482, -8.06091, [
          'Sokourala', 'Tanatou', 'Tinikörö', 'Korokörö', 'Foromaro', 'Worocia', 'Kobanino', 'Gbenkoro',
          'Sengbendou',
        ]),
        rurale('Tiéwa', 'GN-BEY-BEY-TIE', undefined, undefined, [
          'Tiéwa', 'Tangodou', 'Djibakèmodou', 'Saniflala',
        ]),
      ],
    },
    {
      nom: 'Sinko', code: 'GN-BEY-SIN', chefLieu: 'Sinko', lat: 8.8787, lng: -8.27082, anciennement: 'Beyla',
      communes: [
        rurale('Sinko', 'GN-BEY-SIN-SIN', 8.8787, -8.27082, [
          'Belle-Vue', 'Bengoa', 'Biadou', 'Biramadou-Bada', 'Blasana', 'Blelenkoro', 'Bokomessin',
          'Bronkédou', 'Dabadou', 'Dar-es-Salam', 'Diani', 'Djendèdou', 'Djodou', 'Dougbè', 'Farakofé',
          'Hèrèmakono', 'Kofino', 'Komorodou', 'Konèla', 'Kouloundou', 'Kwamé-N\'Krumah', 'Lumumba',
          'M\'Balia', 'Madina', 'Malonsoridou', 'Moako I', 'Moako II', 'N\'Gomandou', 'Nafaya',
          'Nagnazéridou', 'Oussoumoridou', 'Sabouya', 'Siriya', 'Soribaro', 'Soridou', 'Sué', 'Toumanidou',
          'Yenfrédou',
        ]),
      ],
    },
    {
      nom: 'Karala', code: 'GN-BEY-KAR', chefLieu: 'Karala', lat: 9.38328, lng: -8.37685, anciennement: 'Beyla',
      communes: [
        rurale('Karala', 'GN-BEY-KAR-KAR', 9.38328, -8.37685, [
          'Karala I', 'Karala II', 'Kobala', 'Worro', 'Gbona', 'Dorela', 'Sèssè',
        ]),
      ],
    },
    {
      nom: 'Kouankan', code: 'GN-BEY-KOU', chefLieu: 'Kouankan', lat: 8.44597, lng: -9.13702, anciennement: 'Macenta',
      communes: [
        rurale('Kouankan', 'GN-BEY-KOU-KOU', 8.44597, -9.13702, [
          'Kouankan I', 'Kouankan II', 'Banko', 'Bonodou', 'Bonokoro', 'Dandano I', 'Dandano II', 'Famoila',
          'Goboela', 'Moribadou', 'Kamena', 'Nawoïnssou', 'Sagnodou', 'Korela',
        ]),
      ],
    },
  ],
};

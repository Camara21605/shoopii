/* ============================================================
 * FICHIER : src/modules/geo/region-nzerekore.ts
 *
 * Région de N'Zérékoré (Guinée forestière) : 5 préfectures — N'Zérékoré,
 * Guéckédou, Lola, Macenta, Yomou. Beyla en est sortie (région à part
 * depuis le décret du 20 août 2026, voir region-beyla.ts), avec Kouankan,
 * ancienne sous-préfecture de Macenta devenue préfecture de la région de
 * Beyla : Kouankan n'est donc pas reprise dans Macenta.
 *
 * Même organisation que region-mamou.ts : chaque sous-préfecture est sa commune
 * rurale (avec ses districts), le chef-lieu de préfecture est une commune
 * urbaine (« X-Centre », avec ses quartiers).
 *
 * Sources :
 *   · sous-préfectures : INS, « Liste des sous-préfectures » et annuaire
 *     statistique de la région de N'Zérékoré (64 avec Beyla) ; Guélo-N'faly et
 *     Kondembadou (Guéckédou) : communes rurales de la loi de 2024 ;
 *   · quartiers et districts : liste par sous-préfecture de ecolesenguinee.com
 *     (carte scolaire) — à vérifier auprès des mairies ; pour la ville de
 *     N'Zérékoré, les 22 quartiers concordent avec l'étude « Energy Needs and
 *     Trends Assessment for the Urban Commune of N'zérékoré » (2024, 22
 *     quartiers) ; l'entrée générique « Districts-Urbains » de Macenta-Centre
 *     n'est pas reprise.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives ; les
 * lieux absents ou ambigus restent sans coordonnées.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

/** Commune rurale (= sous-préfecture), avec ses districts quand on les connaît. */
const rurale = (nom: string, code: string, lat?: number, lng?: number, quartiers?: string[]): SeedCommune =>
  ({ nom, code, type: 'rurale', lat, lng, ...(quartiers ? { quartiers } : {}) });

export const REGION_NZEREKORE: SeedRegion = {
  nom: 'N\'Zérékoré', code: 'GN-NZE', chefLieu: 'N\'Zérékoré', lat: 7.75899, lng: -8.816,
  prefectures: [
    {
      nom: 'N\'Zérékoré', code: 'GN-NZE-NZE', chefLieu: 'N\'Zérékoré', lat: 7.75899, lng: -8.816,
      communes: [
        {
          nom: 'N\'Zérékoré-Centre', code: 'GN-NZE-NZE-CU', type: 'urbaine', lat: 7.75899, lng: -8.816,
          quartiers: [
            'Belle-Vue', 'Commercial', 'Dorota I', 'Dorota II', 'Gbangana', 'Gboyéba', 'Gonia I', 'Gonia II',
            'Gonia III', 'Horoya I', 'Horoya II', 'Koléyéba', 'Kwitèyapoulou', 'Mohomou', 'Nakoyakpala',
            'Nyen I', 'Nyen II', 'Sokoura I', 'Sokoura II', 'Tilépoulou', 'Wéssoua', 'Zébéla-Tokpa',
          ],
        },
        rurale('Bounouma', 'GN-NZE-NZE-BOU', 7.63906, -8.79693, [
          'Bounouma-Centre', 'Gonon', 'Kankoré', 'Pèlèdeye', 'Gbèlèye', 'Kéréma', 'Kpao', 'Gossopa',
          'Dourapa',
        ]),
        rurale('Gouécké', 'GN-NZE-NZE-GOU', 8.02558, -8.72491, [
          'Ceoba', 'Keayeba', 'Banzou-Nord', 'Takoleta', 'Tamoe', 'Nano', 'Vakamota-Sagno', 'Gbahaye',
        ]),
        rurale('Kobéla', 'GN-NZE-NZE-KOB', 7.88333, -9.02472, [
          'Kobéla I', 'Kobéla II', 'Konipara', 'Zogota', 'Maoun', 'Nhien',
        ]),
        rurale('Koropara', 'GN-NZE-NZE-KOR', 8.18139, -8.87243, [
          'Koropara-Centre', 'Makpozou', 'Konia-Aviation', 'Nyema-Nord', 'Boma-Nord', 'Koliwata',
          'Gounagalaye', 'Lomou', 'Koroh',
        ]),
        rurale('Koulé', 'GN-NZE-NZE-KOU', 8.0392, -9.02477, [
          'Koulé I', 'Koulé II', 'Kpaye', 'Pamporé', 'Kérézagaye', 'Pampara',
        ]),
        rurale('Palé', 'GN-NZE-NZE-PAL', 8.03299, -8.8904, [
          'Palé I', 'Palé II', 'Ouéyé', 'Kéorah', 'Zogbéanta', 'Gbéanta',
        ]),
        rurale('Samoé', 'GN-NZE-NZE-SAM', 7.80914, -8.86299, [
          'Samoé-Centre', 'Kamou', 'Kpaya', 'Gbily', 'Gbamba', 'Niampara', 'Wéya-Sud', 'Nyèma-Sud', 'Konala',
          'Koulé-Sud',
        ]),
        rurale('Soulouta', 'GN-NZE-NZE-SOU', 7.97407, -8.6871, [
          'Soulouta-Centre', 'Kpagalaye', 'Kpoulo', 'Kolakpata', 'Komata', 'Kola', 'Gbouo', 'Souhoulé',
        ]),
        rurale('Womey', 'GN-NZE-NZE-WOM', 8.0777, -8.78086, [
          'Womey I', 'Womey II', 'Yomata', 'Bowé-Nord', 'Kabiéta', 'Zénémounda', 'Foozou', 'Tokpata',
        ]),
        rurale('Yalenzou', 'GN-NZE-NZE-YAL', 7.70943, -8.68887, [
          'Yalenzou', 'Karana', 'Zao', 'Toulémou', 'Loulé-Nord', 'Gbotoye', 'Konia-Aviation', 'Galakpaye',
          'Bangouéta', 'Moata', 'Kotozou',
        ]),
      ],
    },
    {
      nom: 'Guéckédou', code: 'GN-NZE-GUE', chefLieu: 'Guéckédou', lat: 8.56165, lng: -10.13282,
      communes: [
        {
          nom: 'Guéckédou-Centre', code: 'GN-NZE-GUE-CU', type: 'urbaine', lat: 8.56165, lng: -10.13282,
          quartiers: [
            'Bafilaben', 'Baladou', 'Bambo', 'Boyada', 'Farako', 'Gbangbaïssa', 'Gnalenko', 'Gnoumoulou',
            'Guéckédou-Lélé', 'Herèmakonon', 'Hondonin', 'Kamalo', 'Kango', 'Karamo-Kourouma', 'Kiéssèneye',
            'Macenta Koura', 'Madina', 'Mangala', 'Missira', 'Nongolo', 'Sandia', 'Sokoro', 'Waoutoh',
            'Yendènin',
          ],
        },
        rurale('Bolodou', 'GN-NZE-GUE-BOL', 8.84869, -10.33295, [
          'Bolodou', 'Beddou-Carrefour', 'Faïndou', 'Gbandou', 'Kongotè', 'Koléadou', 'Kongoma I',
          'Kongoma II', 'Maféndou', 'Soumtou', 'Youlouadou', 'Boodou',
        ]),
        rurale('Fangamadou', 'GN-NZE-GUE-FAN', 8.49224, -10.58598, [
          'Fangamadou-Centre', 'Dakongo', 'Tongolo', 'Bassédou', 'Kangama', 'Kolomba', 'Kiéssèney', 'Koonin',
          'Yenguèma-Yombou', 'Gbondou', 'Sowadou', 'Ibema', 'Gbesse', 'Yégbadou', 'Bawa-Tongui',
        ]),
        rurale('Guélo-N\'faly', 'GN-NZE-GUE-GNF', undefined, undefined, [
          'Guélo-N\'faly', 'Bongoyallakala', 'Samgbawaly',
        ]),
        rurale('Guendembou', 'GN-NZE-GUE-GDB', 8.76653, -9.99927, [
          'Guendembou-Centre I', 'Guendembou-Centre II', 'Kat-Kama', 'Badala', 'Férohsayanin', 'Boukoussou',
          'Dandou-Bendou', 'Guémalo', 'Kiéssèneye', 'Kribéma', 'Wassaya', 'Wam',
        ]),
        rurale('Kassadou', 'GN-NZE-GUE-KAS', 8.92154, -10.33211, [
          'Kassadou-Centre', 'Kassadou II', 'Farawandou', 'Yomadou', 'Toumandou', 'Koindou', 'Kolonkala',
          'Bandadou', 'Tèmèssadou', 'Kountè', 'Oulako', 'Seredou', 'Bèlèssa', 'Kokouma', 'Léléssa',
          'Samadou', 'Kama', 'Kondabengou-Letyo', 'Sianfran',
        ]),
        rurale('Kondembadou', 'GN-NZE-GUE-KDB', 8.56746, -9.87236, [
          'Kondembadou', 'Bakama-Lélé', 'Nèmia-Toly',
        ]),
        rurale('Koundou', 'GN-NZE-GUE-KOU', undefined, undefined, [
          'Balladou-Pebal', 'Dandou', 'Foedou-Kollet', 'Gbondou', 'Kolibanda', 'Lengo', 'Sanguedou',
          'Sofedou-Kambadou', 'Koundou I', 'Koundou II', 'Tangolo', 'Temessadou-Lengo-Bendou',
          'Temmessadou-M\'boket', 'Yèndè-Bawa',
        ]),
        rurale('Nongoa', 'GN-NZE-GUE-NON', 8.51103, -10.32528, [
          'Nongoa-Centre', 'Kolian-Toly', 'Ouladen', 'Kolignindö', 'Tomandou', 'Balladou-Wongouénin',
          'Yilandou', 'Yaradou-Doumbo',
        ]),
        rurale('Ouéndé-Kénéma', 'GN-NZE-GUE-OUE', 8.4483, -10.53668, [
          'Ouéndé-Kènèma-Centre', 'Bawa-Kama', 'Koloadou', 'Dogbodou', 'Denguédou', 'Beindou', 'N\'Gouahoun',
          'Koundou-Toh', 'Woundédou', 'Oweit-Djiba', 'Beldou-Kama', 'Bounboukörö', 'Yèndè-Gnandéwa',
          'Yélendou-Pékongo',
        ]),
        rurale('Tékoulo', 'GN-NZE-GUE-TEK', 8.54258, -9.95386, [
          'Tékoulo-Centre', 'Bawa', 'Oweit-Kama', 'Sassama-Kama', 'Toly-Soka', 'Tallo-Bengou', 'Massabanga',
          'Wabengou', 'Koueldou', 'Kollé-Barret', 'Yaradou-Kongonany',
        ]),
        rurale('Tèmèssadou', 'GN-NZE-GUE-TEM', undefined, undefined, [
          'Tèmèssadou-Centre', 'Tèmèssadou-Toly', 'Bagbè-Daye', 'Bandalo-Kilaka', 'Beindou-Boodou',
          'Guéckédou-Pombo', 'Kindia', 'Kouakörö', 'Lèwa-Mamadou', 'Mongo', 'Séwa', 'Koindou-Légbéï Lélé',
          'Téldou', 'Yaradou-Kao', 'Fandou-Yéma', 'Yomadou-Koundou-Fama',
        ]),
      ],
    },
    {
      nom: 'Lola', code: 'GN-NZE-LOL', chefLieu: 'Lola', lat: 7.79969, lng: -8.52863,
      communes: [
        {
          nom: 'Lola-Centre', code: 'GN-NZE-LOL-CU', type: 'urbaine', lat: 7.79969, lng: -8.52863,
          quartiers: [
            'Balémou', 'Doussou', 'Flayapo', 'Gama-Koni-Koni', 'Gama-Yalé', 'Gbecke', 'Goh', 'Gogota I',
            'Gogota II', 'Gonota-Yalé', 'Gotekoly', 'Homiakoly I', 'Homiakoly II', 'Kpelekoly', 'Lomou',
            'Maghan-Mo', 'N\'Zon', 'Souwalakoly I', 'Souwalakoly II', 'Tieta', 'Tighen-Mo I', 'Tighen-Mo II',
            'Tokpanata', 'Weyakore', 'Woroyapo', 'Zougoueta I', 'Zougoueta II',
          ],
        },
        rurale('Bossou', 'GN-NZE-LOL-BOS', 7.65084, -8.50554, [
          'Bossou I', 'Bossou II', 'Gbah', 'Gbènèmou', 'Nion', 'Sèrengbara', 'Soromiata I', 'Soromiata II',
          'Thiassou', 'Thuo',
        ]),
        rurale('Foumbadou', 'GN-NZE-LOL-FOU', 8.1903, -8.41298, [
          'Foumbadou-Centre I', 'Foumbadou-Centre II', 'Faboridou', 'Fakouroudouba', 'Fakouroudouni',
          'Manako', 'Manasoba', 'Morigbédou', 'Vamorodou', 'Gambadou', 'Kabayandou', 'Balladou',
        ]),
        rurale('Gama-Béréma', 'GN-NZE-LOL-GAM', 7.89432, -8.23668, [
          'Gama-Béréma I', 'Gama-Béréma II', 'Pinè', 'Guélémata', 'Gbata', 'Fanghan I', 'Fanghan II',
          'Kassieta', 'Guimpo',
        ]),
        rurale('Guéassou', 'GN-NZE-LOL-GUE', 8.02598, -8.23328, [
          'Guéasso I', 'Guéasso II', 'Garassou', 'Gonota', 'Zéssou', 'Gbotoro', 'Tono', 'Moribadou',
          'Fandou', 'Niomorodou', 'Morissimandou', 'Sayodou',
        ]),
        rurale('Kokota', 'GN-NZE-LOL-KOK', 7.91397, -8.49817, [
          'Kokota-Centre', 'Yénéta', 'Kany', 'Kéoulénta', 'Gopouta', 'Léaplèta', 'Doulouba', 'Diawassou',
          'Malou',
        ]),
        rurale('Lainé', 'GN-NZE-LOL-LAI', 8.07378, -8.47945, [
          'Lainé I', 'Lainé II', 'Lainé III', 'Didita', 'Sinkolé', 'Kolata', 'Kèniénta', 'Fogna', 'Yokpota',
          'Déen',
        ]),
        rurale('N\'Zoo', 'GN-NZE-LOL-NZO', 7.67875, -8.31367, [
          'N\'Zoo I', 'N\'Zoo II', 'Doromou', 'Gaah', 'Gonomanota', 'Gbakoré', 'Bourata', 'Kéoulenta',
          'Pora',
        ]),
        rurale('Tounkarata', 'GN-NZE-LOL-TOU', 7.77864, -8.19796, [
          'Tounkarata I', 'Tounkarata II', 'Bouzouta', 'Dirita', 'Kpinita', 'Gbèckè', 'Seyta', 'Iro',
          'Kogota',
        ]),
      ],
    },
    {
      nom: 'Macenta', code: 'GN-NZE-MAC', chefLieu: 'Macenta', lat: 8.54585, lng: -9.46792,
      communes: [
        {
          nom: 'Macenta-Centre', code: 'GN-NZE-MAC-CU', type: 'urbaine', lat: 8.54585, lng: -9.46792,
          quartiers: [
            'Bamala', 'Banize', 'Bokoni', 'Bongomadou', 'Bouzié', 'Bowa I', 'Bowa II', 'Fassankoni',
            'Ghaledazou', 'Gnoumamoridou', 'Hermakono I', 'Hermakono II', 'Kamandou-Cité', 'Kamandou-Koura',
            'Kolakodou', 'Kpangbalamaï', 'Kpaou', 'Kpokolofassama', 'Macenta-Koura', 'Madina', 'Mohamed V',
            'Moilamidou', 'Nyavalazou', 'Patrice', 'Tripo', 'Zézé Bokoni',
          ],
        },
        rurale('Balizia', 'GN-NZE-MAC-BAL', 8.62022, -9.58135, [
          'Balizia-Centre', 'Faadou', 'Kotezia', 'Bhakpaou', 'Bokoulouma', 'Bézérega', 'Dighilazou',
          'Djomankoidou', 'Fassazou', 'Kolouma', 'Kotidou', 'Lassaou', 'Massamè', 'Passima', 'Rouézou',
          'Diabèlèzou', 'Sangassou', 'Tomönö', 'Voloa', 'Zalabölözou', 'Zipovaïzia',
        ]),
        rurale('Binikala', 'GN-NZE-MAC-BIN', 8.77118, -9.53798, [
          'Binikala-Centre I', 'Binikala-Centre II', 'Gohomaï', 'Douama', 'Diodou', 'Vassala', 'Kalaïzia',
          'Kpavelegbaou', 'Kpalaolema', 'Konesseridou', 'Djimissadou-Koura', 'Djimissadou-Koro',
          'Mangangoumadou', 'Lémenèssou', 'Malema', 'Niéssou', 'Samporia', 'Zembezou', 'Souamaï',
        ]),
        rurale('Bofossou', 'GN-NZE-MAC-BOF', 8.66203, -9.69423, [
          'Bofossou-Centre', 'Bokpozou', 'Doïzea', 'Gbelelazou', 'Kpövöwolaou', 'Bouaïlazou', 'Nyanguezazou',
          'Kpètéowolamai', 'Sovaou', 'Ozaololazou', 'Zipoïzéba', 'Bololazou', 'Kilima', 'Lofama',
          'Touwoleou', 'Senguéga', 'Valibassou', 'Téïnèma',
        ]),
        rurale('Daro', 'GN-NZE-MAC-DAR', 8.51845, -9.56904, [
          'Daro-Centre', 'Badiaro', 'Balladou', 'Bouadou', 'Banankoro', 'Diomandou', 'Doussouyaradou',
          'Foloou', 'Karo', 'Kpandewaladou', 'Komodou', 'Kotizou', 'Kovelédou', 'Momokenédou', 'Déléou',
          'Kolobalidou', 'Paziazou', 'Sakpaou', 'Sengbedou I', 'Moïla',
        ]),
        rurale('Fassankoni', 'GN-NZE-MAC-FAS', 8.03238, -9.364, [
          'Fassankoni-Centre', 'Baimani', 'Makabou', 'Kpoda', 'Noborotono', 'Tilibaye', 'Iyézou',
          'Zinigorozo', 'N\'Zenie',
        ]),
        rurale('Koyama', 'GN-NZE-MAC-KOY', 7.90218, -9.35796, [
          'Koyamah-Centre I', 'Koyamah-Centre II', 'Koyamah-Centre III', 'Koyamah-Belle-Vue', 'Bodezia',
          'Brebezou', 'Gozoguizia', 'Lokpoou', 'Zappah I', 'Zappah II', 'Zappah III', 'Zobroma', 'Barouta',
          'Maraou', 'Oulimai', 'Origuizezou', 'Lowo', 'Zatioula', 'Kpaou', 'Zeoulemai', 'Zoué', 'Boulé',
        ]),
        rurale('N\'Zébéla', 'GN-NZE-MAC-NZE', 8.08379, -9.09471, [
          'N\'Zébéla-Centre', 'Balagolaye', 'Bayamah', 'Doumou', 'Koumah', 'Oyafero', 'Sibata I',
          'Sibata II', 'Silissou',
        ]),
        rurale('Orémaï', 'GN-NZE-MAC-ORE', 8.43218, -9.43013, [
          'Orémaï-Centre I', 'Orémaï-Centre II', 'Kassanka I', 'Kassanka II', 'Diomai', 'Massadou',
          'Sedimai', 'Néridou', 'Zobroma', 'Dopamai',
        ]),
        rurale('Panziazou', 'GN-NZE-MAC-PAN', 8.6227, -9.85676, [
          'Panziazou-Centre I', 'Panziazou-Centre II', 'Bakama', 'Bovoguizezou', 'Guilaotazou', 'Gozombou',
          'Louyazou', 'Ombia', 'Taoulela', 'Zambezou', 'Ziaouvassama', 'Zoulakoro',
        ]),
        rurale('Sengbédou', 'GN-NZE-MAC-SEN', 8.40655, -9.64017, [
          'Sengbédou-Centre', 'Makabaladou', 'Gbokorodou', 'Nialessou', 'Niandiaro', 'Sangolomai',
          'Féléwala', 'Siédou', 'N\'Zoyaro', 'Lopko',
        ]),
        rurale('Sérédou', 'GN-NZE-MAC-SER', 8.37447, -9.28304, [
          'Sérédou I', 'Sérédou II', 'Avilissou I', 'Avilissou II', 'Boloma', 'Balassou', 'Boo',
          'Boussédou I', 'Boussédou II', 'Irié I', 'Irié II', 'Maléwoita', 'Koïma', 'Mamadidou',
        ]),
        rurale('Vasérédou', 'GN-NZE-MAC-VAS', undefined, undefined, [
          'Vasérédou-Centre', 'Kabakoro', 'Koulodou', 'Wamadou', 'Brognadou', 'Kouéyaro',
        ]),
        rurale('Watanka', 'GN-NZE-MAC-WAT', 8.80432, -9.80778, [
          'Watanka', 'Aolazou', 'Bötèma', 'Goyala', 'Obolazou', 'Kobalawa', 'Kozézou', 'Sogolohou',
          'Vassaiziazou', 'Kabadou',
        ]),
      ],
    },
    {
      nom: 'Yomou', code: 'GN-NZE-YOM', chefLieu: 'Yomou', lat: 7.56958, lng: -9.25975,
      communes: [
        {
          nom: 'Yomou-Centre', code: 'GN-NZE-YOM-CU', type: 'urbaine', lat: 7.56958, lng: -9.25975,
          quartiers: [
            'Gbamou', 'Gbokomèy', 'Kolipilita', 'Komou', 'Kpaolé', 'Kwalakoly',
          ],
        },
        rurale('Banié', 'GN-NZE-YOM-BAN', 7.5427, -9.33964, [
          'Banié', 'Mèlèkpoma', 'Gottoye', 'Dongoéta', 'Yowa', 'Diéckény', 'Koliyé',
        ]),
        rurale('Bheta', 'GN-NZE-YOM-BHE', undefined, undefined, [
          'Bhêta', 'Bemeye', 'Lagbara', 'Kpaole', 'Oroyakoré',
        ]),
        rurale('Bignamou', 'GN-NZE-YOM-BIG', 7.34175, -9.0782, [
          'Bignamou', 'Ballan', 'Banzou', 'Galakpaye', 'Gbamou', 'Kpoo', 'Nawei',
        ]),
        rurale('Bowé', 'GN-NZE-YOM-BOW', 7.78304, -9.166, [
          'Bowé I', 'Bowé II', 'Ballo', 'Bamakama', 'Ouétoa', 'Ouro I', 'Ouro II', 'Wéya', 'Lonhondia',
          'Yalakpalé',
        ]),
        rurale('Diécké', 'GN-NZE-YOM-DIE', 7.34792, -8.95431, [
          'Diécké I', 'Diécké II', 'Koimpa', 'Baala', 'Danié', 'Soopa', 'Naapa', 'Guêpa', 'Korohouan',
          'Saoro',
        ]),
        rurale('Péla', 'GN-NZE-YOM-PEL', 7.61626, -9.11724, [
          'Péla I', 'Péla II', 'Bérégna', 'Galaye', 'Nonah', 'Ouéta', 'Yilata', 'Yonoh',
        ]),
      ],
    },
  ],
};

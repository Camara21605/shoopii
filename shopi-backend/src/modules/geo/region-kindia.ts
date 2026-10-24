/* ============================================================
 * FICHIER : src/modules/geo/region-kindia.ts
 *
 * Région de Kindia (Basse-Guinée) : 5 préfectures — Kindia, Coyah, Dubréka,
 * Forécariah, Télimélé. Même organisation que region-mamou.ts : chaque
 * sous-préfecture est sa commune rurale (avec ses districts), le chef-lieu de
 * préfecture est une commune urbaine (« X-Centre », avec ses quartiers).
 *
 * Manéah et Sanoyah (Coyah) et Kagbélen (Dubréka) — communes urbaines de la
 * loi de 2024 — sont déjà dans le référentiel avec le Grand Conakry
 * (conakry-communes.ts) : elles ne sont pas répétées ici.
 *
 * Sources :
 *   · sous-préfectures : INS, « Liste des sous-préfectures » et annuaire
 *     statistique de la région de Kindia (47 sous-préfectures), recoupés avec
 *     les nominations de sous-préfets de mai 2023 (guineenews) — dont
 *     Moribayah (Forécariah), Kawessi et Sogolon (Télimélé) ;
 *   · quartiers des communes urbaines et districts des communes rurales :
 *     liste par sous-préfecture de ecolesenguinee.com (carte scolaire), y
 *     compris la page « Commune de Dubréka » (15 quartiers) — à vérifier
 *     auprès des mairies. Les villages Moribayah (Moussaya) et « Forod »
 *     (Farmoriah, doublon tronqué de Forodougou) ne sont pas repris.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives ; les
 * lieux absents ou ambigus (plusieurs lieux du même nom) restent sans
 * coordonnées.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

/** Commune rurale (= sous-préfecture), avec ses districts quand on les connaît. */
const rurale = (nom: string, code: string, lat?: number, lng?: number, quartiers?: string[]): SeedCommune =>
  ({ nom, code, type: 'rurale', lat, lng, ...(quartiers ? { quartiers } : {}) });

export const REGION_KINDIA: SeedRegion = {
  nom: 'Kindia', code: 'GN-KIN', chefLieu: 'Kindia', lat: 10.0544, lng: -12.8559,
  prefectures: [
    {
      nom: 'Kindia', code: 'GN-KIN-KIN', chefLieu: 'Kindia', lat: 10.0544, lng: -12.8559,
      communes: [
        {
          nom: 'Kindia-Centre', code: 'GN-KIN-KIN-CU', type: 'urbaine', lat: 10.0544, lng: -12.8559,
          quartiers: [
            'Abattoir I', 'Abattoir II', 'Bagueya', 'Bamba', 'Bambaya', 'Banlieue', 'Bendougou', 'Bokaria',
            'Cacia I', 'Cacia II', 'Caravansérail', 'Condetta III', 'Condetta-Mosquée', 'Dar-Es-Salam',
            'Féréfou I', 'Féréfou II', 'Filigbé', 'Fissa École', 'Fissa Hôpital', 'Gadawawa', 'Gangan',
            'Garanguelaya', 'Gare', 'Kaaly', 'Kenendé', 'Koba-Pastoria', 'Koliady I', 'Koliady II',
            'Koumbaya', 'Manquépas TP', 'Manquépas-Mosquée', 'Météo', 'Neribily', 'Sambaya', 'Sarakoleah',
            'Segueya', 'Sekouya', 'Sinaniya', 'Tabouna', 'Tafory', 'Tafory-Almamiya', 'Tanènè-Kella',
            'Tatagui', 'Thierno-Djibiya', 'Wolia', 'Wondi', 'Yéwolé',
          ],
        },
        rurale('Bangouyah', 'GN-KIN-KIN-BAN', 10.33323, -12.95227, [
          'Bangouya-Centre', 'Missira', 'Kébéfriguia', 'Madina-Djan', 'Damouya', 'Warakhalan', 'Sokia',
          'Koundabalaya', 'Kereba', 'Kansa-Tenè', 'Woleya', 'Minyaya', 'Khatia', 'Siminiya', 'Madina-Fanta',
          'Madina-Foula', 'Khoriya', 'Kebaly', 'Garafiri', 'Kobéléya', 'Yattaya', 'Kansaa-Sikhinma',
        ]),
        rurale('Damankanyah', 'GN-KIN-KIN-DAM', 10.00702, -12.90412, [
          'Khaliakhory', 'Foulaya-Cité', 'Goleya', 'Samoreya', 'Komoya', 'Gbéreakhory', 'Damakania',
          'Madina-Laya', 'Berenfory',
        ]),
        rurale('Friguiagbé', 'GN-KIN-KIN-FRI', 9.95357, -12.95412, [
          'Friguiagbé I-Centre', 'Friguiagbé II-Centre', 'Camarabounyi', 'Daboya', 'Koliagbé', 'Tembaya',
          'Foulayah', 'Kinyaya', 'Friguiagbé-Gare', 'Gariakhory', 'Kanty',
        ]),
        rurale('Kolenté', 'GN-KIN-KIN-KOL', 10.0984, -12.62339, [
          'Kolenté-Centre', 'Baguia', 'Siguiton', 'Maléah', 'Gania', 'Tanènè', 'Kinsanya', 'Kondéya',
          'Khonoya', 'Kabèlèya', 'Kouyéya', 'Kirita', 'Boundoubantang', 'Balonfory', 'Békilo', 'Walia',
          'Thièwèrè', 'Missidè', 'Yankaya', 'Wolia', 'Lambeya', 'Sanda',
        ]),
        rurale('Linsan', 'GN-KIN-KIN-LIN', 10.28027, -12.43988, [
          'Linsan I-Centre', 'Linsan II-Centre', 'Tafory', 'Lembou', 'Sangoya', 'Guémésoron', 'Walia',
          'Siminiaya', 'Damakhaniya', 'Boubouya', 'Doniya', 'Balandougou', 'Kamba', 'Yomboya', 'Botowi',
          'Kouyéya',
        ]),
        rurale('Madina-Oula', 'GN-KIN-KIN-MAD', 9.87624, -12.4557, [
          'Madina I', 'Madina II', 'Bas-Simbaraya', 'Haut-Simbaraya', 'Beyen-Byen', 'Dar-Es-Salam',
          'Kolakhouré', 'Saferin', 'Souleymanya', 'Wassou', 'Télico', 'Badet-Kanty', 'Samiankhouré',
          'Sékou-Sorya', 'Lansanaya',
        ]),
        rurale('Mambiya', 'GN-KIN-KIN-MAM', undefined, undefined, [
          'Mambia-Centre', 'Débélé', 'Gbinkily', 'Tanènè', 'Fossikhouré I', 'Fossikhouré II', 'Kabèlèya',
          'Fonkon', 'Bouramayah', 'Friguiady', 'Fomah', 'Khaligoro', 'Kolibaya', 'Sanayah', 'Samaya-Maciss',
        ]),
        rurale('Molota', 'GN-KIN-KIN-MOL', 9.92974, -12.83369, [
          'Molota I', 'Molota II', 'Diguity', 'Kaledy', 'Bhakhayakhory I', 'Bhakhayakhory II', 'Yembering',
          'Mambia', 'Koundaya', 'Doubaya', 'Kalékhouré', 'Séfan', 'Saanya',
        ]),
        rurale('Samayah', 'GN-KIN-KIN-SAM', undefined, undefined, [
          'Samaya-Centre', 'Comoya', 'Kondoya', 'Dantoumaya', 'Denki-Madina', 'Yattiakhory', 'Missira',
          'Kaporo', 'Walliah', 'Yembetta', 'Sorondon', 'Khonia', 'Maleah', 'Condetta',
        ]),
        rurale('Souguéta', 'GN-KIN-KIN-SOU', 10.14975, -12.53701, [
          'Souguéta I', 'Souguéta II', 'Wolia', 'Yalaya', 'Dianfou', 'Kalia',
        ]),
      ],
    },
    {
      nom: 'Coyah', code: 'GN-KIN-COY', chefLieu: 'Coyah', lat: 9.70904, lng: -13.38896,
      communes: [
        {
          nom: 'Coyah-Centre', code: 'GN-KIN-COY-CU', type: 'urbaine', lat: 9.70904, lng: -13.38896,
          quartiers: [
            'Centre', 'Fily I', 'Fily II', 'Nord I', 'Nord II', 'KM54', 'Nakiry', 'Labô', 'Karouba',
            'Somayah-Plateau', 'Somayah-Mosquée', 'Somayah-Centre', 'Somayah-Fory', 'Laminayah',
            'Doumbouyah-École', 'Doumbouyah-Centre', 'Doumbouyah Alkhaly-Seydouya', 'Tougandé', 'Batouyah',
          ],
        },
        rurale('Kouriah', 'GN-KIN-COY-KOU', 9.77733, -13.34579, [
          'Kouriah-Centre', 'Bangouyah', 'Goleah', 'Kolakhouré', 'Moriakhory', 'Tabily', 'Koba', 'Tanènè',
          'Frirbadé',
        ]),
        rurale('Wonkifong', 'GN-KIN-COY-WON', 9.6581, -13.38451, [
          'Wonkifong-Centre', 'Ballayah', 'Donéah', 'Kouyeyah', 'Toguiron', 'Nasser', 'Kendoumayah',
          'Tambayah', 'Mangata', 'Bonfet', 'Kounsouta', 'Kiriyah', 'Yenguiyakhory', 'Balamodouyah',
          'Laminayah',
        ]),
      ],
    },
    {
      nom: 'Dubréka', code: 'GN-KIN-DUB', chefLieu: 'Dubréka', lat: 9.78898, lng: -13.51697,
      communes: [
        {
          nom: 'Dubréka-Centre', code: 'GN-KIN-DUB-CU', type: 'urbaine', lat: 9.78898, lng: -13.51697,
          quartiers: [
            'Dögbéré', 'Fofomèrè', 'Gbéreiré', 'Keitaya', 'Kènèndé', 'Kolognet-N\'sira', 'Mafoudia',
            'Nèguèyah', 'Symbayah', 'Tangan', 'Tanènè', 'Terset', 'Tompètin', 'Toumanyah', 'Yorokoguéyah',
          ],
        },
        rurale('Badi', 'GN-KIN-DUB-BAD', 10.28062, -13.41663, [
          'Bady-Centre', 'Fannabadé', 'Gbèyen', 'Kounsita', 'Madina-Sagalè', 'Missidé', 'Sakhouré',
          'Samayah', 'Tonton', 'Touguikhouré', 'Yenyen-Maléah',
        ]),
        rurale('Falessadé', 'GN-KIN-DUB-FAL', 10.14026, -13.30516, [
          'Faléssadé-Centre I', 'Faléssadé-Centre II', 'Kalifayah', 'Waliah', 'Yalayah', 'Bady-Fareyah',
          'Ningueti', 'Kambaliyah',
        ]),
        rurale('Khorira', 'GN-KIN-DUB-KHO', 9.88142, -13.49074, [
          'Khorira-Centre', 'Taban', 'Khangoléah', 'Magnokhoun', 'Soumayah', 'Lanyakhou', 'Dembayah',
          'Gbantama', 'Baguéah', 'Gbènsènkè', 'Kondéyiré',
        ]),
        rurale('Ouassou', 'GN-KIN-DUB-OUA', 10.03387, -13.64284, [
          'Ouassou-Centre', 'Tafory-Sosso', 'Koubia', 'Yafrayah', 'Gbéréyiré', 'Sarayah', 'Dikiyah',
          'Korogonyah', 'Guèmètédé', 'Khountoun',
        ]),
        rurale('Tanènè', 'GN-KIN-DUB-TAN', undefined, undefined, [
          'Tanènè I', 'Tanènè II', 'Madina', 'Sanawalia', 'Soubétidé', 'Kawonso', 'Kénendé-Lory', 'Dixinn',
          'Dembayah', 'Kanagban', 'Benna', 'Samayah', 'Konfonyah', 'Yénouyah', 'Filayah', 'Soguiyah',
          'Loumbayah', 'Kaléta-Fotonta', 'Kondéah',
        ]),
        rurale('Tondon', 'GN-KIN-DUB-TON', 10.37147, -13.35572, [
          'Tondon-Centre', 'Domiagbé', 'Boubouyah', 'Dembayah', 'Simbayah', 'Farenyah', 'Kongori',
          'Silikhoun', 'Kaffa', 'Konyeyah', 'Kaléta', 'Khamba', 'Maleyah', 'Missira', 'Khimbély',
          'Simbarayah', 'Tagbé', 'Kobria', 'Sonfon', 'Bambayah', 'Gombabhè', 'Bouramayah', 'Walia',
          'Yenguissa', 'Kouéah',
        ]),
      ],
    },
    {
      nom: 'Forécariah', code: 'GN-KIN-FOR', chefLieu: 'Forécariah', lat: 9.43246, lng: -13.08072,
      communes: [
        {
          nom: 'Forécariah-Centre', code: 'GN-KIN-FOR-CU', type: 'urbaine', lat: 9.43246, lng: -13.08072,
          quartiers: [
            'Tatagui I', 'Tatagui II', 'Fatako I', 'Fatako II', 'Madina', 'Koutoumaniah',
          ],
        },
        rurale('Alassoya', 'GN-KIN-FOR-ALA', undefined, undefined, [
          'Allassoyah-Centre', 'Bassia', 'Darry', 'Dandayah', 'Feindèmodiah', 'Herico', 'Kouriah', 'Saféyah',
          'Sory-Woula', 'Taban', 'Tonkoyah',
        ]),
        rurale('Benty', 'GN-KIN-FOR-BEN', 9.16269, -13.21758, [
          'Benty-Centre', 'Bouramayah', 'Kakoutoulaye', 'Kaleyire', 'Kigbaly', 'Kounssouta', 'M\'Boro',
          'Makaré', 'Morikaniah', 'N\'Compan', 'Palatougou',
        ]),
        rurale('Farmoriah', 'GN-KIN-FOR-FAR', 9.2762, -13.02808, [
          'Farmoréah-Centre', 'Tambayah', 'Hoourou', 'Taigbé', 'Daara', 'Kaffou', 'Forodougou', 'Daboyah',
          'Contah', 'Moola', 'Maliguiagbé', 'Pamelap', 'Siramodia', 'Moussa-Fangamayah', 'Saourou',
          'Kébéyah',
        ]),
        rurale('Kaback', 'GN-KIN-FOR-KAB', 9.33926, -13.40582, [
          'Bolimanda', 'Bossimiyah', 'Manké', 'Matakang', 'Seydouyah', 'Tonguiron', 'Yélibanet', 'Youlayen',
        ]),
        rurale('Kakossa', 'GN-KIN-FOR-KAK', 9.44594, -13.43818, [
          'Kainté', 'Wondifary', 'Yéniah', 'Menyiré', 'Sambouyah', 'Taouyah',
        ]),
        rurale('Kallia', 'GN-KIN-FOR-KAL', undefined, undefined, [
          'Kaliah-Centre', 'Bokariah', 'Malguiah-Fory', 'Gberika', 'Kalako', 'Kalemodiagbè', 'Yenguissa',
          'Tanah', 'Lakhanfiayah', 'Sinkinet', 'Mabala',
        ]),
        rurale('Maférinya', 'GN-KIN-FOR-MAF', 9.5455, -13.28558, [
          'Maférinyah-Centre I', 'Maférinyah-Centre II', 'Morifinya', 'Sengnelen', 'Yindi', 'Madinagbé',
          'Koket', 'Gbéreiré', 'Fandie',
        ]),
        rurale('Moribayah', 'GN-KIN-FOR-MOR', 9.59141, -13.33961, [
          'Moribayah', 'Maléah',
        ]),
        rurale('Moussaya', 'GN-KIN-FOR-MOU', 9.46316, -12.85358, [
          'Moussayah-Centre I', 'Moussayah-Centre II', 'Dianèyah', 'Ganyah', 'Kaliah', 'Kamalayah',
          'Koffion', 'Layah', 'Santika', 'Sinéyah', 'Tassen',
        ]),
        rurale('Sikhourou', 'GN-KIN-FOR-SIK', 9.61346, -12.80899, [
          'Sikhourou-Centre', 'Dallonyah', 'Gombokhori', 'Tabekhouré', 'Santiguiyah', 'Walliah', 'Lefouré',
          'Degui-Degui', 'Daffira', 'Khalantou', 'Mamadou Camara',
        ]),
      ],
    },
    {
      nom: 'Télimélé', code: 'GN-KIN-TEL', chefLieu: 'Télimélé', lat: 10.90203, lng: -13.03267,
      communes: [
        {
          nom: 'Télimélé-Centre', code: 'GN-KIN-TEL-CU', type: 'urbaine', lat: 10.90203, lng: -13.03267,
          quartiers: [
            'Baguiré', 'Barkéré', 'Fanta', 'Gomboya', 'Goulgoul', 'Hafia', 'Kolly', 'Mégnéré', 'Mindia',
            'Missidé', 'Niabély', 'Sodjo', 'Sokoliba', 'Soindé',
          ],
        },
        rurale('Bourouwal', 'GN-KIN-TEL-BOU', undefined, undefined, [
          'Brouwal-Centre', 'Daroul', 'Dhaguel', 'Djindjimma', 'Wendou-Boro', 'Felah', 'Hollande',
          'Kansaghi', 'Kouyan', 'Kimbon', 'Ninguètèrè', 'Télico', 'Thiéwè', 'Tossokèrè',
        ]),
        rurale('Daramagnaki', 'GN-KIN-TEL-DAR', undefined, undefined, [
          'Daramagnaki-Centre', 'Bambaya', 'Kounda', 'Diandian', 'Bhoundou-Eda', 'Bembou', 'Lamba', 'Kewoye',
          'Kourakoto', 'Boubéré', 'Dakakoura', 'Bantighel', 'Kobet', 'Madinadian', 'Leyséré',
        ]),
        rurale('Gougoudjé', 'GN-KIN-TEL-GOU', 10.81889, -12.98821, [
          'Gougoudjè-Centre', 'Koussy', 'Kaffima', 'Kaaba', 'Missidè-Kébou', 'N\'Gouma', 'N\'Dantari-Bakolo',
        ]),
        rurale('Kawessi', 'GN-KIN-TEL-KAW', undefined, undefined, [
          'Kawessi', 'Maci', 'Kabara', 'Diougourou',
        ]),
        rurale('Koba', 'GN-KIN-TEL-KOB', undefined, undefined, [
          'Koba-Centre', 'Téliré', 'Mamouda', 'Madina-Dian', 'Saapy',
        ]),
        rurale('Kollet', 'GN-KIN-TEL-KOL', 10.45975, -13.16502, [
          'Kollet-Centre', 'Banboukhou', 'Toumaniya', 'Garama', 'Wara', 'Silkhoun', 'Bouma', 'Simbalia',
          'Mambia', 'Konkouré (Daroun)', 'Koukoukhouré', 'Kouria',
        ]),
        rurale('Konsotami', 'GN-KIN-TEL-KON', 10.93128, -13.50207, [
          'Konsotami', 'Nampougou', 'Dombé', 'Bhouly', 'Bergué', 'Touma', 'Hounsirè-Guilè', 'Thimmewi',
          'N\'Dantaba',
        ]),
        rurale('Missira', 'GN-KIN-TEL-MIS', undefined, undefined, [
          'Missira-Centre', 'Daroul', 'Guèmè', 'Kalouma', 'Bandouma', 'Bommany', 'Boussoura',
          'Dondel-Lopoye', 'Bhoundou-Lingué', 'Thindoye', 'M\'Borou', 'Foye', 'Kompeta', 'N\'Danta',
          'Madina-Fass', 'Kahel',
        ]),
        rurale('Santou', 'GN-KIN-TEL-SAN', 11.09162, -13.13157, [
          'Peguety', 'Kouratountou', 'Kokoya', 'N\'Denda', 'Paradji', 'Telithiouté', 'Goussou',
        ]),
        rurale('Sarékaly', 'GN-KIN-TEL-SAR', 10.96092, -13.01837, [
          'Sarékaly-Centre', 'Madina-Télico', 'Hollandé-Dian', 'Ley-Legguel', 'Filo',
        ]),
        rurale('Sinta', 'GN-KIN-TEL-SIN', 10.70061, -12.97479, [
          'Sinta-Centre', 'Bendé', 'Sansandji', 'Kambaya', 'Boudaye', 'Toude', 'Toudon', 'Bely', 'Biro',
          'Hassana', 'Guémé-Sangan',
        ]),
        rurale('Sogolon', 'GN-KIN-TEL-SOG', 10.5602, -13.25378, [
          'Baralandé', 'Ley-Sérè', 'Sayonya I', 'Sayonya II', 'Malal-Kondo', 'Sougué', 'Tourkoun',
          'Kailondji',
        ]),
        rurale('Tarihoye', 'GN-KIN-TEL-TAR', 10.96169, -13.23118, [
          'Tarihoye-Centre', 'Nabhé', 'Silaty', 'Kouraboguel', 'Horèrè Wendou', 'Sonnhé', 'Ley-Balla',
          'Boussoura',
        ]),
        rurale('Thionthian', 'GN-KIN-TEL-THI', 10.75949, -13.34669, [
          'Thionthian-Centre', 'Tounou', 'Madina-Dian', 'Labha-N\'Diyan', 'N\'Dirè', 'Ley-Biro', 'Hamdalaye',
        ]),
      ],
    },
  ],
};

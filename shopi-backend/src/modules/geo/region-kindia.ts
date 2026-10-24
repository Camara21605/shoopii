/* ============================================================
 * FICHIER : src/modules/geo/region-kindia.ts
 *
 * Région de Kindia (Basse-Guinée) — pour l'instant la préfecture de Kindia
 * (Coyah, Dubréka, Forécariah et Télimélé viendront ensuite). Même
 * organisation que region-mamou.ts : chaque sous-préfecture est sa commune
 * rurale (avec ses districts), le chef-lieu est une commune urbaine
 * (Kindia-Centre, avec ses quartiers).
 *
 * Sources :
 *   · 10 sous-préfectures : INS, « Liste des sous-préfectures »
 *     (stat-guinee.org), recoupée avec la carte scolaire ;
 *   · quartiers de Kindia-Centre et districts des 10 communes rurales : liste
 *     par sous-préfecture de ecolesenguinee.com (carte scolaire) — à vérifier
 *     auprès des mairies.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives ;
 * Mambiya et Samayah (plusieurs lieux du même nom) restent sans coordonnées.
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
  ],
};

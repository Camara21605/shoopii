/* ============================================================
 * FICHIER : src/modules/geo/region-faranah.ts
 *
 * Région de Faranah (Haute-Guinée) : 4 préfectures — Faranah, Dabola,
 * Dinguiraye, Kissidougou. Même organisation que region-mamou.ts : chaque
 * sous-préfecture est sa commune rurale (avec ses districts), le chef-lieu de
 * préfecture est une commune urbaine (« X-Centre », avec ses quartiers).
 *
 * Sources :
 *   · 42 sous-préfectures : INS, « Liste des sous-préfectures » et annuaire
 *     statistique de la région de Faranah (stat-guinee.org) — Faranah 15
 *     (dont Ballaya et Bambaya, détachées de Banian), Dabola 8, Dinguiraye 7,
 *     Kissidougou 12 ; recoupé avec les nominations de sous-préfets de 2023
 *     (guineenews) ;
 *   · quartiers des 4 communes urbaines et districts des communes rurales :
 *     liste par sous-préfecture de ecolesenguinee.com (carte scolaire) — à
 *     vérifier auprès des mairies ; Ballaya n'y a pas de page (districts à
 *     compléter par l'Import), et ses villages Ballaya / Bambaya ne sont pas
 *     repris dans Banian puisqu'ils sont devenus des sous-préfectures.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives ; les
 * lieux absents de la carte (Ballaya, Beindou de Kissidougou, Koundiadou)
 * restent sans coordonnées.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

/** Commune rurale (= sous-préfecture), avec ses districts quand on les connaît. */
const rurale = (nom: string, code: string, lat?: number, lng?: number, quartiers?: string[]): SeedCommune =>
  ({ nom, code, type: 'rurale', lat, lng, ...(quartiers ? { quartiers } : {}) });

export const REGION_FARANAH: SeedRegion = {
  nom: 'Faranah', code: 'GN-FAR', chefLieu: 'Faranah', lat: 10.04249, lng: -10.74082,
  prefectures: [
    {
      nom: 'Faranah', code: 'GN-FAR-FAR', chefLieu: 'Faranah', lat: 10.04249, lng: -10.74082,
      communes: [
        {
          nom: 'Faranah-Centre', code: 'GN-FAR-FAR-CU', type: 'urbaine', lat: 10.04249, lng: -10.74082,
          quartiers: [
            'Abattoir I', 'Abattoir II', 'Aviation', 'Birissa', 'Dandaya', 'Faranah Koura', 'Khoroyakoura',
            'Laminiya Kondeboun', 'Magna', 'Marché I', 'Marché II', 'Milidala', 'Modia', 'Mosquée',
            'Pont Koma', 'Sambouya', 'Sansambou', 'Sansanko', 'Sirikoloni I', 'Sirikoloni II', 'Sokourala',
            'Souleymania', 'Tonkolonko I', 'Tonkolonko II', 'Yarawalia',
          ],
        },
        rurale('Ballaya', 'GN-FAR-FAR-BAL'),
        rurale('Bambaya', 'GN-FAR-FAR-BAM', 9.29239, -10.45342, [
          'Bambaya-Centre', 'Foréya', 'Baourouya-Centre', 'Kamaro', 'Kombaya', 'Dalaba', 'Farangbèma',
          'Kinkèma', 'Kolombaya', 'Foutakouma', 'Ninkoundou-Centre', 'Woliondou-Centre', 'Baourianin',
          'Niandawaro', 'Yarto', 'Sèrèya',
        ]),
        rurale('Banian', 'GN-FAR-FAR-BAN', 9.60054, -10.53827, [
          'Banankoro', 'Bandaya', 'Banian I', 'Banian II', 'Baourouya', 'Doumbafe', 'Douwoulema', 'Kaola',
          'Konkowa', 'Kossaba', 'Kouratou', 'Mandou', 'Nianfourando', 'Samoudou', 'Sembeldo', 'Sokourala',
          'Yarawadou Koura',
        ]),
        rurale('Bantoun', 'GN-FAR-FAR-BAT', 10.05911, -10.58526, [
          'Bantoun', 'Maradou', 'Siriman', 'Nionah',
        ]),
        rurale('Beindou', 'GN-FAR-FAR-BEI', 10.14607, -10.5406, [
          'Beindou', 'Dalafilany', 'Diana', 'Koumandi Koro', 'Niako', 'Serekoro',
        ]),
        rurale('Dantilia', 'GN-FAR-FAR-DAN', 9.94128, -10.94971, [
          'Dantilia I', 'Dantilia II', 'Soumandou', 'Tagagnah', 'Biri', 'Khorira-Koro', 'Dalaforêt', 'Yatia',
        ]),
        rurale('Gnaléah', 'GN-FAR-FAR-GNA', 9.9374, -10.55904, [
          'Arfela', 'Kamara', 'Laya Doula', 'Gnaléah I', 'Gnaléah II', 'Friko',
        ]),
        rurale('Hérémakonon', 'GN-FAR-FAR-HER', 9.88965, -11.06681, [
          'Hérémakono I', 'Hérémakono II', 'Gbetala', 'Guéafari',
        ]),
        rurale('Kobikoro', 'GN-FAR-FAR-KOB', 9.21254, -10.54361, [
          'Balladou', 'Forokonia', 'Forokonia-Centre', 'Frankouma', 'Kobikoro-Centre', 'Kondoléah',
          'Safigna', 'Santoh', 'Forogbéya Koumandou', 'Kamalgban', 'Krissai', 'Forogbéya-Baffè', 'Gbaffaria',
          'Souloukoudou-Mara', 'Yomodou', 'Yogboma', 'Brikoldou', 'Kandadou', 'Gbargbarma',
        ]),
        rurale('Maréla', 'GN-FAR-FAR-MAR', 10.17628, -11.41561, [
          'Boketo', 'Yafato', 'Boussoura', 'Friguia', 'Hérémakono Foulbhé', 'Kalia I', 'Kalia II', 'Témaka',
          'Kassa Bouna', 'Lolin', 'Marella I', 'Marella II', 'Marella III', 'Mansankouni', 'Missidé Bolia',
          'Sabèrè-Kalia', 'Solonyéréya', 'Soloya', 'Soumayéréya', 'Taganya',
        ]),
        rurale('Passayah', 'GN-FAR-FAR-PAS', 10.32082, -11.07591, [
          'Passaya-Almamiya', 'Passaya-Marché', 'Morighéya', 'Béléya', 'Danda', 'Diguila', 'Kolowalia',
          'Koutawalia', 'Nguéneya', 'Nienounya', 'Soungbanya', 'Toumania', 'Grand-Kondebou', 'Bendougou',
          'Dansokoya',
        ]),
        rurale('Sandéniah', 'GN-FAR-FAR-SAN', 10.06862, -11.12028, [
          'Bontala', 'Kambamboun', 'Komboya', 'Laya Solima', 'Niaya-Forita', 'Sandénia Marché',
          'Sandénia Mosquée', 'Kassaya', 'Béndékhoudédy', 'Bétébèkhi',
        ]),
        rurale('Songoyah', 'GN-FAR-FAR-SON', 9.72444, -10.87715, [
          'Damania', 'Songoyah', 'Songoyah-Hôpital', 'Songoyah-Marché', 'Kabeleya', 'Lancerdou', 'Maninko',
          'Mongo', 'Cerdou', 'Salia', 'Siramagna', 'Tinterba', 'Yoyah', 'Yiraya', 'Kankomoria', 'Komboya',
        ]),
        rurale('Tindo', 'GN-FAR-FAR-TIN', 9.96638, -10.69694, [
          'Dalamara', 'Gbanworoya', 'Morowa', 'Neredouni', 'Safaramba', 'Silimi', 'Tindo-Centre',
          'Tindo Cité', 'Koromasorya', 'Bolokada',
        ]),
        rurale('Tiro', 'GN-FAR-FAR-TIR', 9.7389, -10.63594, [
          'Tiro-Almamya', 'Kabayaba', 'Kabayakoro', 'Kalanko', 'Kalanko-Marché', 'Layah Sando',
          'Tiro-Marché', 'Tiro-Sogbè', 'Tiro-Hôpital', 'Layah-Sando-Hôpital', 'Sanankoro', 'Selen', 'Serdou',
          'Yalawa', 'Saourou',
        ]),
      ],
    },
    {
      nom: 'Dabola', code: 'GN-FAR-DAB', chefLieu: 'Dabola', lat: 10.74217, lng: -11.10649,
      communes: [
        {
          nom: 'Dabola-Centre', code: 'GN-FAR-DAB-CU', type: 'urbaine', lat: 10.74217, lng: -11.10649,
          quartiers: [
            'Babilia', 'Baniré', 'Dabola Koro', 'Deux Kilo', 'Foundeng I', 'Foundeng II', 'Hamdallaye',
            'Hérémakono', 'Kambaya', 'Kalela', 'Konkronya', 'Saourou', 'Sinsery', 'Sognessa', 'Tinkisso',
          ],
        },
        rurale('Arfamoussaya', 'GN-FAR-DAB-ARF', 10.74246, -11.35914, [
          'Arfamoussaya-Centre', 'Fadama', 'Fella Hamdallaye', 'Fella Mosquée', 'Gnalen', 'Kalako', 'Koola',
          'Walissa',
        ]),
        rurale('Banko', 'GN-FAR-DAB-BAN', 10.72421, -10.70929, [
          'Badiko', 'Bandankelen', 'Dalado', 'Diabary Dalado', 'Herako', 'Hérémakono', 'Kallela', 'Kebeya I',
          'Kebeya II', 'Morigbeya', 'Nafadji', 'Niandan', 'Souarela',
        ]),
        rurale('Bissikrima', 'GN-FAR-DAB-BIS', 10.85335, -10.93702, [
          'Balayan', 'Tinkisso', 'Sampolia', 'Loppè', 'Kankanfodeya', 'Kambaya', 'Kolon', 'Dibamba', 'Bassy',
          'Toumania', 'Hamdallaye',
        ]),
        rurale('Dogomet', 'GN-FAR-DAB-DOG', 10.71385, -11.43354, [
          'Dabola-Bérété', 'Dogomet-Centre', 'Fello N\'Diandy', 'Kobolonia', 'Koolo Hindé', 'Sarifoula',
          'Bafing', 'Segueya', 'Sitakoto', 'Totia',
        ]),
        rurale('Kankama', 'GN-FAR-DAB-KAN', 10.92405, -11.10823, [
          'Kankama-Centre', 'Tanoula', 'Matiguila', 'Bouka', 'Sackola', 'Diguilim', 'Wondefodeya',
        ]),
        rurale('Kindoye', 'GN-FAR-DAB-KIN', 10.44156, -11.30466, [
          'Kindoye I', 'Kindoye II', 'Tiguissan', 'Sarifoula Walan',
        ]),
        rurale('Konindou', 'GN-FAR-DAB-KON', 10.68599, -10.85421, [
          'Dandakara', 'Djelila', 'Konendou I', 'Konendou II',
        ]),
        rurale('N\'Dema', 'GN-FAR-DAB-NDE', 10.66744, -10.96446, [
          'N\'Dema-Centre', 'Diabakania', 'Finala', 'Semkounya', 'Konso', 'Kobafe', 'Gagna', 'Simini-Sando',
        ]),
      ],
    },
    {
      nom: 'Dinguiraye', code: 'GN-FAR-DIN', chefLieu: 'Dinguiraye', lat: 11.29643, lng: -10.71494,
      communes: [
        {
          nom: 'Dinguiraye-Centre', code: 'GN-FAR-DIN-CU', type: 'urbaine', lat: 11.29643, lng: -10.71494,
          quartiers: [
            'Ballagnoumaya', 'Paradji', 'Kamban Sabé', 'Kamban Aïndé', 'Tinkisso', 'Parawol Diagui',
            'Koubi Ley Serè', 'Koumbia Ley Fello', 'Lankon', 'Bhouria', 'Manden', 'Kouroula', 'Sebekoro',
            'Kebaly', 'Hellayabhè',
          ],
        },
        rurale('Banora', 'GN-FAR-DIN-BAN', 11.61163, -10.29656, [
          'Banora', 'Matagania', 'Kignero', 'M\'Bonet', 'Loppe-Sountou', 'Boussoura', 'Darayilimalomalo',
          'Boubèrè', 'Nafadji-Foulbhè', 'Nafadji-Maninka', 'Famere-Lydoubhe', 'M\'Baloufara', 'Kolla',
          'Kokorobani', 'Boukaria', 'N\'Diarendi',
        ]),
        rurale('Dialakoro', 'GN-FAR-DIN-DIA', 10.97341, -11.05938, [
          'Dialakoro-Centre', 'Dar-Es-Salam', 'Farabana', 'Sandafara', 'Mossoko', 'Wantagala', 'Fello Lamou',
        ]),
        rurale('Diatifèrè', 'GN-FAR-DIN-DIT', 11.69707, -10.71296, [
          'Daibatou', 'Diatifèrè-Centre', 'Fadougou', 'Fammere', 'Raghaya', 'Fandanda', 'Mamoudouya I',
          'Mamoudouya II', 'Nanako', 'Wonson', 'Kalin', 'Karfa', 'Sourou', 'Syllaya', 'Soubekindi',
          'Sankaran',
        ]),
        rurale('Gagnakali', 'GN-FAR-DIN-GAG', 11.52176, -10.97253, [
          'Gagnakali-Centre', 'Herako', 'Bagui', 'Beleya', 'Keyla', 'Kalinko Missira', 'Missira Djallonké',
          'Boussoura', 'Nouhouya',
        ]),
        rurale('Kalinko', 'GN-FAR-DIN-KAL', 11.27027, -11.17673, [
          'Kalinko', 'Missira', 'Niogo', 'Loufa Missidé', 'Farabato', 'Fodécariah', 'Djissouma',
          'Diaberemini', 'Walandama', 'Yalaguèrè', 'Babila', 'Fognokonko', 'Diankourou', 'Bokoti',
          'Kansato Missidé', 'Leppy-Thiewy', 'Santanfara',
        ]),
        rurale('Lansanya', 'GN-FAR-DIN-LAN', 11.38939, -10.8797, [
          'Dayebhè', 'Lansanaya', 'Hansaghèrè', 'Sanntiguia', 'Tambanoro', 'Wouyabhè',
        ]),
        rurale('Sélouma', 'GN-FAR-DIN-SEL', 11.11351, -10.96787, [
          'Sélouma-Centre', 'Fadiya', 'Kobala', 'Walan Mosquée', 'Wala Wala', 'Bossèrè',
        ]),
      ],
    },
    {
      nom: 'Kissidougou', code: 'GN-FAR-KIS', chefLieu: 'Kissidougou', lat: 9.19239, lng: -10.09827,
      communes: [
        {
          nom: 'Kissidougou-Centre', code: 'GN-FAR-KIS-CU', type: 'urbaine', lat: 9.19239, lng: -10.09827,
          quartiers: [
            'Dar Es Salam', 'Douninkonon', 'Ernesto', 'Farako', 'Gbangban', 'Hamdallaye', 'Hèrèmakonon',
            'Kénéma', 'Kérédou', 'Korodou I', 'Korodou II', 'Limaniya', 'Madina I', 'Madina II', 'Marah',
            'M\'Balia', 'Missira', 'Sogbé I', 'Sogbé II', 'Sogbé III', 'Timbo', 'TP', 'Yassafekoro',
            'Yassafekoura',
          ],
        },
        rurale('Albadariah', 'GN-FAR-KIS-ALB', 9.55212, -10.10247, [
          'Albadariah-Centre', 'Dawa Farko', 'Farawaya', 'Mernah', 'Moreah', 'Yasardou', 'Yomadou',
          'Mandoukoro', 'Firawaya', 'Worokoro', 'Manfran',
        ]),
        rurale('Banama', 'GN-FAR-KIS-BAN', 9.06748, -9.77674, [
          'Banama-Centre', 'Kero', 'Koumassan', 'Mantranian', 'Massafendou', 'Telebodou', 'Ouendekere',
        ]),
        rurale('Bardou', 'GN-FAR-KIS-BAR', 9.0339, -9.86505, [
          'Bardou-Centre', 'Foniadou', 'Gbangbadou-Ouende', 'Kondian', 'Soffedou', 'Yaadou',
        ]),
        rurale('Beindou', 'GN-FAR-KIS-BEI', undefined, undefined, [
          'Beindou-Centre', 'Fermessadouba', 'Gbangadou', 'Kama-Koumandou', 'Kaouro', 'Koldou', 'Komaro',
          'Koundou', 'Pompo', 'Léla', 'Gnamandou', 'Sangalabadou', 'Massadou-Toly', 'Yoromandou',
        ]),
        rurale('Fermessadou-Pombo', 'GN-FAR-KIS-FER', 9.13509, -10.15051, [
          'Bouyé', 'Dembayara', 'Fermessadou', 'Gbenikoro', 'Kongola-Loundy', 'Massakoundou', 'Saldou',
          'Wonde Beindou', 'Yaradou', 'Faramakoura',
        ]),
        rurale('Firawa', 'GN-FAR-KIS-FIR', 9.21678, -9.78558, [
          'Beledou', 'Dandou', 'Dombadou', 'Dondian', 'Firawa-Centre', 'Fondambadou', 'Sandia',
        ]),
        rurale('Gbangbadou', 'GN-FAR-KIS-GBA', 9.27476, -9.99859, [
          'Dawa', 'Fourdoukoura', 'Gbangbadou-Centre', 'Faramaya', 'Kenema Bomba', 'Kissi-Yallankoro',
          'Niandou', 'Yallakalan', 'Yardo', 'Hérako',
        ]),
        rurale('Koundiadou', 'GN-FAR-KIS-KOU', undefined, undefined, [
          'Balansama', 'Bembèrè', 'Bongoro', 'Yendé-Sory', 'Kondiadou-Centre', 'Kossa', 'Mafendou',
          'Makolon', 'Solontoh', 'Soulakolo', 'Tenkia',
        ]),
        rurale('Manfran', 'GN-FAR-KIS-MAN', 9.34505, -9.76833, [
          'Bambassiria', 'Bambayéléma', 'Dialakoro', 'Fanceldou', 'Gnamana', 'Konardo', 'Manfran-Centre',
          'Sirkouldou', 'Djirdou',
        ]),
        rurale('Sangardo', 'GN-FAR-KIS-SAN', 9.55873, -10.14296, [
          'Borokoko', 'Dagnora', 'Déyah', 'Foreah', 'Kamerendou', 'Mermeriah', 'Sandaya', 'Sangardo-Centre',
          'Wossokoroma', 'Maindou', 'Mansogna', 'Damandou', 'Kinsardou', 'Faroro',
        ]),
        rurale('Yendé-Millimou', 'GN-FAR-KIS-YEN', 8.89085, -10.1699, [
          'Bagbè', 'Bamba', 'Faindou I', 'Firadou', 'Heako', 'Koumasan', 'Toufoudou', 'Walto', 'Wondeto',
          'Yendè I', 'Yendè II', 'Sagbe',
        ]),
        rurale('Yombiro', 'GN-FAR-KIS-YOM', 9.08822, -10.30638, [
          'Bagbè', 'Bamba-Korodou', 'Bongardou', 'Dankaldou', 'Forodou', 'Koindou', 'Trakoré', 'Yombiro',
          'Ouladin', 'Brouadou-Lele', 'Leiessa', 'Yerendou', 'Songodou', 'Krimoriah',
        ]),
      ],
    },
  ],
};

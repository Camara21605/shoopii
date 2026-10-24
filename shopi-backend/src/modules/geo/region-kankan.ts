/* ============================================================
 * FICHIER : src/modules/geo/region-kankan.ts
 *
 * Région de Kankan (Haute-Guinée) — découpage du décret du 20 août 2026 :
 * Kankan, Tokounou, Sabadou-Baranama, Kérouané, Kouroussa, Mandiana, Dialakoro.
 * Siguiri en est sortie : région à part (region-siguiri.ts). Tokounou,
 * Sabadou-Baranama (anciennes sous-préfectures de Kankan) et Dialakoro
 * (ancienne sous-préfecture de Mandiana) sont préfectures ; en attendant
 * l'arrêté qui fixe leur composition, chacune contient la seule commune de son
 * chef-lieu.
 * Même organisation que region-mamou.ts : chaque sous-préfecture est sa commune
 * rurale (avec ses districts), le chef-lieu de préfecture est une commune
 * urbaine (« X-Centre », avec ses quartiers).
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
 *   · districts des communes rurales : liste par sous-préfecture de
 *     ecolesenguinee.com (carte scolaire) — à vérifier ; pas de liste pour
 *     Djimbala et Doura, ni pour Balandougou (la page du site reprend par
 *     erreur la liste de Balandougouba, Mandiana) ; le village « Djimbala »
 *     n'est pas repris dans Missamana (sous-préfecture à part) ;
 *   · décret du 20 août 2026 : guineenews, guinee7, accentguinee.
 * Coordonnées : chef-lieu sur la carte (OpenStreetMap), approximatives ; les
 * lieux absents de la carte restent sans coordonnées.
 * ============================================================ */

import type { SeedCommune, SeedRegion } from './region-mamou';

/** Commune rurale (= sous-préfecture), avec ses districts quand on les connaît. */
const rurale = (nom: string, code: string, lat?: number, lng?: number, quartiers?: string[]): SeedCommune =>
  ({ nom, code, type: 'rurale', lat, lng, ...(quartiers ? { quartiers } : {}) });

export const REGION_KANKAN: SeedRegion = {
  nom: 'Kankan', code: 'GN-KAN', chefLieu: 'Kankan', lat: 10.38352, lng: -9.30694,
  prefectures: [
    {
      nom: 'Kankan', code: 'GN-KAN-KAN', chefLieu: 'Kankan', lat: 10.38352, lng: -9.30694,
      communes: [
        {
          nom: 'Kankan-Centre', code: 'GN-KAN-KAN-CU', type: 'urbaine', lat: 10.38352, lng: -9.30694,
          quartiers: [
            'Aviation', 'Banankoroda', 'Bordo', 'Briqueterie', 'Dalako', 'Dar-Es-Salam', 'Djodon', 'Énergie',
            'Farako I', 'Farako II', 'Fourban', 'Gare', 'Hermakonon I', 'Hermakonon II', 'Kabada I',
            'Kabada II', 'Kankankoura', 'Konkonikoro', 'Korialen', 'Madina', 'Météo', 'Missira',
            'Salamanida', 'Senkefara I', 'Senkefara II', 'Sogbè', 'Timbo',
          ],
        },
        rurale('Balandougou', 'GN-KAN-KAN-BAL', 10.39456, -9.25674),
        rurale('Batè-Nafadji', 'GN-KAN-KAN-BAT', 10.65949, -9.24797, [
          'Batè-Nafadji', 'Moussaya', 'Batè-Soïla', 'Tassilima', 'Tèminindou', 'Madina', 'Kökourouba',
          'Djafra', 'Bakonkokorö', 'Köfilani', 'Doutilaba', 'Bakonkocisséla',
        ]),
        rurale('Boula', 'GN-KAN-KAN-BOU', 9.7762, -8.49022, [
          'Boula-Centre', 'Wandjaladou', 'Kossa', 'Kotrona', 'Kodjana', 'Kalafilila', 'Manianko',
          'Salassila',
        ]),
        rurale('Gbérédou-Baranama', 'GN-KAN-KAN-GBE', 10.36585, -9.5464, [
          'Baranama-Centre I', 'Baranama-Centre II', 'Binko', 'Boussouran', 'Dalabani', 'Kanimissaya',
          'Sanana', 'Tamoni', 'Takoura', 'Fadou',
        ]),
        rurale('Karifamoriyah', 'GN-KAN-KAN-KAR', 10.41811, -9.26857, [
          'Karifamoriyah-Centre', 'Koba-Sando', 'Tenkelen', 'Foussen', 'Aliamounoun-Kandrala',
          'Kanimandjandou Koba', 'Dourendji', 'Moïko-Centre', 'Djirlan', 'M\'Bodou', 'Bankalan', 'Sofonko',
          'Diankana', 'Soumankoï', 'Siramissadou Koba',
        ]),
        rurale('Koumban', 'GN-KAN-KAN-KOU', 10.21173, -9.47074, [
          'Koumban I', 'Koumban II', 'Makonon', 'Kandaya I', 'Lanininkin', 'Folon', 'Férédou', 'Maramoriya',
          'Koumbankoura', 'Sakorola', 'Sanankoro', 'Sékoro', 'Kassa', 'Morigbèdou', 'Gbélema',
        ]),
        rurale('Mamouroudou', 'GN-KAN-KAN-MAM', 9.54486, -9.31722, [
          'Mamouroudou', 'Farabana', 'Férédou', 'Fankonon', 'Foloni', 'Djiradoukoro', 'Tenensidiya',
          'Diarabadou', 'Kassourou', 'Morigbéya', 'Ballakoya', 'Kariardou', 'Kassabiya', 'Fassoumankoya',
          'Bisseliaba',
        ]),
        rurale('Missamana', 'GN-KAN-KAN-MIS', 10.29116, -9.04428, [
          'Missamana', 'Kigneba', 'Solo', 'Doumawalia', 'Djè', 'Noumoussaya', 'Sontila',
        ]),
        rurale('Moribayah', 'GN-KAN-KAN-MOR', 9.88182, -9.54783, [
          'Moribayah-Centre I', 'Moribayah-Centre II', 'Borokoro', 'Gbalako', 'Banko', 'Famanian', 'Maradou',
          'Touba', 'Tininkan', 'Kola Banankoro', 'Sekoro', 'Iradou', 'Manfran', 'Dalagnan',
        ]),
        rurale('Tinti-Oulen', 'GN-KAN-KAN-TIN', 10.21959, -9.208, [
          'Tintioulén', 'Djènèmaréna', 'Massaréna-Banankoro', 'Gbanankoura', 'Boriah', 'Borifigna',
          'Ourembaya', 'Sirimaya', 'Bissandou', 'Gbotola', 'Djindo', 'Séfounou', 'Sanah',
        ]),
        rurale('Djimbala', 'GN-KAN-KAN-DJI', 10.38972, -8.98052),
        rurale('Fodécariah-Balimana', 'GN-KAN-KAN-FOD', 10.85452, -9.21783, [
          'Fodécariah-Balimana', 'Dalaba', 'Kignèro',
        ]),
        rurale('Djélibakoro', 'GN-KAN-KAN-DJE', 11.05286, -9.23665, [
          'Djélibakoro I', 'Djélibakoro II',
        ]),
      ],
    },
    {
      /* Préfecture depuis le décret du 20 août 2026 (ancienne sous-préfecture de Kankan) : en attendant l'arrêté qui fixe sa
         composition, elle contient la seule commune de son chef-lieu. */
      nom: 'Tokounou', code: 'GN-KAN-TOK', chefLieu: 'Tokounou', lat: 9.65467, lng: -9.77606, anciennement: 'Kankan',
      communes: [
        rurale('Tokounou', 'GN-KAN-TOK-TOK', 9.65467, -9.77606, [
          'Tokounou-Centre I', 'Tokounou-Centre II', 'Kowan-Nafadji', 'Sansambaya', 'Worobé', 'Sirikoro',
          'Missadou', 'Deldou', 'Gbalakö', 'Talikoro', 'Doussoukoya', 'Founkouran', 'Fantongnan', 'Gnalenko',
          'Koudou', 'Manicelia', 'Totala', 'Finsankoro', 'Toumania', 'Worobèkoro',
        ]),
      ],
    },
    {
      /* Préfecture depuis le décret du 20 août 2026 (ancienne sous-préfecture de Kankan) : en attendant l'arrêté qui fixe sa
         composition, elle contient la seule commune de son chef-lieu. */
      nom: 'Sabadou-Baranama', code: 'GN-KAN-SAB', chefLieu: 'Sabadou-Baranama', lat: 10.13007, lng: -8.76241, anciennement: 'Kankan',
      communes: [
        rurale('Sabadou-Baranama', 'GN-KAN-SAB-SAB', 10.13007, -8.76241, [
          'Baranama I', 'Baranama II', 'Sandandoh', 'Womalen', 'Worokoro', 'Bananko', 'Brombala',
          'Bambarandou', 'Diamona', 'Djougna', 'Kalankalan', 'Kariandou', 'Komah', 'Komoukoh', 'Konsa',
          'Moriah', 'Tèrè',
        ]),
      ],
    },
    {
      nom: 'Kérouané', code: 'GN-KAN-KER', chefLieu: 'Kérouané', lat: 9.27057, lng: -9.00762,
      communes: [
        {
          nom: 'Kérouané-Centre', code: 'GN-KAN-KER-CU', type: 'urbaine', lat: 9.27057, lng: -9.00762,
          quartiers: [
            'Bafonro', 'Diala', 'Iraya', 'Kamandou', 'Koundjan', 'Manifadou', 'Matènèmoridou', 'M\'Balia',
            'Naniférédou', 'Nasser-Marché', 'Nasser-Mosquée', 'Nouny-Touré', 'Souloukoudenkala',
          ],
        },
        rurale('Banankoro', 'GN-KAN-KER-BAN', 9.17975, -9.29979, [
          'Banankoro I', 'Banankoro II', 'Commandaya', 'Fodéssiaya', 'Gbénko', 'Damaya', 'Somassania',
          'Tinssinkoro', 'Sirgnaldou', 'Warrou Condèro', 'Falando', 'Kalmando', 'Massando', 'Damangbèdou',
          'Worokoro-Kampéma', 'Pananka', 'Wandadou', 'Sinéah', 'Faraya', 'Worokoro-Condéro', 'Soulkouldou',
          'Démbadou',
        ]),
        rurale('Damaro', 'GN-KAN-KER-DAM', 9.12911, -8.90117, [
          'Damaro-Centre', 'Balangbedou', 'Diaragherela', 'Diomandou', 'Foundou', 'Kouroudou', 'Mandou',
          'Monodala', 'Sanankoroni', 'Fressoudou', 'Kassiadou', 'Lanceidou', 'Sinimoridou',
        ]),
        rurale('Komodou', 'GN-KAN-KER-KOM', 9.63642, -9.05763, [
          'Komodou-Centre', 'Sanakoroni', 'Diassakouna', 'Kanfrandou', 'Gnalemoridou', 'Gbödou',
          'Franconedou Koro', 'Fabala', 'Frandou', 'Frafina',
        ]),
        rurale('Kounsankoro', 'GN-KAN-KER-KOU', 9.03454, -8.99658, [
          'Kounsankoro-Centre', 'Founoun-Kouroudou', 'Fereboridou', 'Gbotodou', 'Kekouradou', 'Gbofodou',
        ]),
        rurale('Linko', 'GN-KAN-KER-LIN', undefined, undefined, [
          'Linko', 'Talenko', 'Deyla', 'Diarragberela', 'Boïdou', 'Kissidou', 'Kognèny', 'Booko', 'Kourouko',
          'Woussoudou', 'Kessadjiaradou',
        ]),
        rurale('Sibiribaro', 'GN-KAN-KER-SIB', 8.98214, -9.21956, [
          'Sibiribaro', 'Gbèdou', 'Finariah', 'Kabaradou', 'Bouro', 'Diarradou-Mandou', 'Feredou',
        ]),
        rurale('Soromaya', 'GN-KAN-KER-SOR', undefined, undefined, [
          'Soromaya', 'Diallakoro', 'Dambaya', 'Doubaya', 'Balladou', 'Brindo', 'Fallanko Warou', 'Lero',
          'Gbendewaya', 'Koulia', 'Maka', 'Maka-Feredou', 'Menin-Celia', 'Soulkouldou',
        ]),
      ],
    },
    {
      nom: 'Kouroussa', code: 'GN-KAN-KOU', chefLieu: 'Kouroussa', lat: 10.65136, lng: -9.881,
      communes: [
        {
          nom: 'Kouroussa-Centre', code: 'GN-KAN-KOU-CU', type: 'urbaine', lat: 10.65136, lng: -9.881,
          quartiers: [
            'Diaragbéla I', 'Diaragbéla II', 'Doula', 'Komoniko', 'Kouroussa Koura', 'Saman', 'Samankouda',
            'Sando', 'Wassabada', 'Wassako',
          ],
        },
        rurale('Babila', 'GN-KAN-KOU-BAB', 10.65418, -9.68325, [
          'Babila I', 'Babila II', 'Sangbala', 'Sanankoro', 'Kato', 'Fissadou',
        ]),
        rurale('Balato', 'GN-KAN-KOU-BAL', 10.71531, -9.56602, [
          'Balato', 'Kobani', 'Kourala', 'Manfara',
        ]),
        rurale('Banfèlè', 'GN-KAN-KOU-BAN', 10.15541, -10.12661, [
          'Banfèlè-Centre', 'Borifingna', 'Kiniéko', 'Kouroufè Sidia', 'Marna', 'Nafadji', 'Sininkoro',
          'Wassaya',
        ]),
        rurale('Baro', 'GN-KAN-KOU-BAR', 10.60767, -9.70364, [
          'Baro I', 'Baro II', 'Baro III', 'Moikigneba', 'Morignoumala', 'Serekorony',
        ]),
        rurale('Cisséla', 'GN-KAN-KOU-CIS', 10.82531, -10.60923, [
          'Cisséla', 'Sotoya', 'Nono', 'Sömökoro', 'Lorombo',
        ]),
        rurale('Douako', 'GN-KAN-KOU-DOU', 9.73767, -10.17221, [
          'Douako', 'Yaraya', 'Kolombagbèya', 'Kouya-Woéla', 'Kouya Sidia', 'Kouya-Leya', 'Kouya-Silamana',
          'Gbossokoroya', 'Tindo', 'Faroro', 'Frandou', 'Missira', 'Tènèmamou Douya', 'Flowaro', 'Karako',
        ]),
        rurale('Doura', 'GN-KAN-KOU-DOR'),
        rurale('Kiniéro', 'GN-KAN-KOU-KIN', 10.39379, -9.75221, [
          'Kiniéro I', 'Kiniéro II', 'Kiniéro III', 'Bagbè', 'Ballan', 'Djirlan', 'Konson', 'Mansogna',
          'Missamana',
        ]),
        rurale('Komola-Koura', 'GN-KAN-KOU-KOM', 11.04396, -10.40075, [
          'Komola-Koura-Centre', 'Sambaya', 'Bantambaya', 'Hèrèmakono', 'Touréta-Foulah', 'Nonodjénia',
          'Konkéfin',
        ]),
        rurale('Koumana', 'GN-KAN-KOU-KMN', 10.68607, -9.66193, [
          'Koumana I', 'Koumana II', 'Fadou', 'Bofilani',
        ]),
        rurale('Sanguiana', 'GN-KAN-KOU-SAN', 10.79073, -10.18346, [
          'Sanguiana I', 'Sanguiana II', 'Koloman Kambaya', 'Moussaya', 'Bokodo', 'Sanacia', 'Senkounya',
          'Komoya',
        ]),
        rurale('Fadou-Saba', 'GN-KAN-KOU-FAD', 10.99748, -10.52846, [
          'Fadou-Saba', 'Kallela Traoré', 'Kakidi', 'Morimoussaya', 'Morigbèya-Saba', 'Bandankelen-Souarela',
          'Santiya',
        ]),
        rurale('Kanséréyah', 'GN-KAN-KOU-KSR', 9.94332, -10.26264, [
          'Kanséréya', 'Kanséréya-Doula', 'Nongowa', 'Djindo', 'Landy', 'Sonasidiya', 'Diarra',
        ]),
        rurale('Kouroukoro', 'GN-KAN-KOU-KRK', 10.92377, -10.74887, [
          'Kouroukoro', 'Kankaya', 'Niemen', 'Saramadia',
        ]),
      ],
    },
    {
      nom: 'Mandiana', code: 'GN-KAN-MAN', chefLieu: 'Mandiana', lat: 10.62211, lng: -8.69495,
      communes: [
        {
          nom: 'Mandiana-Centre', code: 'GN-KAN-MAN-CU', type: 'urbaine', lat: 10.62211, lng: -8.69495,
          quartiers: [
            'Château', 'Hérémakonon', 'Kissidoukoura', 'Mandiana I', 'Noumoussoulou', 'Oudiala', 'Zangbèla',
          ],
        },
        rurale('Balandougouba', 'GN-KAN-MAN-BAL', 11.3256, -8.4103, [
          'Balandougouba I', 'Balandougouba II', 'Bougou', 'Faragbèkoro', 'Kinienkoura I', 'Kinienkoura II',
          'Niani', 'Sidikila I', 'Sidikila II', 'Tabatefoua', 'Banantou', 'Wolola',
        ]),
        rurale('Faralako', 'GN-KAN-MAN-FAR', 10.66759, -8.69729, [
          'Faralako', 'Faralako II', 'Franceila', 'Dogolen', 'Sountoudiana', 'Diassa', 'Falama',
          'Djoulakolen', 'Kangbèla', 'Djalakoro', 'Banankoro', 'Diarakourou', 'Timbakouna', 'Gnamouna',
          'Nafadji', 'Mamadiana', 'Malikila', 'Marena',
        ]),
        rurale('Kantoumanina', 'GN-KAN-MAN-KAN', 10.47865, -8.65569, [
          'Kantoumanina', 'Trido', 'Moussadou', 'Sokouraba', 'Sakara', 'Orialén',
        ]),
        rurale('Kiniéran', 'GN-KAN-MAN-KIN', 11.0827, -8.82516, [
          'Namissa I', 'Namissa II', 'Sinkany', 'M\'Balia I', 'M\'Balia II', 'Banankoro', 'Sokouraba',
          'Oudoumankoro', 'Kodjamba', 'Kodjamba Marché', 'Karakani', 'Kodjaraninda', 'Kodjaraninda II',
          'Morimoussa Bougou', 'Filanidialakoro', 'Kinièrankoura', 'Magana',
        ]),
        rurale('Kondianakoro', 'GN-KAN-MAN-KON', undefined, undefined, [
          'Kondianakoro', 'Kondianakoro I', 'Kondianakoro II', 'Kondianakoro Koko', 'Kondianakoro Madina',
          'Kondianakoura', 'Kama', 'Gbenso', 'Tabaninkoro', 'Bankoumana', 'Bankoumana I', 'Bankoumana II',
          'Bankoumana Faraniko', 'Bankoumana Selo', 'Foloninko', 'Balandou', 'Dounoukolo', 'Dalakolon',
          'Kignèroba', 'Kolomogo', 'Djilengbè I', 'Djilengbè II', 'Faragbèkoura',
        ]),
        rurale('Koundian', 'GN-KAN-MAN-KOU', 10.92037, -8.90795, [
          'Koundian I', 'Koundian II', 'Kanifra', 'Loila Koro', 'Faranindoun', 'Sananfra Sakogna',
          'Boumaninda', 'Faramadia', 'Tadibakourou', 'Saïmana', 'Gbilin', 'Fouadjou',
        ]),
        rurale('Morodou', 'GN-KAN-MAN-MOR', 10.83781, -8.66685, [
          'Morodou I', 'Morodou II', 'Fadou', 'Farabakoura', 'Wosso', 'Manfèlè', 'Balandou', 'Dalakan',
          'Kignénin', 'Limbana', 'Kaniko', 'Massakoda', 'Farala', 'Nafadjilen', 'Finabako-Kossan',
          'Kanagala', 'Samakofara', 'Sackodou-Sinko', 'Missima', 'Missima II-Centre',
        ]),
        rurale('Niantanina', 'GN-KAN-MAN-NIA', 10.95962, -8.33221, [
          'Niantanina I', 'Niantanina II', 'Djélimala', 'Dandèla', 'Tonkolomba', 'Madina', 'Soron',
          'Faradjan', 'Dènso', 'Odiaminina', 'Gbonko', 'Bagaféa', 'Wassa',
        ]),
        rurale('Saladou', 'GN-KAN-MAN-SAL', 10.27672, -8.32722, [
          'Saladou', 'Bougoula', 'Sogbè', 'Famandou', 'Maletoumanina', 'Somokolèn', 'Meleila', 'Nianko',
          'Timbafara', 'Yalaouléna', 'Sédakoudoun', 'Noumoudjila', 'Wahiry', 'Lènsoron', 'Ourola', 'Séguéla',
          'Tindila', 'Sanankoro',
        ]),
        rurale('Sansando', 'GN-KAN-MAN-SAN', 11.07427, -9.19191, [
          'M\'Balia', 'M\'Balia II', 'Sogbè', 'Sogbè II', 'Gbilimba', 'Karakoura', 'Karakoura II', 'Kansan',
          'Kansan II', 'Kiko Karakoro', 'Konomakoro', 'Konomakoro II', 'Faradjan', 'Tando', 'Niamina',
          'Niamina II', 'Sounkoulou', 'Madina',
        ]),
        rurale('Kodiaran', 'GN-KAN-MAN-KOD', 10.55631, -8.88834, [
          'Kodiaran', 'Kouroungboula', 'Koromadou', 'Komana',
        ]),
      ],
    },
    {
      /* Préfecture depuis le décret du 20 août 2026 (ancienne sous-préfecture de Mandiana) : en attendant l'arrêté qui fixe sa
         composition, elle contient la seule commune de son chef-lieu. */
      nom: 'Dialakoro', code: 'GN-KAN-DIA', chefLieu: 'Dialakoro', lat: 11.44087, lng: -8.88437, anciennement: 'Mandiana',
      communes: [
        rurale('Dialakoro', 'GN-KAN-DIA-DIA', 11.44087, -8.88437, [
          'Alpha-Yaya', 'Alpha Yaya-Centre II', 'Nèdèkoroko', 'Bakou', 'Bankou II-Centre', 'Silabada',
          'Balandou I', 'Balandou II', 'Balandou III', 'Balandou IV', 'Konignako', 'Bidassangban', 'Rounda',
          'Kabangbè', 'Bananfra', 'Bananfra II', 'Diaradou', 'Magali Faraba', 'Magal Faraba',
          'Magal Faraba Djin', 'Pombada', 'Farassababen', 'Kamerena', 'Konkoye', 'Konkoye II', 'Koudy',
          'Samory', 'Samory II', 'Siramana', 'Kolenko',
        ]),
      ],
    },
  ],
};

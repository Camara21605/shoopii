/* ============================================================
 * FICHIER : src/shared/location/data/geo-guinee.ts
 *
 * RÔLE : Données géographiques de la Guinée (GN).
 *        Structure : Région → Préfecture/Ville → Quartiers/Communes
 * ============================================================ */

export interface QuartierGN {
  nom: string;
  commune?: string;  // commune parente (pour Conakry)
}

export interface VilleGN {
  nom:       string;
  slug:      string;   // version sans accents pour recherche
  region:    string;
  lat:       number;   // coordonnées approximatives du centre-ville
  lng:       number;
  communes:  CommuneGN[];
}

export interface CommuneGN {
  nom:      string;
  quartiers: string[];
}

/* ── Données complètes ──────────────────────────────────── */

export const VILLES_GUINEE: VilleGN[] = [

  /* ══════════════════════════════════════════════════════
   * CONAKRY — Capitale (5 communes administratives)
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Conakry', slug: 'conakry', region: 'Conakry', lat: 9.5370, lng: -13.6773,
    communes: [
      {
        nom: 'Kaloum',
        quartiers: [
          'Almamya', 'Boulbinet', 'Coronthie', 'Kaloum Centre',
          'Sandervalia', 'Tombo', 'Kassa', 'Roume',
        ],
      },
      {
        nom: 'Dixinn',
        quartiers: [
          'Bambeto', 'Belle Vue', 'Camayenne', 'Carrière',
          'Cité des Nations', 'Dixinn Centre', 'Donka', 'Kipé',
          'Landreah', 'Madina', 'Minière', 'Nongo',
        ],
      },
      {
        nom: 'Ratoma',
        quartiers: [
          'Bambeto', 'Cosa', 'Dar-Es-Salam', 'Enco-5',
          'Hamdalaye', 'Koloma', 'Lambandji', 'Lansanaya',
          'Nongo', 'Ratoma Centre', 'Simbaya', 'Taouyah',
          'Wanindara', 'Yattaya',
        ],
      },
      {
        nom: 'Matam',
        quartiers: [
          'Bonfi', 'Coléah', 'Hafia', 'Kagbélen',
          'Kobaya', 'Landréah', 'Matam Centre', 'Matoto',
          'Enta', 'Koloma',
        ],
      },
      {
        nom: 'Matoto',
        quartiers: [
          'Coleah', 'Dabompa', 'Gbessia', 'Kagbélen',
          'Kissosso', 'Kobaya', 'Kouria', 'Kuntaya',
          'Matoto Centre', 'Sonfonia', 'Tombolia',
        ],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * KINDIA — Région de Kindia
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Kindia', slug: 'kindia', region: 'Kindia', lat: 10.0544, lng: -12.8559,
    communes: [
      {
        nom: 'Kindia Centre',
        quartiers: [
          'Baralandé', 'Centre Commercial', 'Dontémadou', 'Kouria',
          'Madina', 'Mambia', 'Pasteur', 'Timbo', 'Tondon',
        ],
      },
      {
        nom: 'Sonfonia',
        quartiers: ['Bangouya', 'Sonfonia', 'Tangaly', 'Yendé'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * LABÉ — Région de Labé (Fouta Djallon)
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Labé', slug: 'labe', region: 'Labé', lat: 11.3167, lng: -12.2833,
    communes: [
      {
        nom: 'Labé Centre',
        quartiers: [
          'Baldé-Saré', 'Dondé', 'Dongol-Touma', 'Foulayah',
          'Hafia', 'Koba', 'Labé Ville', 'Misside',
          'Popodara', 'Saré-Koly', 'Tata',
        ],
      },
      {
        nom: 'Kaalan',
        quartiers: ['Kaalan', 'Sangalan', 'Timbì'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * MAMOU — Région de Mamou
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Mamou', slug: 'mamou', region: 'Mamou', lat: 10.3833, lng: -12.0833,
    communes: [
      {
        nom: 'Mamou Centre',
        quartiers: [
          'Bafodé', 'Bantountou', 'Centre Ville', 'Dounfing',
          'Fotoba', 'Gongoré', 'Konkouré', 'Madina',
          'Missidé', 'Santiguia', 'Sénégal', 'Sogué',
        ],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * BOKÉ — Région de Boké
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Boké', slug: 'boke', region: 'Boké', lat: 10.9333, lng: -14.2833,
    communes: [
      {
        nom: 'Boké Centre',
        quartiers: [
          'Centre Ville', 'Dabiss', 'Katougouma', 'Madina',
          'Sangaréah', 'Tougnifily',
        ],
      },
      {
        nom: 'Kamsar',
        quartiers: ['Bhamo', 'Kamsar Port', 'Kébaly', 'Sangareah'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * KANKAN — Région de Kankan (Haute Guinée)
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Kankan', slug: 'kankan', region: 'Kankan', lat: 10.3878, lng: -9.2953,
    communes: [
      {
        nom: 'Kankan Centre',
        quartiers: [
          'Bato', 'Cabinda', 'Centre Commercial', 'Faralako',
          'Gberedou', 'Kouroumandou', 'Missamana', 'Moribayah',
          'Nabountou', 'Tokounou', 'Touroundou',
        ],
      },
      {
        nom: 'Kankan Ville',
        quartiers: ['Kouroumandou', 'Missamana', 'Samaniana', 'Tokounou'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * FARANAH — Région de Faranah
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Faranah', slug: 'faranah', region: 'Faranah', lat: 10.0353, lng: -10.7422,
    communes: [
      {
        nom: 'Faranah Centre',
        quartiers: [
          'Centre Ville', 'Dokouma', 'Fandiala', 'Gbérédou',
          'Madina', 'Morifindiah', 'Tindo',
        ],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * N'ZÉRÉKORÉ — Région de N'Zérékoré (Guinée Forestière)
   * ════════════════════════════════════════════════════ */
  {
    nom: "N'Zérékoré", slug: 'nzerekore', region: "N'Zérékoré", lat: 7.7558, lng: -8.8179,
    communes: [
      {
        nom: "N'Zérékoré Centre",
        quartiers: [
          'Centre Ville', 'Gbèlègué', 'Gou', 'Hamdallaye',
          'Konia', 'Madina', 'Missirikoro', 'Samaou',
        ],
      },
      {
        nom: 'Lola',
        quartiers: ['Bossou', 'Centre Lola', 'Nzo'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * KISSIDOUGOU — Région de Faranah
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Kissidougou', slug: 'kissidougou', region: 'Faranah', lat: 9.1886, lng: -10.1013,
    communes: [
      {
        nom: 'Kissidougou Centre',
        quartiers: [
          'Centre Ville', 'Diwolé', 'Gbangbadou', 'Kondiadou',
          'Madina', 'Télico',
        ],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * GUÉCKÉDOU — Région de N'Zérékoré
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Guéckédou', slug: 'gueckedou', region: "N'Zérékoré", lat: 8.5586, lng: -10.1328,
    communes: [
      {
        nom: 'Guéckédou Centre',
        quartiers: ['Centre Ville', 'Koundou', 'Lainé', 'Nialama', 'Tékoulo'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * MACENTA — Région de N'Zérékoré
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Macenta', slug: 'macenta', region: "N'Zérékoré", lat: 8.4667, lng: -9.4833,
    communes: [
      {
        nom: 'Macenta Centre',
        quartiers: ['Centre Ville', 'Daro', 'Madina', 'Sérédou', 'Vassérédou'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * SIGUIRI — Région de Kankan
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Siguiri', slug: 'siguiri', region: 'Kankan', lat: 11.4133, lng: -9.1667,
    communes: [
      {
        nom: 'Siguiri Centre',
        quartiers: ['Centre Ville', 'Doko', 'Kintinian', 'Norassoba', 'Sinikoro'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * TÉLIMÉLÉ — Région de Kindia
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Télimélé', slug: 'telimele', region: 'Kindia', lat: 10.9000, lng: -13.0333,
    communes: [
      {
        nom: 'Télimélé Centre',
        quartiers: ['Centre Ville', 'Kollet', 'Mafara', 'Santou'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * PITA — Région de Labé
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Pita', slug: 'pita', region: 'Labé', lat: 11.0667, lng: -12.3833,
    communes: [
      {
        nom: 'Pita Centre',
        quartiers: ['Centre Ville', 'Konkouré', 'Mitty', 'Sankarela', 'Timbi-Madina'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * DALABA — Région de Mamou
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Dalaba', slug: 'dalaba', region: 'Mamou', lat: 10.6874, lng: -12.2498,
    communes: [
      {
        nom: 'Dalaba Centre',
        quartiers: ['Centre Ville', 'Darafé', 'Dialakoro', 'Doumbaya'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * COYAH — Région de Conakry (périphérie)
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Coyah', slug: 'coyah', region: 'Kindia', lat: 9.7003, lng: -13.3842,
    communes: [
      {
        nom: 'Coyah Centre',
        quartiers: ['Centre Ville', 'Dubréka', 'Kouriah', 'Manéah', 'Wonkifong'],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════
   * FRIA — Région de Boké
   * ════════════════════════════════════════════════════ */
  {
    nom: 'Fria', slug: 'fria', region: 'Boké', lat: 10.3698, lng: -13.5527,
    communes: [
      {
        nom: 'Fria Centre',
        quartiers: ['Cité Industrielle', 'Dongol', 'Fria Centre', 'Kaloum', 'Songhoya'],
      },
    ],
  },
];

/* ── Helpers ──────────────────────────────────────────── */

/** Toutes les villes triées par nom */
export const VILLES_SORTED = [...VILLES_GUINEE].sort((a, b) =>
  a.nom.localeCompare(b.nom, 'fr'),
);

/** Trouver une ville par son nom */
export function findVille(nom: string): VilleGN | undefined {
  return VILLES_GUINEE.find(v => v.nom === nom);
}

/** Toutes les communes d'une ville */
export function getCommunesByVille(ville: string): CommuneGN[] {
  return findVille(ville)?.communes ?? [];
}

/** Tous les quartiers d'une commune dans une ville */
export function getQuartiersByCommune(ville: string, commune: string): string[] {
  return getCommunesByVille(ville).find(c => c.nom === commune)?.quartiers ?? [];
}

/** Tous les quartiers d'une ville (toutes communes confondues) */
export function getAllQuartiersByVille(ville: string): string[] {
  const communes = getCommunesByVille(ville);
  return communes.flatMap(c => c.quartiers);
}

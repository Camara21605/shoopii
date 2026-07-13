/* ================================================================
 * FICHIER : sections/geo/countries.data.ts
 *
 * Base de données mondiale des pays.
 * Données : nom français, code ISO 2 & 3, indicatif téléphonique,
 * devise ISO 4217, drapeau emoji.
 *
 * Utilisé par GeoModal pour l'auto-complétion du formulaire "Pays".
 * ================================================================ */

export interface WorldCountry {
  nom:       string;   // Nom en français
  nomEn:     string;   // Nom en anglais (pour la recherche)
  iso2:      string;   // Code ISO 3166-1 alpha-2  (ex: GN)
  iso3:      string;   // Code ISO 3166-1 alpha-3  (ex: GIN)
  indicatif: string;   // Indicatif téléphonique    (ex: +224)
  devise:    string;   // Code devise ISO 4217      (ex: GNF)
  drapeau:   string;   // Emoji drapeau             (ex: 🇬🇳)
}

/* ================================================================
 *  AFRIQUE — 54 pays
 * ================================================================ */
export const WORLD_COUNTRIES: WorldCountry[] = [
  /* ── Afrique de l'Ouest (CEDEAO) ── */
  { nom: 'Guinée',               nomEn: 'Guinea',               iso2: 'GN', iso3: 'GIN', indicatif: '+224', devise: 'GNF', drapeau: '🇬🇳' },
  { nom: 'Sénégal',              nomEn: 'Senegal',              iso2: 'SN', iso3: 'SEN', indicatif: '+221', devise: 'XOF', drapeau: '🇸🇳' },
  { nom: 'Côte d\'Ivoire',       nomEn: 'Ivory Coast',          iso2: 'CI', iso3: 'CIV', indicatif: '+225', devise: 'XOF', drapeau: '🇨🇮' },
  { nom: 'Mali',                 nomEn: 'Mali',                 iso2: 'ML', iso3: 'MLI', indicatif: '+223', devise: 'XOF', drapeau: '🇲🇱' },
  { nom: 'Burkina Faso',         nomEn: 'Burkina Faso',         iso2: 'BF', iso3: 'BFA', indicatif: '+226', devise: 'XOF', drapeau: '🇧🇫' },
  { nom: 'Niger',                nomEn: 'Niger',                iso2: 'NE', iso3: 'NER', indicatif: '+227', devise: 'XOF', drapeau: '🇳🇪' },
  { nom: 'Bénin',                nomEn: 'Benin',                iso2: 'BJ', iso3: 'BEN', indicatif: '+229', devise: 'XOF', drapeau: '🇧🇯' },
  { nom: 'Togo',                 nomEn: 'Togo',                 iso2: 'TG', iso3: 'TGO', indicatif: '+228', devise: 'XOF', drapeau: '🇹🇬' },
  { nom: 'Ghana',                nomEn: 'Ghana',                iso2: 'GH', iso3: 'GHA', indicatif: '+233', devise: 'GHS', drapeau: '🇬🇭' },
  { nom: 'Nigéria',              nomEn: 'Nigeria',              iso2: 'NG', iso3: 'NGA', indicatif: '+234', devise: 'NGN', drapeau: '🇳🇬' },
  { nom: 'Sierra Leone',         nomEn: 'Sierra Leone',         iso2: 'SL', iso3: 'SLE', indicatif: '+232', devise: 'SLL', drapeau: '🇸🇱' },
  { nom: 'Libéria',              nomEn: 'Liberia',              iso2: 'LR', iso3: 'LBR', indicatif: '+231', devise: 'LRD', drapeau: '🇱🇷' },
  { nom: 'Guinée-Bissau',        nomEn: 'Guinea-Bissau',        iso2: 'GW', iso3: 'GNB', indicatif: '+245', devise: 'XOF', drapeau: '🇬🇼' },
  { nom: 'Gambie',               nomEn: 'Gambia',               iso2: 'GM', iso3: 'GMB', indicatif: '+220', devise: 'GMD', drapeau: '🇬🇲' },
  { nom: 'Cap-Vert',             nomEn: 'Cape Verde',           iso2: 'CV', iso3: 'CPV', indicatif: '+238', devise: 'CVE', drapeau: '🇨🇻' },
  { nom: 'Mauritanie',           nomEn: 'Mauritania',           iso2: 'MR', iso3: 'MRT', indicatif: '+222', devise: 'MRU', drapeau: '🇲🇷' },

  /* ── Afrique Centrale ── */
  { nom: 'Cameroun',             nomEn: 'Cameroon',             iso2: 'CM', iso3: 'CMR', indicatif: '+237', devise: 'XAF', drapeau: '🇨🇲' },
  { nom: 'Congo',                nomEn: 'Republic of Congo',    iso2: 'CG', iso3: 'COG', indicatif: '+242', devise: 'XAF', drapeau: '🇨🇬' },
  { nom: 'Congo (RDC)',          nomEn: 'DR Congo',             iso2: 'CD', iso3: 'COD', indicatif: '+243', devise: 'CDF', drapeau: '🇨🇩' },
  { nom: 'Gabon',                nomEn: 'Gabon',                iso2: 'GA', iso3: 'GAB', indicatif: '+241', devise: 'XAF', drapeau: '🇬🇦' },
  { nom: 'Centrafrique',         nomEn: 'Central African Rep.', iso2: 'CF', iso3: 'CAF', indicatif: '+236', devise: 'XAF', drapeau: '🇨🇫' },
  { nom: 'Tchad',                nomEn: 'Chad',                 iso2: 'TD', iso3: 'TCD', indicatif: '+235', devise: 'XAF', drapeau: '🇹🇩' },
  { nom: 'Guinée équatoriale',   nomEn: 'Equatorial Guinea',    iso2: 'GQ', iso3: 'GNQ', indicatif: '+240', devise: 'XAF', drapeau: '🇬🇶' },
  { nom: 'São Tomé-et-Príncipe', nomEn: 'Sao Tome and Principe',iso2: 'ST', iso3: 'STP', indicatif: '+239', devise: 'STN', drapeau: '🇸🇹' },
  { nom: 'Burundi',              nomEn: 'Burundi',              iso2: 'BI', iso3: 'BDI', indicatif: '+257', devise: 'BIF', drapeau: '🇧🇮' },
  { nom: 'Rwanda',               nomEn: 'Rwanda',               iso2: 'RW', iso3: 'RWA', indicatif: '+250', devise: 'RWF', drapeau: '🇷🇼' },

  /* ── Afrique de l'Est ── */
  { nom: 'Kenya',                nomEn: 'Kenya',                iso2: 'KE', iso3: 'KEN', indicatif: '+254', devise: 'KES', drapeau: '🇰🇪' },
  { nom: 'Tanzanie',             nomEn: 'Tanzania',             iso2: 'TZ', iso3: 'TZA', indicatif: '+255', devise: 'TZS', drapeau: '🇹🇿' },
  { nom: 'Ouganda',              nomEn: 'Uganda',               iso2: 'UG', iso3: 'UGA', indicatif: '+256', devise: 'UGX', drapeau: '🇺🇬' },
  { nom: 'Éthiopie',             nomEn: 'Ethiopia',             iso2: 'ET', iso3: 'ETH', indicatif: '+251', devise: 'ETB', drapeau: '🇪🇹' },
  { nom: 'Somalie',              nomEn: 'Somalia',              iso2: 'SO', iso3: 'SOM', indicatif: '+252', devise: 'SOS', drapeau: '🇸🇴' },
  { nom: 'Djibouti',             nomEn: 'Djibouti',             iso2: 'DJ', iso3: 'DJI', indicatif: '+253', devise: 'DJF', drapeau: '🇩🇯' },
  { nom: 'Érythrée',             nomEn: 'Eritrea',              iso2: 'ER', iso3: 'ERI', indicatif: '+291', devise: 'ERN', drapeau: '🇪🇷' },
  { nom: 'Madagascar',           nomEn: 'Madagascar',           iso2: 'MG', iso3: 'MDG', indicatif: '+261', devise: 'MGA', drapeau: '🇲🇬' },
  { nom: 'Comores',              nomEn: 'Comoros',              iso2: 'KM', iso3: 'COM', indicatif: '+269', devise: 'KMF', drapeau: '🇰🇲' },
  { nom: 'Seychelles',           nomEn: 'Seychelles',           iso2: 'SC', iso3: 'SYC', indicatif: '+248', devise: 'SCR', drapeau: '🇸🇨' },
  { nom: 'Maurice',              nomEn: 'Mauritius',            iso2: 'MU', iso3: 'MUS', indicatif: '+230', devise: 'MUR', drapeau: '🇲🇺' },
  { nom: 'Soudan',               nomEn: 'Sudan',                iso2: 'SD', iso3: 'SDN', indicatif: '+249', devise: 'SDG', drapeau: '🇸🇩' },
  { nom: 'Soudan du Sud',        nomEn: 'South Sudan',          iso2: 'SS', iso3: 'SSD', indicatif: '+211', devise: 'SSP', drapeau: '🇸🇸' },

  /* ── Afrique du Nord ── */
  { nom: 'Égypte',               nomEn: 'Egypt',                iso2: 'EG', iso3: 'EGY', indicatif: '+20',  devise: 'EGP', drapeau: '🇪🇬' },
  { nom: 'Maroc',                nomEn: 'Morocco',              iso2: 'MA', iso3: 'MAR', indicatif: '+212', devise: 'MAD', drapeau: '🇲🇦' },
  { nom: 'Algérie',              nomEn: 'Algeria',              iso2: 'DZ', iso3: 'DZA', indicatif: '+213', devise: 'DZD', drapeau: '🇩🇿' },
  { nom: 'Tunisie',              nomEn: 'Tunisia',              iso2: 'TN', iso3: 'TUN', indicatif: '+216', devise: 'TND', drapeau: '🇹🇳' },
  { nom: 'Libye',                nomEn: 'Libya',                iso2: 'LY', iso3: 'LBY', indicatif: '+218', devise: 'LYD', drapeau: '🇱🇾' },

  /* ── Afrique Australe ── */
  { nom: 'Afrique du Sud',       nomEn: 'South Africa',         iso2: 'ZA', iso3: 'ZAF', indicatif: '+27',  devise: 'ZAR', drapeau: '🇿🇦' },
  { nom: 'Angola',               nomEn: 'Angola',               iso2: 'AO', iso3: 'AGO', indicatif: '+244', devise: 'AOA', drapeau: '🇦🇴' },
  { nom: 'Mozambique',           nomEn: 'Mozambique',           iso2: 'MZ', iso3: 'MOZ', indicatif: '+258', devise: 'MZN', drapeau: '🇲🇿' },
  { nom: 'Zimbabwe',             nomEn: 'Zimbabwe',             iso2: 'ZW', iso3: 'ZWE', indicatif: '+263', devise: 'ZWL', drapeau: '🇿🇼' },
  { nom: 'Zambie',               nomEn: 'Zambia',               iso2: 'ZM', iso3: 'ZMB', indicatif: '+260', devise: 'ZMW', drapeau: '🇿🇲' },
  { nom: 'Malawi',               nomEn: 'Malawi',               iso2: 'MW', iso3: 'MWI', indicatif: '+265', devise: 'MWK', drapeau: '🇲🇼' },
  { nom: 'Namibie',              nomEn: 'Namibia',              iso2: 'NA', iso3: 'NAM', indicatif: '+264', devise: 'NAD', drapeau: '🇳🇦' },
  { nom: 'Botswana',             nomEn: 'Botswana',             iso2: 'BW', iso3: 'BWA', indicatif: '+267', devise: 'BWP', drapeau: '🇧🇼' },
  { nom: 'Lesotho',              nomEn: 'Lesotho',              iso2: 'LS', iso3: 'LSO', indicatif: '+266', devise: 'LSL', drapeau: '🇱🇸' },
  { nom: 'Eswatini',             nomEn: 'Eswatini',             iso2: 'SZ', iso3: 'SWZ', indicatif: '+268', devise: 'SZL', drapeau: '🇸🇿' },

  /* ================================================================
   *  EUROPE
   * ================================================================ */
  { nom: 'France',               nomEn: 'France',               iso2: 'FR', iso3: 'FRA', indicatif: '+33',  devise: 'EUR', drapeau: '🇫🇷' },
  { nom: 'Allemagne',            nomEn: 'Germany',              iso2: 'DE', iso3: 'DEU', indicatif: '+49',  devise: 'EUR', drapeau: '🇩🇪' },
  { nom: 'Espagne',              nomEn: 'Spain',                iso2: 'ES', iso3: 'ESP', indicatif: '+34',  devise: 'EUR', drapeau: '🇪🇸' },
  { nom: 'Italie',               nomEn: 'Italy',                iso2: 'IT', iso3: 'ITA', indicatif: '+39',  devise: 'EUR', drapeau: '🇮🇹' },
  { nom: 'Royaume-Uni',          nomEn: 'United Kingdom',       iso2: 'GB', iso3: 'GBR', indicatif: '+44',  devise: 'GBP', drapeau: '🇬🇧' },
  { nom: 'Portugal',             nomEn: 'Portugal',             iso2: 'PT', iso3: 'PRT', indicatif: '+351', devise: 'EUR', drapeau: '🇵🇹' },
  { nom: 'Belgique',             nomEn: 'Belgium',              iso2: 'BE', iso3: 'BEL', indicatif: '+32',  devise: 'EUR', drapeau: '🇧🇪' },
  { nom: 'Pays-Bas',             nomEn: 'Netherlands',          iso2: 'NL', iso3: 'NLD', indicatif: '+31',  devise: 'EUR', drapeau: '🇳🇱' },
  { nom: 'Suisse',               nomEn: 'Switzerland',          iso2: 'CH', iso3: 'CHE', indicatif: '+41',  devise: 'CHF', drapeau: '🇨🇭' },
  { nom: 'Suède',                nomEn: 'Sweden',               iso2: 'SE', iso3: 'SWE', indicatif: '+46',  devise: 'SEK', drapeau: '🇸🇪' },
  { nom: 'Norvège',              nomEn: 'Norway',               iso2: 'NO', iso3: 'NOR', indicatif: '+47',  devise: 'NOK', drapeau: '🇳🇴' },
  { nom: 'Danemark',             nomEn: 'Denmark',              iso2: 'DK', iso3: 'DNK', indicatif: '+45',  devise: 'DKK', drapeau: '🇩🇰' },
  { nom: 'Finlande',             nomEn: 'Finland',              iso2: 'FI', iso3: 'FIN', indicatif: '+358', devise: 'EUR', drapeau: '🇫🇮' },
  { nom: 'Pologne',              nomEn: 'Poland',               iso2: 'PL', iso3: 'POL', indicatif: '+48',  devise: 'PLN', drapeau: '🇵🇱' },
  { nom: 'Russie',               nomEn: 'Russia',               iso2: 'RU', iso3: 'RUS', indicatif: '+7',   devise: 'RUB', drapeau: '🇷🇺' },
  { nom: 'Ukraine',              nomEn: 'Ukraine',              iso2: 'UA', iso3: 'UKR', indicatif: '+380', devise: 'UAH', drapeau: '🇺🇦' },
  { nom: 'Turquie',              nomEn: 'Turkey',               iso2: 'TR', iso3: 'TUR', indicatif: '+90',  devise: 'TRY', drapeau: '🇹🇷' },
  { nom: 'Grèce',                nomEn: 'Greece',               iso2: 'GR', iso3: 'GRC', indicatif: '+30',  devise: 'EUR', drapeau: '🇬🇷' },
  { nom: 'Roumanie',             nomEn: 'Romania',              iso2: 'RO', iso3: 'ROU', indicatif: '+40',  devise: 'RON', drapeau: '🇷🇴' },

  /* ================================================================
   *  AMÉRIQUES
   * ================================================================ */
  { nom: 'États-Unis',           nomEn: 'United States',        iso2: 'US', iso3: 'USA', indicatif: '+1',   devise: 'USD', drapeau: '🇺🇸' },
  { nom: 'Canada',               nomEn: 'Canada',               iso2: 'CA', iso3: 'CAN', indicatif: '+1',   devise: 'CAD', drapeau: '🇨🇦' },
  { nom: 'Brésil',               nomEn: 'Brazil',               iso2: 'BR', iso3: 'BRA', indicatif: '+55',  devise: 'BRL', drapeau: '🇧🇷' },
  { nom: 'Mexique',              nomEn: 'Mexico',               iso2: 'MX', iso3: 'MEX', indicatif: '+52',  devise: 'MXN', drapeau: '🇲🇽' },
  { nom: 'Argentine',            nomEn: 'Argentina',            iso2: 'AR', iso3: 'ARG', indicatif: '+54',  devise: 'ARS', drapeau: '🇦🇷' },
  { nom: 'Colombie',             nomEn: 'Colombia',             iso2: 'CO', iso3: 'COL', indicatif: '+57',  devise: 'COP', drapeau: '🇨🇴' },
  { nom: 'Chili',                nomEn: 'Chile',                iso2: 'CL', iso3: 'CHL', indicatif: '+56',  devise: 'CLP', drapeau: '🇨🇱' },
  { nom: 'Pérou',                nomEn: 'Peru',                 iso2: 'PE', iso3: 'PER', indicatif: '+51',  devise: 'PEN', drapeau: '🇵🇪' },
  { nom: 'Haïti',                nomEn: 'Haiti',                iso2: 'HT', iso3: 'HTI', indicatif: '+509', devise: 'HTG', drapeau: '🇭🇹' },
  { nom: 'Cuba',                 nomEn: 'Cuba',                 iso2: 'CU', iso3: 'CUB', indicatif: '+53',  devise: 'CUP', drapeau: '🇨🇺' },

  /* ================================================================
   *  ASIE & MOYEN-ORIENT
   * ================================================================ */
  { nom: 'Chine',                nomEn: 'China',                iso2: 'CN', iso3: 'CHN', indicatif: '+86',  devise: 'CNY', drapeau: '🇨🇳' },
  { nom: 'Inde',                 nomEn: 'India',                iso2: 'IN', iso3: 'IND', indicatif: '+91',  devise: 'INR', drapeau: '🇮🇳' },
  { nom: 'Japon',                nomEn: 'Japan',                iso2: 'JP', iso3: 'JPN', indicatif: '+81',  devise: 'JPY', drapeau: '🇯🇵' },
  { nom: 'Corée du Sud',         nomEn: 'South Korea',          iso2: 'KR', iso3: 'KOR', indicatif: '+82',  devise: 'KRW', drapeau: '🇰🇷' },
  { nom: 'Arabie saoudite',      nomEn: 'Saudi Arabia',         iso2: 'SA', iso3: 'SAU', indicatif: '+966', devise: 'SAR', drapeau: '🇸🇦' },
  { nom: 'Émirats arabes unis',  nomEn: 'UAE',                  iso2: 'AE', iso3: 'ARE', indicatif: '+971', devise: 'AED', drapeau: '🇦🇪' },
  { nom: 'Pakistan',             nomEn: 'Pakistan',             iso2: 'PK', iso3: 'PAK', indicatif: '+92',  devise: 'PKR', drapeau: '🇵🇰' },
  { nom: 'Bangladesh',           nomEn: 'Bangladesh',           iso2: 'BD', iso3: 'BGD', indicatif: '+880', devise: 'BDT', drapeau: '🇧🇩' },
  { nom: 'Indonésie',            nomEn: 'Indonesia',            iso2: 'ID', iso3: 'IDN', indicatif: '+62',  devise: 'IDR', drapeau: '🇮🇩' },
  { nom: 'Malaisie',             nomEn: 'Malaysia',             iso2: 'MY', iso3: 'MYS', indicatif: '+60',  devise: 'MYR', drapeau: '🇲🇾' },
  { nom: 'Singapour',            nomEn: 'Singapore',            iso2: 'SG', iso3: 'SGP', indicatif: '+65',  devise: 'SGD', drapeau: '🇸🇬' },
  { nom: 'Vietnam',              nomEn: 'Vietnam',              iso2: 'VN', iso3: 'VNM', indicatif: '+84',  devise: 'VND', drapeau: '🇻🇳' },
  { nom: 'Thaïlande',            nomEn: 'Thailand',             iso2: 'TH', iso3: 'THA', indicatif: '+66',  devise: 'THB', drapeau: '🇹🇭' },
  { nom: 'Liban',                nomEn: 'Lebanon',              iso2: 'LB', iso3: 'LBN', indicatif: '+961', devise: 'LBP', drapeau: '🇱🇧' },
  { nom: 'Iran',                 nomEn: 'Iran',                 iso2: 'IR', iso3: 'IRN', indicatif: '+98',  devise: 'IRR', drapeau: '🇮🇷' },
  { nom: 'Irak',                 nomEn: 'Iraq',                 iso2: 'IQ', iso3: 'IRQ', indicatif: '+964', devise: 'IQD', drapeau: '🇮🇶' },

  /* ================================================================
   *  OCÉANIE
   * ================================================================ */
  { nom: 'Australie',            nomEn: 'Australia',            iso2: 'AU', iso3: 'AUS', indicatif: '+61',  devise: 'AUD', drapeau: '🇦🇺' },
  { nom: 'Nouvelle-Zélande',     nomEn: 'New Zealand',          iso2: 'NZ', iso3: 'NZL', indicatif: '+64',  devise: 'NZD', drapeau: '🇳🇿' },
];

/* Déduplique par iso2 (au cas où) */
const seen = new Set<string>();
const UNIQUE_COUNTRIES = WORLD_COUNTRIES.filter(c => {
  if (seen.has(c.iso2)) return false;
  seen.add(c.iso2);
  return true;
});

export { UNIQUE_COUNTRIES as COUNTRIES_DB };

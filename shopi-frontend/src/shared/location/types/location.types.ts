/* ============================================================
 * FICHIER : src/shared/location/types/location.types.ts
 * RÔLE    : Types TypeScript partagés dans tout le module location
 * ============================================================ */

/** Coordonnées GPS */
export interface Coordinates {
  latitude:  number;
  longitude: number;
}

/** Adresse structurée (retourné par Nominatim ou l'API backend) */
export interface Address {
  adresse?:    string;
  quartier?:   string;
  commune?:    string;
  ville?:      string;
  region?:     string;
  prefecture?: string;
  pays?:       string;
  codePostal?: string;
  latitude?:   number;
  longitude?:  number;
  displayName?: string;   // chaîne complète retournée par Nominatim
}

/** Adresse client complète (entité Localisation côté backend) */
export interface ClientAddress {
  id:           string;
  typeAdresse:  TypeAdresse;
  libelle?:     string | null;
  rue?:         string | null;
  quartier?:    string | null;
  commune?:     string | null;
  ville:        string;
  prefecture?:  string | null;
  region?:      string | null;
  pays:         string;
  codePostal?:  string | null;
  latitude?:    number | null;
  longitude?:   number | null;
  instructions?: string | null;
  telephone?:   string | null;
  estDefaut:    boolean;
  creeLe?:      string;
  misAJourLe?:  string;
}

/** Type d'adresse (miroir de l'enum backend) */
export type TypeAdresse =
  | 'domicile'
  | 'bureau'
  | 'boutique'
  | 'entrepot'
  | 'relais'
  | 'depart'
  | 'autre';

export const TYPE_ADRESSE_LABELS: Record<TypeAdresse, string> = {
  domicile:  'Domicile',
  bureau:    'Bureau',
  boutique:  'Boutique',
  entrepot:  'Entrepôt',
  relais:    'Relais',
  depart:    'Départ',
  autre:     'Autre',
};

export const TYPE_ADRESSE_ICONS: Record<TypeAdresse, string> = {
  domicile:  '🏠',
  bureau:    '🏢',
  boutique:  '🏪',
  entrepot:  '📦',
  relais:    '📍',
  depart:    '🚀',
  autre:     '📌',
};

/** Agence d'entreprise */
export interface CompanyBranch {
  id:              string;
  companyId:       string;
  nom:             string;
  type:            BranchType;
  adresse?:        string | null;
  quartier?:       string | null;
  commune?:        string | null;
  ville:           string;
  region?:         string | null;
  pays:            string;
  codePostal?:     string | null;
  latitude?:       number | null;
  longitude?:      number | null;
  rayonLivraisonKm: number;
  telephone?:      string | null;
  repere?:         string | null;
  actif:           boolean;
  estPrincipal:    boolean;
}

export type BranchType = 'siege' | 'magasin' | 'entrepot' | 'point_relais' | 'autre';

export const BRANCH_TYPE_LABELS: Record<BranchType, string> = {
  siege:        'Siège',
  magasin:      'Magasin',
  entrepot:     'Entrepôt',
  point_relais: 'Point relais',
  autre:        'Autre',
};

/** Position temps réel d'un livreur */
export interface DeliveryPosition extends Coordinates {
  deliveryId:  string;
  precisionM?: number;
  cap?:        number;
  vitesseKmh?: number;
  sessionId?:  string;
  ts:          string;
}

/** Résultat d'une recherche de proximité */
export interface ProximityResult {
  id:          string;
  nom:         string;
  type:        'livreur' | 'entreprise' | 'correspondant';
  latitude:    number;
  longitude:   number;
  distanceKm:  number;
  adresse?:    string;
  ville?:      string;
  telephone?:  string;
  logo?:       string;
  disponible?: boolean;
}

/** Résultat Nominatim (geocoding inverse) */
export interface NominatimResult {
  displayName: string;
  adresse?:    string;
  quartier?:   string;
  commune?:    string;
  ville?:      string;
  region?:     string;
  pays?:       string;
  codePostal?: string;
  latitude:    number;
  longitude:   number;
}

/** Props communes à tous les composants carte */
export interface BaseMapProps {
  center?:   Coordinates;
  zoom?:     number;
  height?:   string;
  darkMode?: boolean;
  className?: string;
}

/** Option de tuile de carte */
export interface TileLayerOption {
  url:         string;
  attribution: string;
  maxZoom?:    number;
}

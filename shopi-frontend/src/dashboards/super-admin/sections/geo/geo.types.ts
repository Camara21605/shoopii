/* ================================================================
 * FICHIER : sections/geo/geo.types.ts
 * Référentiel Géographique Shopi — types centraux.
 * Utilisé par : administrateurs, entreprises, livreurs, partenaires,
 *               clients, commandes, livraisons, statistiques, cartes.
 * ================================================================ */

/* ── Les 6 niveaux de la hiérarchie géographique ── */
export type GeoLevel =
  | 'pays'
  | 'region'
  | 'prefecture'
  | 'commune'
  | 'quartier'
  | 'zone';

/* ── Statut d'un élément géographique ── */
export type GeoStatut = 'actif' | 'inactif';

/* ── Entité géographique de base ── */
export interface GeoItem {
  id:          string;
  code:        string;
  nom:         string;
  description: string;
  statut:      GeoStatut;
  parentId:    string | null;
  createdAt:   string;
  updatedAt:   string;
  auteur:      string;
  enfants:     number;      /* nombre d'éléments enfants directs */
}

/* ── Types spécialisés par niveau ── */
export interface Pays        extends GeoItem { iso2: string; iso3: string; indicatif: string; devise: string; }
export interface Region      extends GeoItem { paysId: string; chef_lieu: string; }
export interface Prefecture  extends GeoItem { regionId: string; chef_lieu: string; }
export interface Commune     extends GeoItem { prefectureId: string; type: 'urbaine' | 'rurale' | 'semi-urbaine'; }
export interface Quartier    extends GeoItem { communeId: string; population: number; }
/* Niveau géographique des entités couvertes par une zone */
export type ZoneCoverageType = 'pays' | 'region' | 'prefecture' | 'commune' | 'quartier';

export interface ZoneLivraison extends GeoItem {
  /** Niveau des entités couvertes (commune par défaut) */
  couvertureType:  ZoneCoverageType;
  /** IDs des entités couvertes — peut couvrir plusieurs entités du même niveau */
  couvertureIds:   string[];
  rayonKm:         number;
  fraisLivraison:  number;   /* GNF */
  tempsEstime:     number;   /* minutes */
  acteursCover:    number;   /* livreurs couvrant cette zone */
}

/* ── Union de tous les types geo ── */
export type AnyGeoItem = Pays | Region | Prefecture | Commune | Quartier | ZoneLivraison;

/* ── Config d'un niveau (méta-données d'affichage) ── */
export interface GeoLevelConfig {
  level:       GeoLevel;
  label:       string;         /* singulier */
  labelPlural: string;
  icon:        string;         /* FontAwesome */
  color:       string;         /* var(--…) */
  parentLevel: GeoLevel | null;
  childLevel:  GeoLevel | null;
  endpoint:    string;         /* pour future connexion backend */
}

/* ── Configs pour les 6 niveaux ── */
export const GEO_LEVELS: GeoLevelConfig[] = [
  { level: 'pays',        label: 'Pays',             labelPlural: 'Pays',               icon: 'fa-earth-africa',     color: '--acid',    parentLevel: null,         childLevel: 'region',     endpoint: '/geo/pays' },
  { level: 'region',      label: 'Région',            labelPlural: 'Régions',             icon: 'fa-map',             color: '--sky',     parentLevel: 'pays',        childLevel: 'prefecture', endpoint: '/geo/regions' },
  { level: 'prefecture',  label: 'Préfecture',        labelPlural: 'Préfectures',         icon: 'fa-building-columns', color: '--violet',  parentLevel: 'region',      childLevel: 'commune',    endpoint: '/geo/prefectures' },
  { level: 'commune',     label: 'Commune',           labelPlural: 'Communes',            icon: 'fa-city',            color: '--gold',    parentLevel: 'prefecture',   childLevel: 'quartier',   endpoint: '/geo/communes' },
  { level: 'quartier',    label: 'Quartier',          labelPlural: 'Quartiers',           icon: 'fa-house',           color: '--coral',   parentLevel: 'commune',      childLevel: 'zone',       endpoint: '/geo/quartiers' },
  { level: 'zone',        label: 'Zone de livraison', labelPlural: 'Zones de livraison',  icon: 'fa-truck-fast',      color: '--rose',    parentLevel: 'commune',      childLevel: null,         endpoint: '/geo/zones' },
];

/* ── Entrée du journal d'audit géographique ── */
export type GeoAuditAction = 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'import';

export interface GeoAuditEntry {
  id:        string;
  action:    GeoAuditAction;
  niveau:    GeoLevel;
  itemNom:   string;
  itemCode:  string;
  auteur:    string;
  quand:     string;
  details:   string;
}

/* ── Résultat d'import ── */
export interface ImportResult {
  total:    number;
  created:  number;
  updated:  number;
  skipped:  number;
  errors:   { ligne: number; message: string }[];
}

/* ── Toutes les données géo passées aux sélecteurs en cascade ── */
export interface AllGeoData {
  pays:        GeoItem[];
  regions:     GeoItem[];
  prefectures: GeoItem[];
  communes:    GeoItem[];
  /** Requis pour la couverture de zone au niveau quartier */
  quartiers:   GeoItem[];
}

/* ── Entrée d'activité récente dérivée des données géo ── */
export interface GeoRecentItem {
  niveau:    GeoLevel;
  nom:       string;
  code:      string;
  auteur:    string;
  updatedAt: string;
  statut:    GeoStatut;
}

/* ── Statistiques globales ── */
export interface GeoStats {
  totalPays:         number;
  totalRegions:      number;
  totalPrefectures:  number;
  totalCommunes:     number;
  totalQuartiers:    number;
  totalZones:        number;
  actifs:            number;
  inactifs:          number;
  couverturePct:     number;
  perNiveau:         Record<string, { actifs: number; total: number }>;
  recentItems:       GeoRecentItem[];
}

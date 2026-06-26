/* ================================================================
 * FICHIER : src/modules/home/components/correspondants/data/types.ts
 *
 * Types partagés de la page liste des correspondants.
 * ================================================================ */

/* Portée géographique (aligné sur l'enum backend CorrespondantType) */
export type CorrType = 'regional' | 'zonal' | 'national';

/* Un correspondant tel qu'affiché dans la liste */
export interface Correspondant {
  id:           string;          // UUID
  nom:          string;          // fullName
  initiales:    string;          // dérivé du nom
  zone:         string;          // ex. "Almamya, Kaloum · Conakry"
  commune:      string;          // ex. "kaloum" (pour filtrage)
  bio:          string;
  type:         CorrType;
  note:         number;          // averageRating
  nbAvis:       number;          // nombre d'avis
  missions:     number;          // totalMissions
  fiabilite:    number;          // % de fiabilité
  experience:   string;          // ex. "4 ans"
  enLigne:      boolean;         // online
  suivi:        boolean;         // isSuivi
}

/* Filtres rapides de la barre d'outils */
export type FiltreRapide = 'all' | 'available' | 'followed' | 'regional' | 'zonal' | 'national';

/* Mode d'affichage */
export type VueMode = 'grid' | 'list';

/* Options de tri */
export type TriOption = 'pertinence' | 'note' | 'missions' | 'nom';
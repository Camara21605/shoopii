/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/types.ts
 *
 * Types partagés de la page profil livreur.
 * Correspond au retour de GET /client/livreurs/:id
 * (LivreurProfileFull du backend) + champs d'affichage dérivés.
 * ================================================================ */

/**
 * Frais de livraison réels d'un lieu desservi (backend : tarifsParZone) — ceux de la zone de
 * livraison fixés par Shoneya, identiques à ce que facture le panier. `frais` null = lieu couvert
 * par aucune zone de livraison.
 */
export interface TarifZoneLivraison {
  lieu:    string;
  zoneNom: string | null;
  frais:   number | null;
}
export type LivreurTarifs = TarifZoneLivraison[];

/** Profil complet d'un livreur (vue détail). */
export interface LivreurProfile {
  id:              string;
  fullName:        string;
  profilePicture:  string | null;
  zone:            string;
  /** Ville / quartier réels (voir actorLocation() côté API) */
  ville?:          string | null;
  commune?:        string | null;
  quartier?:       string | null;
  localisation?:   string | null;
  vehicule:        string;        // libellé formaté "🛵 Honda Wave"
  vehiculeType:    string;
  /* null = masqué par le livreur (Paramètres > Confidentialité) */
  totalLivraisons: number | null;
  averageRating:   number | null;
  reviewsCount:    number | null;
  ponctualite:     number;
  experience:      string;
  disponible:      boolean;
  isSuivi:         boolean;

  bio:             string | null;
  telephone:       string | null;
  whatsapp:        string | null;
  zones:           string[];
  tarifs:          LivreurTarifs;
  langues:         string[];
  horaires:        Record<string, string>;  // { lundi: "07:00-22:00", ... }
  immatriculation: string | null;
  assurance:       boolean;
  permis:          boolean;       // fourni ou non (le document n'est jamais public)
  createdAt:       string;
  abonnesCount:    number;
}

/** Onglets de la page. */
export type ProfilTab = 'info' | 'vehicule' | 'zones' | 'tarifs' | 'avis' | 'historique' | 'localisation';
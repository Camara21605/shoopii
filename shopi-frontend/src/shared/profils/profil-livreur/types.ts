/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/types.ts
 *
 * Types partagés de la page profil livreur.
 * Correspond au retour de GET /client/livreurs/:id
 * (LivreurProfileFull du backend) + champs d'affichage dérivés.
 * ================================================================ */

/** Tarification renvoyée par le backend (buildTarifs). */
export interface LivreurTarifs {
  base:               number;
  parKm:              number;
  supplementLourd:    number;
  majorationNocturne: number;
}

/** Profil complet d'un livreur (vue détail). */
export interface LivreurProfile {
  id:              string;
  fullName:        string;
  profilePicture:  string | null;
  zone:            string;
  vehicule:        string;        // libellé formaté "🛵 Honda Wave"
  vehiculeType:    string;
  totalLivraisons: number;
  averageRating:   number;
  reviewsCount:    number;
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
  permis:          string | null;
  createdAt:       string;
  abonnesCount:    number;
}

/** Onglets de la page. */
export type ProfilTab = 'info' | 'vehicule' | 'zones' | 'tarifs' | 'avis' | 'historique' | 'localisation';
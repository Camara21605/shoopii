export interface BoutiqueCardData {
  id:            string;
  companyName:   string;
  description:   string | null;
  logo:          string | null;
  coverImage:    string | null;
  averageRating: number;
  totalOrders:   number;
  totalRatings:  number;
  ville:         string | null;
  /** Quartier (à défaut la commune) et texte prêt à afficher « Quartier, Ville » */
  quartier?:     string | null;
  commune?:      string | null;
  localisation?: string | null;
  verified:      boolean;
  /** Modèle économique de la boutique — voir Company.businessModel côté
   *  backend. Pilote le badge produits/services sur CardEntreprise. */
  businessModel: 'products' | 'services';
  domaine:       string | null;
  isSuivi?:      boolean;
}

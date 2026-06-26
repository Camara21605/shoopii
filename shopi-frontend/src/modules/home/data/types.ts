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
  verified:      boolean;
  domaine:       string | null;
  isSuivi?:      boolean;
}

export type RatingStar = 1 | 2 | 3 | 4 | 5;

export type RatingDistribution = Partial<Record<RatingStar, number>>;

export interface AvisItem {
  id:              string;
  clientNom:       string;
  clientInitiales: string;
  note:            number;
  commentaire:     string | null;
  date:            string;
}

export interface AvisResponse {
  averageRating:  number;
  totalRatings:   number;
  distribution?:  RatingDistribution;
  avis:           AvisItem[];
}

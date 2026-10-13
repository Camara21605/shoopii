/**
 * Règles de filtrage et de tri du catalogue d'une boutique (onglet Produits).
 * Mêmes règles que le site : shopi-frontend/src/modules/home/components/
 * boutique/data/filtresProduits.ts — garder les deux fichiers alignés.
 */

export type TriProduits =
  | 'pertinence' | 'prixAsc' | 'prixDesc' | 'nouveautes' | 'ventes' | 'populaires';

export const TRIS_PRODUITS: TriProduits[] =
  ['pertinence', 'prixAsc', 'prixDesc', 'nouveautes', 'ventes', 'populaires'];

/** Champs d'un produit utilisés par les filtres. */
export interface ProduitFiltrable {
  nom:          string;
  marque?:      string | null;
  prix:         number;
  prixAncien?:  number | null;
  stock:        number;
  createdAt:    string;
  category?:    { nom: string } | null;
  viewsCount?:  number;
  likesCount?:  number;
  ventesCount?: number;
}

export interface FiltresProduits {
  recherche: string;
  categorie: string | null;   /* null = toutes */
  prixMin:   number | null;   /* null = pas de borne */
  prixMax:   number | null;
  enStock:   boolean;
  enPromo:   boolean;
  nouveautes: boolean;
  tri:       TriProduits;
}

export const FILTRES_VIDES: FiltresProduits = {
  recherche: '', categorie: null, prixMin: null, prixMax: null,
  enStock: false, enPromo: false, nouveautes: false, tri: 'pertinence',
};

/** Un produit publié depuis moins de 14 jours est une nouveauté. */
export const NOUVEAUTE_JOURS = 14;

export const isNouveau = (p: Pick<ProduitFiltrable, 'createdAt'>) =>
  !!p.createdAt && Date.now() - new Date(p.createdAt).getTime() < NOUVEAUTE_JOURS * 86_400_000;

/** En promotion = prix barré réellement supérieur au prix affiché
 *  (un prixAncien ≤ prix n'est pas une remise, la carte n'affiche rien). */
export const isEnPromo = (p: Pick<ProduitFiltrable, 'prix' | 'prixAncien'>) =>
  p.prixAncien != null && p.prixAncien > p.prix;

export const isEnStock = (p: Pick<ProduitFiltrable, 'stock'>) => p.stock > 0;

const norm = (s: string) => s.toLocaleLowerCase('fr').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Score de popularité : une vente pèse plus qu'un j'aime, qui pèse plus
 *  qu'une vue. */
const popularite = (p: ProduitFiltrable) =>
  (p.ventesCount ?? 0) * 10 + (p.likesCount ?? 0) * 3 + (p.viewsCount ?? 0);

const recent = (a: ProduitFiltrable, b: ProduitFiltrable) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export function filtrerProduits<T extends ProduitFiltrable>(produits: T[], f: FiltresProduits): T[] {
  const q = norm(f.recherche.trim());
  const out = produits.filter(p =>
    (!f.categorie  || p.category?.nom === f.categorie) &&
    (!f.enStock    || isEnStock(p)) &&
    (!f.enPromo    || isEnPromo(p)) &&
    (!f.nouveautes || isNouveau(p)) &&
    (f.prixMin == null || p.prix >= f.prixMin) &&
    (f.prixMax == null || p.prix <= f.prixMax) &&
    (!q || norm(`${p.nom} ${p.marque ?? ''} ${p.category?.nom ?? ''}`).includes(q)),
  );

  switch (f.tri) {
    case 'prixAsc':    return out.sort((a, b) => a.prix - b.prix);
    case 'prixDesc':   return out.sort((a, b) => b.prix - a.prix);
    case 'nouveautes': return out.sort(recent);
    case 'ventes':     return out.sort((a, b) => (b.ventesCount ?? 0) - (a.ventesCount ?? 0) || recent(a, b));
    case 'populaires': return out.sort((a, b) => popularite(b) - popularite(a) || recent(a, b));
    /* Pertinence : disponibles d'abord, puis les plus populaires, puis
     * les plus récents. */
    default:
      return out.sort((a, b) =>
        Number(isEnStock(b)) - Number(isEnStock(a)) || popularite(b) - popularite(a) || recent(a, b));
  }
}

/** Nombre de filtres actifs (le tri n'en est pas un). */
export function nbFiltresActifs(f: FiltresProduits): number {
  return [
    f.recherche.trim() !== '', f.categorie != null, f.prixMin != null || f.prixMax != null,
    f.enStock, f.enPromo, f.nouveautes,
  ].filter(Boolean).length;
}

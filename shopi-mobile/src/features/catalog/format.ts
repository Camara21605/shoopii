/** Mise en forme partagée du catalogue (prix, images). */

/** 280000 → « 280 000 GNF » (espaces insécables, sans dépendre d'Intl). */
export function formatPrice(value: number): string {
  const n = Math.round(value);
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;
}

/** Remise en % si l'ancien prix est supérieur, sinon null. */
export function discountPercent(prix: number, ancien?: number | null): number | null {
  if (!ancien || ancien <= prix) return null;
  return Math.round((1 - prix / ancien) * 100);
}

/**
 * Miniature Cloudinary à la bonne taille (évite de télécharger une photo de
 * 2 Mo pour une carte de 180 px — important sur réseau mobile lent).
 * Sans effet sur une image hors Cloudinary.
 */
export function thumb(url: string | null | undefined, width = 400): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto/`);
}

/**
 * Photo produit « studio » pour la fiche : les marges d'origine (fond uni
 * autour de l'objet) sont retirées (e_trim), puis l'objet est CENTRÉ dans un
 * carré blanc sans être agrandi au-delà de sa taille réelle (c_lpad). Toutes
 * les photos ont ainsi le même cadrage, quel que soit l'envoi du vendeur —
 * même règle que la fiche produit du site (shared/utils/productImage.ts).
 * Hors Cloudinary : l'URL d'origine (l'écran l'affiche en `contain`).
 */
export function productFrame(url: string | null | undefined, size = 1000): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/e_trim:10/w_${size},h_${size},c_lpad,b_white,q_auto,f_auto/`);
}

/** Première IMAGE d'un produit (une vidéo ne sert pas de miniature). */
export function firstImage(images: { url: string; type?: string; ordre?: number }[] | undefined) {
  const list = [...(images ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  return (list.find((i) => (i.type ?? 'image') === 'image') ?? null)?.url ?? null;
}

/* ================================================================
 * FICHIER : src/shared/utils/productImage.ts
 *
 * Photo produit « studio » (fiche produit) : les marges d'origine autour
 * de l'objet sont retirées (e_trim), puis l'objet est CENTRÉ dans un carré
 * blanc sans être agrandi au-delà de sa taille réelle (c_lpad). Toutes les
 * photos ont ainsi le même cadrage, quel que soit l'envoi du vendeur.
 * Même règle que l'application mobile (features/catalog/format.ts →
 * productFrame). Hors Cloudinary : URL d'origine, affichée en contain.
 * ================================================================ */

export function productFrame(url: string | null | undefined, size = 1000): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/e_trim:10/w_${size},h_${size},c_lpad,b_white,q_auto,f_auto/`);
}

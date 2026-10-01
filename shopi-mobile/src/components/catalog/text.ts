/**
 * Petits utilitaires de texte : initiales, mise en forme des libellés en capitales.
 */

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** « VÊTEMENTS & MODES » → « Vêtements & modes » (saisis en majuscules). */
export function capitalize(s: string) {
  if (s !== s.toUpperCase()) return s.charAt(0).toUpperCase() + s.slice(1);
  const low = s.toLocaleLowerCase("fr");
  return low.charAt(0).toUpperCase() + low.slice(1);
}

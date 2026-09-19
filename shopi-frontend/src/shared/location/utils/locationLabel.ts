/* ================================================================
 * FICHIER : src/shared/location/utils/locationLabel.ts
 *
 * Texte de localisation d'un acteur (entreprise, livreur, correspondant)
 * pour les cartes et les profils : « Quartier, Ville ».
 *
 * Le backend renvoie déjà `localisation` (voir actorLocation() côté API) ;
 * ce helper recompose le même texte à partir de `quartier`/`commune`/`ville`
 * pour les écrans qui n'ont que ces champs, et retombe sur les anciens
 * champs (`zone`, `region`) — jamais sur une ville inventée.
 * ================================================================ */

export interface LocationLike {
  localisation?: string | null;
  quartier?:     string | null;
  commune?:      string | null;
  ville?:        string | null;
  zone?:         string | null;   // ancien champ livreur
  region?:       string | null;   // ancien champ correspondant / entreprise
}

const clean = (v?: string | null) => (v ?? '').replace(/\s+/g, ' ').trim();

/** « Quartier, Ville » — chaîne vide si rien n'est renseigné. */
export function locationLabel(x: LocationLike | null | undefined): string {
  if (!x) return '';
  if (clean(x.localisation)) return clean(x.localisation);

  const parts: string[] = [];
  for (const p of [clean(x.quartier) || clean(x.commune), clean(x.ville)]) {
    if (p && !parts.some(q => q.toLowerCase() === p.toLowerCase())) parts.push(p);
  }
  if (parts.length) return parts.join(', ');

  return clean(x.zone) || clean(x.region);
}

/** Ville et quartier séparés, pour les fiches détaillées (deux lignes). */
export function locationParts(x: LocationLike | null | undefined): { ville: string; quartier: string } {
  return {
    ville:    clean(x?.ville),
    quartier: clean(x?.quartier) || clean(x?.commune),
  };
}

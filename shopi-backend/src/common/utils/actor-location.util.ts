/* ============================================================
 * FICHIER : src/common/utils/actor-location.util.ts
 *
 * RÔLE : forme UNIQUE sous laquelle la localisation d'un acteur
 * (entreprise, livreur, correspondant) est renvoyée aux interfaces
 * — cartes, profils publics, listes des dashboards :
 *
 *   { ville, commune, quartier, localisation }
 *
 *   ville         "Conakry", "Kindia"…
 *   commune       "Kaloum", "Ratoma"…                 (arrondissement)
 *   quartier      quartier si renseigné, sinon la commune (le plus fin connu)
 *   localisation  texte prêt à afficher : "Quartier, Ville"
 *
 * Avant : chaque service inventait sa propre forme (`region` = "commune, ville"
 * pour les entreprises, `zone` seul pour les livreurs avec 'Conakry' inventé
 * quand il était vide, `quartier` = commune pour les correspondants…) et
 * les cartes n'affichaient donc jamais la ville ET le quartier ensemble.
 * Jamais de valeur inventée : un champ inconnu vaut null.
 * ============================================================ */

export interface ActorLocationInput {
  ville?:    string | null;
  commune?:  string | null;
  quartier?: string | null;
}

export interface ActorLocation {
  ville:        string | null;
  commune:      string | null;
  quartier:     string | null;
  localisation: string | null;
}

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? '').replace(/\s+/g, ' ').trim();
  return t ? t : null;
};

export function actorLocation(i: ActorLocationInput): ActorLocation {
  const ville    = clean(i.ville);
  const commune  = clean(i.commune);
  const quartier = clean(i.quartier) ?? commune;

  /* "Kindia, Kindia" n'apporte rien : on ne répète pas deux fois le même nom */
  const parts: string[] = [];
  for (const p of [quartier, ville]) {
    if (p && !parts.some(x => x.toLowerCase() === p.toLowerCase())) parts.push(p);
  }

  return { ville, commune, quartier, localisation: parts.length ? parts.join(', ') : null };
}

/* ============================================================
 * FICHIER : src/modules/explore/search-text.util.ts
 *
 * RÔLE : Normalisation du texte de recherche, partagée par la grille
 *        Explorer et les suggestions de la barre de recherche (home).
 *
 * POURQUOI : l'ancienne recherche cherchait la phrase tapée telle
 * quelle (`LIKE '%samsung galaxy%'`) — résultat :
 *   - « telephone » ne trouvait pas « Téléphone » (accents) ;
 *   - « galaxy samsung » ou « samsung a15 galaxy » ne trouvait rien
 *     (ordre des mots) ;
 *   - « chaussures » ne trouvait pas « Chaussure » (pluriel) ;
 *   - un `%` ou `_` tapé était interprété comme joker SQL.
 * Ici chaque mot doit se retrouver quelque part (ET entre les mots,
 * OU entre les colonnes), sans tenir compte des accents ni de la casse.
 *
 * Accents retirés côté SQL par translate() — l'extension `unaccent`
 * n'est pas installée (même approche que actor-map.service.ts).
 * ============================================================ */

import type { SelectQueryBuilder } from 'typeorm';

const ACC_FROM = "àâäáãåéèêëíìîïóòôöõúùûüýÿçñ'-";
const ACC_TO   = 'aaaaaaeeeeiiiiooooouuuuyycn  ';

/** Mots ignorés : trop fréquents pour aider à trouver quoi que ce soit. */
const STOP_WORDS = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'et', 'en', 'au', 'aux', 'pour', 'avec', 'a']);

/** Au-delà, les mots supplémentaires n'affinent plus rien et alourdissent la requête. */
const MAX_TOKENS = 5;

/** Expression SQL : colonne en minuscules, sans accents, jamais NULL. */
export function unaccentSql(col: string): string {
  return `translate(lower(coalesce(${col}, '')), '${ACC_FROM.replace(/'/g, "''")}', '${ACC_TO}')`;
}

/** Même transformation que unaccentSql(), côté JS. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['-]/g, ' ')
    .trim();
}

/** Échappe les jokers LIKE (à utiliser avec ESCAPE '\'). */
export function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, m => `\\${m}`);
}

/** Mot → forme recherchée : le pluriel simple (s/x final) est retiré
 *  pour que « chaussures » trouve aussi « chaussure ». */
function stem(word: string): string {
  return word.length >= 4 && /[sx]$/.test(word) ? word.slice(0, -1) : word;
}

/** « Téléphones Samsung  de luxe » → ['telephone', 'samsung', 'luxe'] */
export function searchTokens(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const words = normalizeText(raw).split(/[^a-z0-9]+/).filter(Boolean);
  /* « l'iPhone » → « l » + « iphone » : une lettre isolée ne filtre rien d'utile
   * (et exclurait « iPhone 15 », qui n'a pas de « l »). Les chiffres restent. */
  const meaningful = words.filter(w => !STOP_WORDS.has(w) && !/^[a-z]$/.test(w));
  const chosen = (meaningful.length ? meaningful : words).map(stem);
  return [...new Set(chosen)].slice(0, MAX_TOKENS);
}

/** Phrase normalisée complète (pour le classement « nom exact / commence par »). */
export function searchPhrase(raw: string | undefined | null): string {
  return normalizeText(raw ?? '').replace(/\s+/g, ' ');
}

/**
 * Ajoute au QueryBuilder : chaque mot doit apparaître dans au moins une
 * des colonnes. `prefix` évite les collisions de noms de paramètres.
 */
export function applySearchTokens(
  qb: SelectQueryBuilder<any>, cols: string[], tokens: string[], prefix = 'tk',
): void {
  tokens.forEach((tok, i) => {
    const conds = cols.map(c => `${unaccentSql(c)} LIKE :${prefix}${i} ESCAPE '\\'`).join(' OR ');
    qb.andWhere(`(${conds})`, { [`${prefix}${i}`]: `%${likeEscape(tok)}%` });
  });
}

/**
 * Expression SQL de pertinence (plus petit = meilleur) :
 *   0 nom exact · 1 nom commence par la phrase · 2 un mot du nom commence
 *   par la phrase · 3 nom contient la phrase · 4 tous les mots dans le nom
 *   · 5 trouvé ailleurs (marque, tags, catégorie…).
 * Les paramètres sont posés par setSearchRankParams().
 */
export function relevanceSql(nameCol: string, tokens: string[], prefix = 'tk'): string {
  const name = unaccentSql(nameCol);
  const allInName = tokens.length
    ? tokens.map((_, i) => `${name} LIKE :${prefix}${i} ESCAPE '\\'`).join(' AND ')
    : 'false';
  return `(CASE
    WHEN ${name} = :${prefix}Exact THEN 0
    WHEN ${name} LIKE :${prefix}Start ESCAPE '\\' THEN 1
    WHEN ${name} LIKE :${prefix}Word ESCAPE '\\' THEN 2
    WHEN ${name} LIKE :${prefix}Phrase ESCAPE '\\' THEN 3
    WHEN ${allInName} THEN 4
    ELSE 5
  END)`;
}

export function setSearchRankParams(
  qb: SelectQueryBuilder<any>, raw: string, prefix = 'tk',
): void {
  const phrase = searchPhrase(raw);
  const esc = likeEscape(phrase);
  qb.setParameter(`${prefix}Exact`,  phrase)
    .setParameter(`${prefix}Start`,  `${esc}%`)
    .setParameter(`${prefix}Word`,   `% ${esc}%`)
    .setParameter(`${prefix}Phrase`, `%${esc}%`);
}

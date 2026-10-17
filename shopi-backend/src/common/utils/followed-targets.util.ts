/* ============================================================
 * FICHIER : src/common/utils/followed-targets.util.ts
 *
 * « Comptes déjà suivis » d'un utilisateur, en UNE sous-requête SQL :
 * sert à les retirer de l'ACCUEIL (boutiques, livreurs, points relais
 * proposés) — le client les a déjà trouvés. Ils restent :
 *   - dans la RECHERCHE (pour rouvrir leur profil et se désabonner) ;
 *   - dans « Mes abonnements » ;
 *   - et leurs PRODUITS restent partout (catalogue, accueil).
 *
 * Le suiveur peut être un client, une entreprise, un livreur ou un point
 * relais : on retrouve son profil depuis users.id (JWT), sans aller-retour.
 * Seuls les abonnements ACTIFS comptent (isSubscribed + status active),
 * comme partout ailleurs (SuivisBaseService.getMyFollowedIds).
 *
 * Paramètre SQL attendu : :viewerUserId
 * ============================================================ */

export type FollowedTargetType = 'company' | 'delivery' | 'correspondent';

const FOLLOWER_TABLES: Array<[string, string]> = [
  ['client', 'clients'],
  ['company', 'entreprises'],
  ['delivery', 'livreurs'],
  ['correspondent', 'correspondants'],
];

/** SELECT des id de cibles (`targetType`) suivies par :viewerUserId. */
export function followedTargetsSql(targetType: FollowedTargetType): string {
  const who = FOLLOWER_TABLES
    .map(([type, table]) => `(f."followerType" = '${type}' AND f."followerId" IN (SELECT id FROM ${table} WHERE "userId" = :viewerUserId))`)
    .join(' OR ');
  return `SELECT f."targetId" FROM follows f
           WHERE f."targetType" = '${targetType}'
             AND f."isSubscribed" = true
             AND f.status = 'active'
             AND (${who})`;
}

/** Valeur de `?masquerSuivis=` (« true », « 1 ») → booléen. */
export function parseMasquerSuivis(v: unknown): boolean {
  return v === true || v === 'true' || v === '1';
}

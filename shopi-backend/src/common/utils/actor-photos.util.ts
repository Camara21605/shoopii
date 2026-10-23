/* ============================================================
 * FICHIER : src/common/utils/actor-photos.util.ts
 * RÔLE    : Retrouver en UNE requête les photos de profil d'une liste
 *           d'acteurs, pour les afficher partout (avis, listes, équipes…)
 *           au lieu des seules initiales :
 *             • livreur       → livreurs.photoUrl, sinon users.profilePicture
 *             • correspondant → users.profilePicture
 *             • client        → users.profilePicture (via la commande)
 * Requêtes paramétrées uniquement ; un compte non actif ne renvoie pas
 * de photo.
 * ============================================================ */

import { EntityManager } from 'typeorm';

type PhotoMap = Map<string, string | null>;

const uniq = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((x): x is string => !!x))];

/** Photos des livreurs (clé : livreurs.id) */
export async function deliveryPhotos(m: EntityManager, ids: (string | null | undefined)[]): Promise<PhotoMap> {
  const list = uniq(ids);
  if (!list.length) return new Map();
  const rows: { id: string; photo: string | null }[] = await m.query(
    `SELECT l.id, COALESCE(NULLIF(l."photoUrl", ''), CASE WHEN u.status = 'active' THEN NULLIF(u."profilePicture", '') END) AS photo
       FROM livreurs l LEFT JOIN users u ON u.id = l."userId"
      WHERE l.id = ANY($1::uuid[])`, [list],
  );
  return new Map(rows.map(r => [r.id, r.photo ?? null]));
}

/** Photos des correspondants / points relais (clé : correspondants.id) */
export async function correspondentPhotos(m: EntityManager, ids: (string | null | undefined)[]): Promise<PhotoMap> {
  const list = uniq(ids);
  if (!list.length) return new Map();
  const rows: { id: string; photo: string | null }[] = await m.query(
    `SELECT c.id, NULLIF(u."profilePicture", '') AS photo
       FROM correspondants c JOIN users u ON u.id = c."userId"
      WHERE c.id = ANY($1::uuid[]) AND u.status = 'active'`, [list],
  );
  return new Map(rows.map(r => [r.id, r.photo ?? null]));
}

/**
 * Photo du client de chaque commande (clé : commandes.id) — sert aux avis,
 * qui ne gardent que la commande. publicOnly : page publique (sans
 * connexion) → seulement si le profil du client est public
 * (privacySettings.visibilite, « public » par défaut).
 */
export async function clientPhotosByCommande(
  m: EntityManager,
  commandeIds: (string | null | undefined)[],
  opts: { publicOnly?: boolean } = {},
): Promise<PhotoMap> {
  const list = uniq(commandeIds);
  if (!list.length) return new Map();
  const rows: { id: string; photo: string | null }[] = await m.query(
    `SELECT co.id, NULLIF(u."profilePicture", '') AS photo
       FROM commandes co
       JOIN clients cl ON cl.id = co."clientId"
       JOIN users u ON u.id = cl."userId"
      WHERE co.id = ANY($1::uuid[]) AND u.status = 'active'
        ${opts.publicOnly ? `AND COALESCE(cl."privacySettings"->>'visibilite', 'public') = 'public'` : ''}`, [list],
  );
  return new Map(rows.map(r => [r.id, r.photo ?? null]));
}

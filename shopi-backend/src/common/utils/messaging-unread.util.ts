/* ============================================================
 * FICHIER : src/common/utils/messaging-unread.util.ts
 *
 * RÔLE : Total des messages NON LUS d'un acteur = le nombre affiché sur
 * l'onglet « Messagerie » (et sur l'icône de l'application installée).
 *
 * SOURCE DE VÉRITÉ UNIQUE : les compteurs par conversation
 * (unreadCountInitiator / unreadCountRecipient), déjà tenus à jour par
 * MessagerieService à l'envoi (+1) et à la lecture (remise à 0). Ce total
 * n'introduit donc aucun compteur supplémentaire susceptible de dériver.
 *
 * Périmètre identique à la liste des conversations affichée à l'écran :
 * conversations ACTIVES, ni supprimées ni archivées par cet acteur.
 * Utilisé par : GET /messagerie/unread-count (onglet) et les push (pastille).
 * ============================================================ */

import type { EntityManager } from 'typeorm';

export async function countMessagingUnread(
  manager:   EntityManager,
  actorType: string,
  actorId:   string,
): Promise<number> {
  const rows: { total: string | null }[] = await manager.query(
    `SELECT COALESCE(SUM(
              CASE WHEN c."initiatorType"::text = $1 AND c."initiatorId" = $2
                   THEN c."unreadCountInitiator" ELSE c."unreadCountRecipient" END
            ), 0) AS total
       FROM conversations c
      WHERE c.status::text = 'active'
        AND (
              (c."initiatorType"::text = $1 AND c."initiatorId" = $2
                 AND c."deletedByInitiator" = false AND c."archivedByInitiator" = false)
           OR (c."recipientType"::text = $1 AND c."recipientId" = $2
                 AND c."deletedByRecipient" = false AND c."archivedByRecipient" = false)
            )`,
    [actorType, actorId],
  );
  return Number(rows[0]?.total ?? 0);
}

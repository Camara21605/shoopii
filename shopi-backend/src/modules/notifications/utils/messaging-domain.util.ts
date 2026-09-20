/* ============================================================
 * FICHIER : src/modules/notifications/utils/messaging-domain.util.ts
 *
 * RÔLE : Définit ce qui appartient à la MESSAGERIE (messages, appels) et
 * doit rester complètement séparé du centre de notifications (la cloche).
 *
 * RÈGLE PRODUIT — un message ou un appel manqué :
 *   • incrémente le compteur de l'onglet « Messagerie » (non-lus des
 *     conversations, source de vérité = conversations.unreadCount*) ;
 *   • n'est JAMAIS une ligne du centre de notifications : ni liste, ni
 *     compteur de la cloche, ni badge d'onglet de sidebar ;
 *   • déclenche quand même une notification SYSTÈME (push téléphone) quand
 *     l'application est fermée — voir MessagingPushService.
 *
 * Types concernés : message.*, call.*, group_call.* (voir NotificationType).
 * ============================================================ */

import type { SelectQueryBuilder } from 'typeorm';

const MESSAGING_PREFIXES = ['message.', 'call.', 'group_call.'] as const;

/** true pour tout type de notification relevant de la messagerie. */
export function isMessagingDomainType(type: string): boolean {
  return MESSAGING_PREFIXES.some(prefix => type.startsWith(prefix));
}

/**
 * Parmi eux, seuls ceux-ci méritent un push téléphone : quelque chose à faire
 * pour le DESTINATAIRE alors qu'il n'est peut-être pas dans l'application.
 * Les autres (call.busy / call.offline / call.rejected) sont des retours
 * destinés à l'APPELANT, déjà affichés en direct par l'appel lui-même : ni
 * cloche, ni push.
 */
export const MESSAGING_PUSH_TYPES: ReadonlySet<string> = new Set([
  'message.received',
  'call.missed',
  'group_call.missed',
]);

/**
 * Ajoute au query builder la condition « ce n'est PAS une notification de
 * messagerie ». À appliquer à toute lecture destinée à la cloche / aux badges
 * d'onglets : les anciennes lignes message.* déjà en base restent ainsi
 * invisibles, sans migration de données.
 */
export function excludeMessagingTypes<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias = 'n',
): SelectQueryBuilder<T> {
  const params: Record<string, string> = {};
  const conditions = MESSAGING_PREFIXES.map((prefix, i) => {
    params[`msgDomain${i}`] = `${prefix}%`;
    return `${alias}.type::text LIKE :msgDomain${i}`;
  });
  return qb.andWhere(`NOT (${conditions.join(' OR ')})`, params);
}

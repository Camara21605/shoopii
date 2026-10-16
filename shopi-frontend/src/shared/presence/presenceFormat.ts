/* ============================================================
 * FICHIER : src/shared/presence/presenceFormat.ts
 * Couleurs et libellés des trois états de présence.
 * ============================================================ */

import { formatLastSeen } from '../messagerie/utils/chatUtils';
import type { PresenceStatus } from './presenceStore';

export const PRESENCE_COLOR: Record<PresenceStatus, string> = { online: '#16A34A', reachable: '#F59E0B', offline: '#A3A3A3' };

type T = (key: string, opts?: Record<string, string | number>) => string;

/** « En ligne » · « Joignable · application fermée » · « Vu il y a 5 min » / « Hors ligne ». */
export function presenceLabel(status: PresenceStatus, lastSeen: string | null, t: T, locale?: string, short = false): string {
  if (status === 'online') return short ? t('messagerie.chatHeader.court.enLigne') : t('messagerie.presence.enLigne');
  if (status === 'reachable') return short ? t('messagerie.chatHeader.court.joignable') : t('messagerie.presence.joignable');
  return formatLastSeen(lastSeen, t, locale, short) ?? (short ? '' : t('messagerie.presence.horsLigne'));
}


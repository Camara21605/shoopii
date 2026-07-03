/* ============================================================
 * FICHIER : src/modules/notifications/utils/dnd.util.ts
 *
 * RÔLE : Déterminer si le mode Ne Pas Déranger est actif.
 *
 * UTILISÉ PAR : EmailChannelStrategy, SmsChannelStrategy, PushChannelStrategy
 *
 * LOGIQUE TIMEZONE :
 *   dndStartTime et dndEndTime sont en heure LOCALE de l'acteur.
 *   Ex: dndStartTime="22:00", dndEndTime="08:00", timezone="Africa/Conakry"
 *
 *   On convertit l'heure actuelle UTC en heure locale pour comparer.
 *
 * CAS PARTICULIERS :
 *   - dndEnabled=false                       → DND inactif
 *   - dndEnabled=true, start/end null        → DND permanent (toujours actif)
 *   - start="22:00", end="08:00"             → chevauchement minuit
 *   - start="08:00", end="22:00"             → plage journalière
 *
 * DÉPENDANCE : Intl.DateTimeFormat (natif Node.js — pas de package externe)
 * ============================================================ */

import type { NotificationPreference } from 'src/database/entities/notification/notification-preference.entity';

/**
 * Retourne true si le mode DND est actif en ce moment
 * pour les préférences données.
 *
 * Les notifications URGENT bypassent cette vérification —
 * chaque strategy est responsable du check priorité.
 */
export function isDndActive(pref: NotificationPreference): boolean {
  if (!pref.dndEnabled) return false;

  // DND permanent (sans plage horaire)
  if (!pref.dndStartTime || !pref.dndEndTime) return true;

  return isCurrentlyInDndWindow(
    pref.dndStartTime,
    pref.dndEndTime,
    pref.timezone ?? 'Africa/Conakry',
  );
}

/**
 * Vérifie si l'heure courante est dans la fenêtre DND.
 *
 * Gère correctement le chevauchement minuit :
 *   start="22:00", end="08:00" → actif de 22h à 8h (chevauchement)
 *   start="08:00", end="20:00" → actif de 8h à 20h (même jour)
 */
function isCurrentlyInDndWindow(
  startTime: string,  // "HH:MM"
  endTime:   string,  // "HH:MM"
  timezone:  string,  // IANA (ex: "Africa/Conakry")
): boolean {
  try {
    // Heure actuelle dans le fuseau de l'acteur
    const now = new Date();

    // Formater l'heure dans la timezone de l'acteur
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone:  timezone,
      hour:      '2-digit',
      minute:    '2-digit',
      hour12:    false,
    });

    const localTime = formatter.format(now); // "HH:MM"

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH,   endM]   = endTime.split(':').map(Number);
    const [curH,   curM]   = localTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes   = endH   * 60 + endM;
    const curMinutes   = curH   * 60 + curM;

    if (startMinutes < endMinutes) {
      // Fenêtre dans la même journée : 08:00 → 20:00
      return curMinutes >= startMinutes && curMinutes < endMinutes;
    } else {
      // Chevauchement minuit : 22:00 → 08:00
      return curMinutes >= startMinutes || curMinutes < endMinutes;
    }
  } catch {
    // Si la timezone IANA est invalide → DND actif par précaution
    return true;
  }
}

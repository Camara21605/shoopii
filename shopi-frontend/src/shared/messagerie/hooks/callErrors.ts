/**
 * src/shared/messagerie/hooks/callErrors.ts
 *
 * Taxonomie centralisée des erreurs/évènements d'appel (partie 8) — un seul
 * endroit pour tous les messages affichés à l'utilisateur pendant un appel,
 * au lieu d'alert() dispersés dans useAudioCall.ts/useGroupCall.ts avec des
 * textes dupliqués et une seule modalité (bloquante, jamais différenciée).
 *
 * Consommé via GlobalCallContext.tsx/GroupCallContext.tsx qui traduisent
 * un CallErrorInfo en toast (système UI Shoneya existant — voir
 * ToastContext.tsx), jamais de nouvelle librairie.
 */

import type { ToastType } from '../../../dashboards/entreprise/types';

export type CallErrorCode =
  // Permissions/périphériques (voir aussi mediaErrors.ts pour le détail DOMException)
  | 'mic-permission-denied'
  | 'camera-permission-denied'
  | 'permission-blocked'
  | 'no-microphone'
  | 'no-camera'
  | 'device-busy'
  // Réseau/WebRTC
  | 'webrtc-error'
  | 'network-error'
  | 'turn-unavailable'
  // Issue de l'appel (signalisation)
  | 'call-ended'
  | 'call-rejected'
  | 'user-busy'
  | 'user-banned'
  | 'call-expired'
  | 'unknown';

export interface CallErrorInfo {
  code:     CallErrorCode;
  message:  string;     // court, non technique, prêt à afficher
  severity: ToastType;  // sévérité déjà mappée sur le système de toast Shoneya
}

const CATALOG: Record<CallErrorCode, Omit<CallErrorInfo, 'code'>> = {
  'mic-permission-denied':    { message: 'Autorisez le micro pour continuer.',                          severity: 'e' },
  'camera-permission-denied': { message: 'Autorisez la caméra pour continuer.',                          severity: 'e' },
  'permission-blocked':       { message: 'Micro/caméra bloqués — vérifiez les réglages du navigateur.',  severity: 'e' },
  'no-microphone':            { message: 'Aucun microphone détecté.',                                    severity: 'e' },
  'no-camera':                { message: 'Aucune caméra détectée.',                                      severity: 'e' },
  'device-busy':               { message: 'Périphérique déjà utilisé par une autre application.',        severity: 'e' },
  'webrtc-error':              { message: "La connexion n'a pas pu s'établir. Réessayez.",                severity: 'e' },
  'network-error':             { message: 'Problème de connexion réseau.',                                severity: 'e' },
  'turn-unavailable':          { message: 'Connexion difficile sur ce réseau. Réessayez plus tard.',      severity: 'w' },
  'call-ended':                { message: "L'appel est terminé.",                                         severity: 'i' },
  'call-rejected':             { message: "L'appel a été refusé.",                                        severity: 'i' },
  'user-busy':                  { message: 'Cette personne est déjà en appel.',                           severity: 'w' },
  'user-banned':                { message: "Cette personne n'est pas joignable actuellement.",             severity: 'w' },
  'call-expired':               { message: "Pas de réponse — l'appel a expiré.",                          severity: 'w' },
  'unknown':                    { message: 'Une erreur est survenue.',                                   severity: 'e' },
};

/**
 * @param overrideMessage Remplace le texte du catalogue quand le serveur
 *   fournit déjà un message précis et non technique (ex. call:unavailable) —
 *   évite de perdre de l'information (ex. distinction hors-ligne/refusé)
 *   pour retomber sur un texte générique.
 */
export function callError(code: CallErrorCode, overrideMessage?: string): CallErrorInfo {
  const entry = CATALOG[code];
  return { code, severity: entry.severity, message: overrideMessage ?? entry.message };
}

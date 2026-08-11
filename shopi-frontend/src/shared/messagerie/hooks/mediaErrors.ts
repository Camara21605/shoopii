/**
 * src/shared/messagerie/hooks/mediaErrors.ts
 *
 * Traduit les erreurs getUserMedia()/getDisplayMedia() (DOMException) en
 * messages humains, sans jargon technique — partagé entre useAudioCall.ts
 * (1:1) et useGroupCall.ts (groupe) pour éviter de dupliquer ce mapping.
 *
 * Référence des noms d'exception : MDN MediaDevices.getUserMedia()
 * "Exceptions" — NotFoundError/NotAllowedError/NotReadableError/
 * OverconstrainedError/AbortError/SecurityError sont les cas réellement
 * observés en pratique sur les navigateurs actuels.
 */

export type MediaErrorReason =
  | 'not-found'       // aucun périphérique de ce type (absent/débranché)
  | 'not-allowed'     // permission refusée par l'utilisateur OU bloquée au niveau navigateur/OS
  | 'not-readable'    // périphérique déjà utilisé par une autre application/onglet
  | 'overconstrained' // aucun périphérique ne satisfait les contraintes demandées
  | 'aborted'         // action annulée (ex. fermeture de la boîte de sélection d'écran)
  | 'security'        // contexte non sécurisé ou accès bloqué par une politique de sécurité
  | 'unknown';

export interface MediaErrorInfo {
  reason:  MediaErrorReason;
  message: string; // prêt à afficher à l'utilisateur, jamais de nom d'exception/jargon
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * @param device Libellé humain du périphérique concerné, ex. "la caméra",
 *   "le microphone", "la caméra ou le microphone", "le partage d'écran".
 */
export function describeMediaError(err: unknown, device: string): MediaErrorInfo {
  const name = (err as { name?: string } | undefined)?.name;

  switch (name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { reason: 'not-found', message: `Aucun périphérique disponible pour ${device}.` };

    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return { reason: 'not-allowed', message: `Accès à ${device} refusé. Vérifiez les autorisations du navigateur.` };

    case 'NotReadableError':
    case 'TrackStartError':
      return { reason: 'not-readable', message: `${capitalize(device)} est déjà utilisé(e) par une autre application.` };

    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return { reason: 'overconstrained', message: `Aucun réglage compatible trouvé pour ${device}.` };

    case 'AbortError':
      return { reason: 'aborted', message: 'Opération annulée.' };

    case 'SecurityError':
      return { reason: 'security', message: `L'accès à ${device} est bloqué par les paramètres de sécurité du navigateur.` };

    default:
      return { reason: 'unknown', message: `Impossible d'accéder à ${device}.` };
  }
}

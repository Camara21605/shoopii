/**
 * src/shared/messagerie/hooks/deviceCapabilities.ts
 *
 * Détection des périphériques disponibles via enumerateDevices() — jamais
 * supposer qu'un appareil a plusieurs caméras/un micro/une caméra (partie 7).
 *
 * ⚠️ Avant la toute première autorisation getUserMedia() accordée par
 * l'utilisateur, les navigateurs renvoient des `label` vides et regroupent
 * parfois les périphériques différemment (labels vides = comptage moins
 * fiable, mais le NOMBRE d'entrées reste correct) — ces fonctions restent
 * donc utilisables avant ET après l'autorisation, la fiabilité du COMPTE
 * s'améliore juste après une 1ère autorisation accordée.
 */

async function countDevices(kind: MediaDeviceKind): Promise<number> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === kind).length;
  } catch {
    /* enumerateDevices() peut échouer (contexte non sécurisé, navigateur
       ancien) — traité comme "un seul périphérique, prudence" plutôt que
       de faire planter l'appelant. */
    return 1;
  }
}

export const hasCamera          = () => countDevices('videoinput').then(n => n > 0);
export const hasMicrophone      = () => countDevices('audioinput').then(n => n > 0);
export const hasMultipleCameras = () => countDevices('videoinput').then(n => n > 1);

/**
 * Messages vocaux — réglages communs aux conversations privées et de groupe.
 *
 * Le préréglage HIGH_QUALITY d'expo-audio enregistre un fichier .m4a (AAC),
 * dont le type officiel est « audio/mp4 ». L'application envoyait
 * « audio/m4a », refusé par le serveur : tous les vocaux échouaient.
 */
import { setAudioModeAsync } from 'expo-audio';

export const VOICE_FILE = { name: 'vocal.m4a', mimeType: 'audio/mp4' } as const;

/** Mode « enregistrement » pendant la prise de son… */
export function enterRecordingMode() {
  return setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
}

/** …puis retour au mode lecture : sans cela, la lecture des vocaux restait
 *  sur l'écouteur (son très faible) ou muette après un enregistrement. */
export async function exitRecordingMode() {
  try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch { /* sans conséquence */ }
}

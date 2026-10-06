/**
 * Remplaçant WEB de react-native-webrtc (branché par metro.config.js, pour la
 * plateforme web uniquement — Android/iOS utilisent la vraie bibliothèque).
 *
 * Pourquoi : la bibliothèque est native ; chargée dans le navigateur (aperçu
 * `npm run preview`, rendu web d'expo-router qui charge toutes les routes),
 * elle faisait planter TOUT l'aperçu (« requireNativeComponent is not a
 * function »). Ici les appels ne sont simplement pas disponibles : tout
 * démarrage d'appel échoue proprement avec un message clair.
 */
const UNAVAILABLE = 'Les appels audio et vidéo sont disponibles dans l’application Android.';

class Unavailable {
  constructor() {
    throw new Error(UNAVAILABLE);
  }
}

export const RTCPeerConnection = Unavailable;
export const RTCIceCandidate = Unavailable;
export const RTCSessionDescription = Unavailable;
export type MediaStream = { getTracks: () => { stop: () => void }[] };

export const mediaDevices = {
  getUserMedia: async (): Promise<never> => {
    throw new Error(UNAVAILABLE);
  },
};

export function registerGlobals() {}

/** Vue vidéo : rien à afficher dans le navigateur. */
export function RTCView() {
  return null;
}
export function ScreenCapturePickerView() {
  return null;
}

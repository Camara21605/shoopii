/* ============================================================
 * FICHIER : src/shared/location/utils/bestGpsFix.ts
 *
 * RÔLE : Obtenir la position la PLUS PRÉCISE possible en quelques secondes.
 *
 * Un seul getCurrentPosition() renvoie souvent le premier relevé, le plus
 * grossier (antennes / Wi-Fi, parfois à plusieurs km), avant que le GPS du
 * téléphone n'ait accroché. On écoute donc plusieurs relevés (watchPosition)
 * et on garde le meilleur, jusqu'à une bonne précision ou l'expiration du délai.
 * Même principe que LocationPermission (inscription).
 * ============================================================ */

export interface GpsFix { latitude: number; longitude: number; accuracy: number }

export type GpsFixError = 'unsupported' | 'denied' | 'unavailable';

interface Options {
  /** Précision (m) jugée suffisante : on s'arrête dès qu'elle est atteinte. */
  goodAccuracyM?: number;
  /** Durée maximale d'écoute (ms). */
  maxMs?: number;
  /** Chaque amélioration de précision (affichage en direct). */
  onProgress?: (fix: GpsFix) => void;
}

/** Promesse + `cancel()` (fermeture de la fenêtre pendant la recherche). */
export function getBestGpsFix(
  { goodAccuracyM = 30, maxMs = 20_000, onProgress }: Options = {},
): { promise: Promise<GpsFix>; cancel: () => void } {
  let cancel = () => {};
  const promise = new Promise<GpsFix>((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject('unsupported' as GpsFixError); return; }

    let best: GpsFix | null = null;
    let done = false;
    const finish = (err?: GpsFixError) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (best) resolve(best); else reject(err ?? 'unavailable');
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!best || accuracy < best.accuracy) {    // ne jamais régresser vers un relevé moins précis
          best = { latitude, longitude, accuracy };
          onProgress?.(best);
        }
        if (accuracy <= goodAccuracyM) finish();
      },
      (err) => {
        /* Erreur après un relevé exploitable : on garde ce relevé */
        if (best) { finish(); return; }
        if (err.code === err.PERMISSION_DENIED) finish('denied');
        /* TIMEOUT / POSITION_UNAVAILABLE : watchPosition réessaie tout seul jusqu'à maxMs */
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxMs },
    );
    const timer = setTimeout(() => finish('unavailable'), maxMs);
    cancel = () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
    };
  });
  return { promise, cancel: () => cancel() };
}

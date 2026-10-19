/**
 * Calculs du guidage (écran Itinéraire) : où suis-je sur le tracé, combien
 * reste-t-il, quelle est la prochaine manœuvre, ai-je quitté la route ?
 * Purement géométrique — testable sans téléphone (nav-math.test.ts).
 */
import type { RouteResult, RouteStep } from './api';

export type LatLng = [number, number];

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance en mètres entre deux points [lat, lng]. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Cap (0 = nord, sens horaire) de a vers b, en degrés. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Distance d'un point P au segment [A, B] (projection locale, précise à l'échelle d'une ville). */
function toSegment(p: LatLng, a: LatLng, b: LatLng): { d: number; t: number } {
  const k = Math.cos(rad(p[0]));
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const proj: LatLng = [ay + t * dy, (ax + t * dx) / k];
  return { d: haversine(p, proj), t };
}

/** Tracé préparé : distances cumulées et position de chaque manœuvre sur le tracé. */
export interface PreparedRoute {
  line: LatLng[];
  /** cum[i] = distance (m) du départ au point i. */
  cum: number[];
  /** Index du point du tracé le plus proche de chaque étape. */
  stepAt: number[];
  steps: RouteStep[];
  totalM: number;
  totalS: number;
}

export function prepareRoute(r: RouteResult): PreparedRoute {
  const line = r.polyline as LatLng[];
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + haversine(line[i - 1], line[i]));
  const totalM = cum[cum.length - 1] || r.totalDistanceM;
  const stepAt = r.steps.map((s) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < line.length; i++) {
      const d = haversine(s.at as LatLng, line[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  });
  return { line, cum, stepAt, steps: r.steps, totalM, totalS: r.totalDurationS };
}

export interface NavProgress {
  /** Distance au tracé (m) — au-delà de ~50 m, on recalcule l'itinéraire. */
  offRouteM: number;
  /** Distance (m) parcourue le long du tracé. */
  doneM: number;
  remainingM: number;
  remainingS: number;
  /** Prochaine manœuvre (null : il ne reste que la ligne droite jusqu'à l'arrivée). */
  next: RouteStep | null;
  /** Distance (m) jusqu'à la prochaine manœuvre. */
  toNextM: number;
  /** Manœuvre suivante, pour « Puis … ». */
  then: RouteStep | null;
}

export function progress(route: PreparedRoute, me: LatLng): NavProgress {
  const { line, cum } = route;
  let bestI = 0, bestD = Infinity, bestT = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const { d, t } = toSegment(me, line[i], line[i + 1]);
    if (d < bestD) { bestD = d; bestI = i; bestT = t; }
  }
  if (line.length < 2) bestD = line.length ? haversine(me, line[0]) : 0;
  const segLen = line.length > 1 ? cum[bestI + 1] - cum[bestI] : 0;
  const doneM = (cum[bestI] ?? 0) + bestT * segLen;
  const remainingM = Math.max(0, route.totalM - doneM);
  const remainingS = route.totalM > 0 ? (route.totalS * remainingM) / route.totalM : 0;

  /* Prochaine manœuvre : la première située devant moi (au-delà de ma position sur le tracé). */
  let k = -1;
  for (let i = 0; i < route.steps.length; i++) {
    if (route.steps[i].maneuver === 'depart') continue;
    if (cum[route.stepAt[i]] > doneM + 5) { k = i; break; }
  }
  const next = k >= 0 ? route.steps[k] : null;
  const toNextM = k >= 0 ? Math.max(0, cum[route.stepAt[k]] - doneM) : remainingM;
  const then = k >= 0 && k + 1 < route.steps.length ? route.steps[k + 1] : null;
  return { offRouteM: bestD, doneM, remainingM, remainingS, next, toNextM, then };
}

/** « 350 m », « 1,2 km » — arrondis comme Google Maps. */
export function fmtDistance(m: number): string {
  if (m < 50) return `${Math.max(0, Math.round(m / 5) * 5)} m`;
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0).replace('.', ',')} km`;
}

/** « 8 min », « 1 h 05 ». */
export function fmtDuration(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, '0')}`;
}

/** Heure d'arrivée « 14:35 ». */
export function fmtEta(s: number, now = Date.now()): string {
  const d = new Date(now + s * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

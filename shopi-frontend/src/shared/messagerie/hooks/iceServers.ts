/**
 * src/shared/messagerie/hooks/iceServers.ts
 *
 * Serveurs ICE (STUN + TURN) pour RTCPeerConnection, partagés entre
 * useAudioCall.ts (1:1) et useGroupCall.ts (mesh de groupe).
 *
 * Les identifiants TURN viennent désormais de GET /calls/ice-servers
 * (la clé API Metered.ca reste côté serveur, jamais exposée au bundle
 * frontend — contrairement à l'ancienne approche VITE_TURN_* en dur
 * au build). Résultat mis en cache en mémoire (30 min) pour éviter un
 * aller-retour réseau à chaque appel — CACHE_MS reste sous la durée de
 * vie des identifiants dynamiques (TURN_CREDENTIAL_TTL_S côté backend,
 * 1h) pour qu'un appel démarré avec le cache tout juste rafraîchi n'utilise
 * jamais un identifiant sur le point d'expirer. En cas de reprise ICE
 * (perte réseau, voir partie 5), getFreshIceServers() ci-dessous
 * contourne ce cache : la reprise est justement le moment où un
 * identifiant périmé est le plus susceptible d'avoir expiré.
 */

import { apiFetch } from '../../services/apiFetch';

const FALLBACK_STUN: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302'  },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const CACHE_MS = 30 * 60 * 1000;

let cache: { servers: RTCIceServer[]; fetchedAt: number } | null = null;
let inFlight: Promise<RTCIceServer[]> | null = null;

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const { iceServers } = await apiFetch<{ iceServers: RTCIceServer[] }>('/calls/ice-servers');
    cache = { servers: iceServers, fetchedAt: Date.now() };
    return iceServers;
  } catch {
    /* Backend/Metered indisponible — on retombe sur STUN seul (ou le dernier cache connu). */
    return cache?.servers ?? FALLBACK_STUN;
  } finally {
    inFlight = null;
  }
}

/**
 * Renvoie les serveurs ICE à utiliser, en réutilisant le cache tant qu'il est frais.
 *
 * GARDE-FOU : /calls/ice-servers est protégé par JwtAuthGuard. Sans vérifier
 * la présence d'un token ici, un visiteur anonyme (GlobalCallProvider monte
 * useAudioCall pour TOUTE l'appli, connecté ou non) déclencherait un 401 →
 * apiFetch traite tout 401 hors /login-/register comme "session expirée"
 * et fait un window.location.href = '/login' — un redirect forcé pour
 * n'importe quel visiteur non connecté, juste au chargement de la page.
 */
export function getIceServers(): Promise<RTCIceServer[]> {
  if (!localStorage.getItem('shopi_access_token')) return Promise.resolve(cache?.servers ?? FALLBACK_STUN);
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return Promise.resolve(cache.servers);
  if (!inFlight) inFlight = fetchIceServers();
  return inFlight;
}

/** Préchauffe le cache sans bloquer — à appeler au montage d'un hook d'appel. */
export function prefetchIceServers(): void {
  void getIceServers();
}

/**
 * Force un rafraîchissement (ignore le cache) — à utiliser uniquement pour
 * une reprise ICE (voir attemptIceRestart dans useAudioCall.ts/
 * useGroupCall.ts, partie 5) : c'est précisément le moment où les
 * identifiants TURN en cache ont le plus de chances d'avoir expiré (coupure
 * réseau prolongée, appel de longue durée) — une RTCPeerConnection déjà
 * créée garde les serveurs ICE fournis à sa construction, il faut donc les
 * ré-appliquer explicitement via pc.setConfiguration() avant de relancer
 * l'ICE, ce que le cache normal (30 min) ne garantit pas si le call a duré
 * plus longtemps que ça.
 */
export function getFreshIceServers(): Promise<RTCIceServer[]> {
  if (!localStorage.getItem('shopi_access_token')) return Promise.resolve(cache?.servers ?? FALLBACK_STUN);
  if (!inFlight) inFlight = fetchIceServers();
  return inFlight;
}

// ── Observabilité ICE (partie 6) ────────────────────────────────
//
// Journalise en console (jamais envoyé à un serveur, jamais persisté) des
// informations de connectivité NON sensibles — utile pour diagnostiquer un
// échec d'appel ("l'utilisateur est-il derrière un NAT nécessitant TURN ?")
// sans jamais exposer de secret/credential/token/JWT/donnée personnelle.
// `label` identifie la connexion dans les logs (ex. "1:1" ou "group:<userId>").

async function logActiveCandidateType(pc: RTCPeerConnection, label: string): Promise<void> {
  try {
    const stats = await pc.getStats();
    let pairId: string | undefined;
    stats.forEach(report => {
      if (report.type === 'transport' && report.selectedCandidatePairId) {
        pairId = report.selectedCandidatePairId as string;
      }
    });
    if (!pairId) {
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && !pairId) {
          pairId = report.id as string;
        }
      });
    }
    if (!pairId) return;

    const pair = stats.get(pairId) as { localCandidateId?: string } | undefined;
    const local = pair?.localCandidateId ? stats.get(pair.localCandidateId) as { candidateType?: string } | undefined : undefined;
    const kind = local?.candidateType; // 'host' | 'srflx' (STUN) | 'prflx' | 'relay' (TURN)
    const via = kind === 'relay' ? 'TURN (relay)'
      : kind === 'srflx' ? 'STUN (srflx)'
      : kind === 'host'  ? 'direct (host)'
      : kind ?? 'inconnu';
    console.info(`[ICE:${label}] connecté via ${via}`);
  } catch {
    /* getStats() best-effort — un échec ici ne doit jamais impacter l'appel. */
  }
}

/** À appeler juste après la création d'une RTCPeerConnection. */
export function watchIceConnectivity(pc: RTCPeerConnection, label: string): void {
  pc.addEventListener('iceconnectionstatechange', () => {
    console.debug(`[ICE:${label}] iceConnectionState=${pc.iceConnectionState}`);
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      void logActiveCandidateType(pc, label);
    } else if (pc.iceConnectionState === 'failed') {
      console.warn(`[ICE:${label}] négociation ICE échouée`);
    }
  });
  pc.addEventListener('icegatheringstatechange', () => {
    console.debug(`[ICE:${label}] iceGatheringState=${pc.iceGatheringState}`);
  });
}

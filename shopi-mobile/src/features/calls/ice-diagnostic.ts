/**
 * Diagnostic d'un appel qui reste sur « Connexion… ».
 *
 * Un appel WebRTC trouve un chemin réseau parmi des « candidats » :
 *   host   adresse locale (même Wi-Fi) — le navigateur la MASQUE (xxx.local),
 *          un téléphone Android ne peut pas la lire : inutilisable site ↔ appli ;
 *   srflx  adresse publique vue par STUN — échoue derrière la 4G/5G (NAT strict)
 *          et souvent entre deux appareils du même Wi-Fi ;
 *   relay  passage par le RELAIS (serveur TURN) — le seul qui marche partout.
 *
 * On note les types vus des deux côtés pendant l'appel ; en cas d'échec, on
 * dit POURQUOI au lieu d'un « réessayez » sans issue, et on l'envoie au
 * serveur (journal [CALL-DIAG]) pour que le problème soit visible.
 */
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api/client';

import type { RTCIceServerInit } from './api';

export type IceDiag = {
  turnConfigured: boolean;
  local: Set<string>;
  remote: Set<string>;
  lastState: string;
};

export const newIceDiag = (): IceDiag => ({ turnConfigured: false, local: new Set(), remote: new Set(), lastState: 'new' });

/** Type d'un candidat ICE (« … typ relay … » → relay). */
export function candidateType(candidate: string | undefined | null): string | null {
  const m = / typ (host|srflx|prflx|relay)\b/.exec(candidate ?? '');
  return m ? m[1] : null;
}

export function hasTurn(servers: RTCIceServerInit[]): boolean {
  return servers.some((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/i.test(u)));
}

/** Message clair pour la personne, selon ce qui a manqué. */
export function explainFailure(d: IceDiag): string {
  if (!d.turnConfigured) {
    return 'Connexion impossible : le relais d’appel n’est pas disponible. Les appels entre le site et un téléphone, ou entre deux réseaux différents, ne peuvent pas passer.';
  }
  if (!d.local.has('relay')) {
    return 'Connexion impossible : le relais d’appel ne répond pas. Réessayez dans un instant.';
  }
  if (d.remote.size === 0) {
    return 'Votre correspondant ne répond pas sur le réseau (connexion trop faible ?). Réessayez.';
  }
  return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
}

/** Envoie le diagnostic au serveur (journal) — ne lève jamais. */
export function reportIceFailure(d: IceDiag, direction: 'incoming' | 'outgoing'): void {
  void apiFetch('/calls/diagnostic', {
    method: 'POST',
    body: {
      platform: `mobile-${Platform.OS}`,
      direction,
      turnConfigured: d.turnConfigured,
      localTypes: [...d.local],
      remoteTypes: [...d.remote],
      lastState: d.lastState,
    },
  }).catch(() => undefined);
}

/* ============================================================
 * FICHIER : src/modules/presence/presence-token.util.ts
 *
 * Jeton signé que le TÉLÉPHONE présente, application fermée, pour dire
 * « j'ai internet » (POST /presence/device-ping). Il n'autorise RIEN d'autre :
 * pas de lecture, pas d'envoi, seulement rafraîchir l'état « joignable » de
 * SON propriétaire. HMAC-SHA256, clé dérivée de JWT_SECRET réservée à cet
 * usage. Deux durées :
 *   - jeton de l'appareil (gardé par l'application) : 60 jours, renouvelé à
 *     chaque ouverture de l'appli ;
 *   - jeton porté par une vérification (« es-tu là ? ») : 2 minutes.
 * ============================================================ */

import { createHmac, timingSafeEqual } from 'crypto';

export const DEVICE_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
export const PROBE_TOKEN_TTL_MS  = 2 * 60 * 1000;

export interface PresenceClaims {
  /** users.id du propriétaire du téléphone */
  u: string;
  /** Identifiant de la vérification (jeton de vérification seulement) */
  p?: string;
}

function key(secret: string): Buffer {
  return createHmac('sha256', secret || 'no-secret').update('presence-device-v1').digest();
}

export function signPresence(claims: PresenceClaims, secret: string, ttlMs: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...claims, e: now + ttlMs })).toString('base64url');
  const sig = createHmac('sha256', key(secret)).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Droits du jeton s'il est authentique et non expiré, sinon null. Ne lève jamais. */
export function verifyPresence(token: unknown, secret: string, now = Date.now()): PresenceClaims | null {
  if (typeof token !== 'string' || token.length > 600) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', key(secret)).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof d.e !== 'number' || now > d.e) return null;
    if (typeof d.u !== 'string' || !d.u || d.u.length > 64) return null;
    if (d.p !== undefined && (typeof d.p !== 'string' || d.p.length > 64)) return null;
    return d.p ? { u: d.u, p: d.p } : { u: d.u };
  } catch {
    return null;
  }
}

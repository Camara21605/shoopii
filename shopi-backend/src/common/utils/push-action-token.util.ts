/* ============================================================
 * FICHIER : src/common/utils/push-action-token.util.ts
 *
 * Jeton signé porté par une notification de message sur le téléphone, pour
 * les boutons « Répondre » et « Marquer comme lu » utilisés SANS ouvrir
 * l'application (le téléphone n'a alors ni session ni jeton de connexion).
 *
 * Le jeton n'autorise QUE : répondre en texte / marquer lue UNE conversation,
 * au nom de SON destinataire, pendant PUSH_ACTION_TTL_MS. HMAC-SHA256 avec une
 * clé dérivée de JWT_SECRET réservée à cet usage.
 * ============================================================ */

import { createHmac, timingSafeEqual } from 'crypto';

export const PUSH_ACTION_TTL_MS = 3 * 24 * 60 * 60 * 1000;   // 3 jours

export interface PushActionClaims {
  /** Conversation */
  c: string;
  /** Utilisateur destinataire (users.id) */
  u: string;
  /** Type d'acteur destinataire (client, company…) */
  t: string;
  /** Profil destinataire */
  i: string;
}

function key(secret: string): Buffer {
  return createHmac('sha256', secret || 'no-secret').update('msg-push-action-v1').digest();
}

export function signPushAction(claims: PushActionClaims, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...claims, e: now + PUSH_ACTION_TTL_MS })).toString('base64url');
  const sig = createHmac('sha256', key(secret)).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Renvoie les droits du jeton s'il est authentique et non expiré, sinon null. Ne lève jamais. */
export function verifyPushAction(token: unknown, secret: string, now = Date.now()): PushActionClaims | null {
  if (typeof token !== 'string' || token.length > 1000) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', key(secret)).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof d.e !== 'number' || now > d.e) return null;
    if (![d.c, d.u, d.t, d.i].every(v => typeof v === 'string' && v.length > 0 && v.length < 100)) return null;
    return { c: d.c, u: d.u, t: d.t, i: d.i };
  } catch {
    return null;
  }
}

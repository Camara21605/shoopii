/* ============================================================
 * FICHIER : src/modules/call/turn-probe.util.ts
 *
 * RÔLE : vérifier pour de VRAI que le relais TURN accepte nos
 *        identifiants — pas seulement qu'ils sont « configurés ».
 *
 * Symptôme visé : un appel qui sonne, est accepté, puis reste sur
 * « Connexion… ». Entre deux téléphones en 4G (NAT stricts) le son
 * ne passe QUE par le relais ; s'il refuse les identifiants (mauvais
 * hôte, identifiant expiré, quota Metered épuisé), rien ne s'affiche
 * côté serveur — la sonde le dit en une requête.
 *
 * Protocole (RFC 5766 / 5389), en TCP pour passer partout :
 *   1. Allocate sans authentification → 401 + REALM + NONCE ;
 *   2. Allocate authentifié (MESSAGE-INTEGRITY, clé MD5) → succès
 *      (adresse relayée attribuée) ou code d'erreur explicite ;
 *   3. Refresh LIFETIME=0 : libère aussitôt l'allocation (pas de
 *      consommation du quota).
 * ============================================================ */

import { createHash, createHmac, randomBytes } from 'crypto';
import { connect, type Socket } from 'net';

const MAGIC = 0x2112a442;
const T = {
  ALLOCATE: 0x0003, ALLOCATE_OK: 0x0103, ALLOCATE_ERR: 0x0113,
  REFRESH: 0x0004,
} as const;
const A = {
  USERNAME: 0x0006, MESSAGE_INTEGRITY: 0x0008, ERROR_CODE: 0x0009, LIFETIME: 0x000d,
  REALM: 0x0014, NONCE: 0x0015, XOR_RELAYED_ADDRESS: 0x0016, REQUESTED_TRANSPORT: 0x0019,
} as const;

export type TurnProbeResult =
  | { ok: true; ms: number }
  | { ok: false; ms: number; stage: 'connect' | 'challenge' | 'auth'; error: string; code?: number };

type Attr = { type: number; value: Buffer };

function attr(type: number, value: Buffer): Buffer {
  const pad = (4 - (value.length % 4)) % 4;
  const head = Buffer.alloc(4);
  head.writeUInt16BE(type, 0);
  head.writeUInt16BE(value.length, 2);
  return Buffer.concat([head, value, Buffer.alloc(pad)]);
}

function header(type: number, length: number, txId: Buffer): Buffer {
  const h = Buffer.alloc(20);
  h.writeUInt16BE(type, 0);
  h.writeUInt16BE(length, 2);
  h.writeUInt32BE(MAGIC, 4);
  txId.copy(h, 8);
  return h;
}

/** Message STUN ; avec `key`, ajoute MESSAGE-INTEGRITY (HMAC-SHA1 sur le message, longueur l'incluant). */
export function buildMessage(type: number, attrs: Buffer[], key?: Buffer): Buffer {
  const txId = randomBytes(12);
  const body = Buffer.concat(attrs);
  if (!key) return Buffer.concat([header(type, body.length, txId), body]);
  const withMiLen = header(type, body.length + 24, txId);
  const mac = createHmac('sha1', key).update(Buffer.concat([withMiLen, body])).digest();
  return Buffer.concat([withMiLen, body, attr(A.MESSAGE_INTEGRITY, mac)]);
}

export function parseMessage(buf: Buffer): { type: number; attrs: Attr[] } {
  const type = buf.readUInt16BE(0);
  const len = buf.readUInt16BE(2);
  const attrs: Attr[] = [];
  let o = 20;
  while (o + 4 <= 20 + len && o + 4 <= buf.length) {
    const t = buf.readUInt16BE(o);
    const l = buf.readUInt16BE(o + 2);
    attrs.push({ type: t, value: buf.subarray(o + 4, o + 4 + l) });
    o += 4 + l + ((4 - (l % 4)) % 4);
  }
  return { type, attrs };
}

export function errorCodeOf(attrs: Attr[]): { code: number; reason: string } | null {
  const e = attrs.find((a) => a.type === A.ERROR_CODE)?.value;
  if (!e || e.length < 4) return null;
  return { code: (e[2] & 0x7) * 100 + e[3], reason: e.subarray(4).toString('utf8') };
}

/** Lit des messages STUN entiers sur un flux TCP (en-tête de 20 octets + longueur). */
function reader(sock: Socket) {
  let buf = Buffer.alloc(0);
  const waiting: ((b: Buffer) => void)[] = [];
  const pump = () => {
    while (waiting.length && buf.length >= 20) {
      const total = 20 + buf.readUInt16BE(2);
      if (buf.length < total) return;
      const msg = buf.subarray(0, total);
      buf = buf.subarray(total);
      waiting.shift()!(msg);
    }
  };
  sock.on('data', (d: Buffer) => { buf = Buffer.concat([buf, d]); pump(); });
  return () => new Promise<Buffer>((resolve) => { waiting.push(resolve); pump(); });
}

const requestedUdp = () => attr(A.REQUESTED_TRANSPORT, Buffer.from([17, 0, 0, 0]));

/** Tente une allocation TURN réelle. Ne lève jamais ; `timeoutMs` couvre tout l'échange. */
export async function probeTurn(host: string, port: number, username: string, password: string, timeoutMs = 6000): Promise<TurnProbeResult> {
  const t0 = Date.now();
  const ms = () => Date.now() - t0;
  let stage: 'connect' | 'challenge' | 'auth' = 'connect';
  const sock = connect({ host, port });
  sock.setNoDelay(true);
  const next = reader(sock);

  const run = async (): Promise<TurnProbeResult> => {
    await new Promise<void>((resolve, reject) => { sock.once('connect', resolve); sock.once('error', reject); });

    stage = 'challenge';
    sock.write(buildMessage(T.ALLOCATE, [requestedUdp()]));
    const first = parseMessage(await next());
    const realm = first.attrs.find((a) => a.type === A.REALM)?.value;
    const nonce = first.attrs.find((a) => a.type === A.NONCE)?.value;
    const err1 = errorCodeOf(first.attrs);
    if (first.type !== T.ALLOCATE_ERR || err1?.code !== 401 || !realm || !nonce) {
      return { ok: false, ms: ms(), stage, error: `réponse inattendue du relais (${err1 ? `${err1.code} ${err1.reason}` : `type 0x${first.type.toString(16)}`})`, code: err1?.code };
    }

    stage = 'auth';
    const key = createHash('md5').update(`${username}:${realm.toString('utf8')}:${password}`).digest();
    const authAttrs = [attr(A.USERNAME, Buffer.from(username, 'utf8')), attr(A.REALM, realm), attr(A.NONCE, nonce)];
    sock.write(buildMessage(T.ALLOCATE, [requestedUdp(), ...authAttrs], key));
    const second = parseMessage(await next());
    if (second.type === T.ALLOCATE_OK && second.attrs.some((a) => a.type === A.XOR_RELAYED_ADDRESS)) {
      /* Libère tout de suite l'allocation (LIFETIME 0) — sans attendre la réponse. */
      const zero = Buffer.alloc(4);
      sock.write(buildMessage(T.REFRESH, [attr(A.LIFETIME, zero), ...authAttrs], key));
      return { ok: true, ms: ms() };
    }
    const err2 = errorCodeOf(second.attrs);
    return { ok: false, ms: ms(), stage, error: err2 ? `${err2.code} ${err2.reason}`.trim() : `type 0x${second.type.toString(16)}`, code: err2?.code };
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<TurnProbeResult>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, ms: ms(), stage, error: `délai dépassé (${timeoutMs} ms)` }), timeoutMs);
      }),
    ]);
  } catch (e) {
    return { ok: false, ms: ms(), stage, error: (e as Error).message };
  } finally {
    if (timer) clearTimeout(timer);
    setTimeout(() => sock.destroy(), 200).unref?.();
  }
}

/** Explication en clair d'un échec, pour la personne qui regarde /health/calls. */
export function explainProbe(r: TurnProbeResult): string {
  if (r.ok) return 'Le relais accepte les identifiants : les appels 4G ↔ 4G et site ↔ téléphone peuvent passer.';
  if (r.stage === 'connect') return 'Relais injoignable : METERED_TURN_HOST est sans doute faux (il faut l’hôte TURN, ex. global.relay.metered.ca, pas le domaine du tableau de bord *.metered.live).';
  if (r.code === 401) return 'Identifiants TURN refusés : METERED_TURN_USERNAME / METERED_TURN_CREDENTIAL faux ou supprimés, ou METERED_TURN_SECRET utilisé alors que Metered n’accepte pas ce mode.';
  if (r.code === 486) return 'Quota du relais atteint (trop d’allocations) : vérifiez l’offre Metered.';
  if (r.code === 508 || r.code === 403) return 'Le relais refuse l’allocation (quota de données Metered épuisé ou compte suspendu).';
  return 'Le relais ne répond pas correctement : voir le détail de l’erreur.';
}

/** Identifiants TURN tels qu'envoyés aux clients (même logique que CallService.getIceServers). */
export function resolveTurnCredentials(get: (k: string) => string | undefined, ttlS = 3600):
  { host: string; username: string; credential: string; mode: 'ephemeral' | 'static' } | null {
  const host = get('METERED_TURN_HOST')?.trim();
  if (!host) return null;
  const secret = get('METERED_TURN_SECRET');
  if (secret) {
    const username = `${Math.floor(Date.now() / 1000) + ttlS}:shopi`;
    return { host, username, credential: createHmac('sha1', secret).update(username).digest('base64'), mode: 'ephemeral' };
  }
  const username = get('METERED_TURN_USERNAME');
  const credential = get('METERED_TURN_CREDENTIAL');
  return username && credential ? { host, username, credential, mode: 'static' } : null;
}

/** Derniers échecs d'appel signalés par les clients (sans identité) — lus par /health/calls. */
export const CALL_DIAG_KEY = 'calls:diag:recent';

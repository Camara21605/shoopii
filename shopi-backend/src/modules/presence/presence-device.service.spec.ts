import { PresenceService, REACH_TTL_S } from '../messagerie/services/presence.service';
import { PresenceDeviceService, PROBE_TIMEOUT_MS } from './presence-device.service';
import { DEVICE_TOKEN_TTL_MS, signPresence } from './presence-token.util';

const SECRET = 'test-secret';
const USER = '11111111-1111-1111-1111-111111111111';
const VIEWER = '22222222-2222-2222-2222-222222222222';

/** Redis en mémoire : juste ce qu'utilisent PresenceService et la vérification. */
function fakeRedis() {
  const kv = new Map<string, string>();
  return {
    kv,
    async mget(...keys: string[]) { return keys.map(k => kv.get(k) ?? null); },
    async get(k: string) { return kv.get(k) ?? null; },
    async setex(k: string, _ttl: number, v: string) { kv.set(k, v); return 'OK'; },
    async del(k: string) { kv.delete(k); return 1; },
    async set(k: string, v: string, ..._args: unknown[]) { if (kv.has(k)) return null; kv.set(k, v); return 'OK'; },
    pipeline() {
      const ops: string[][] = [];
      const p = {
        mget: (...keys: string[]) => { ops.push(keys); return p; },
        exec: async () => ops.map(keys => [null, keys.map(k => kv.get(k) ?? null)]),
      };
      return p;
    },
  };
}

function build(opts: { tokens?: string[]; status?: string } = {}) {
  const redis = fakeRedis();
  const presence = new PresenceService(redis as never);
  const broadcast = { presenceChanged: jest.fn() };
  const fcm = { isEnabled: () => true, sendData: jest.fn().mockResolvedValue({ ok: true }) };
  const db = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM users')) return [{ status: opts.status ?? 'active' }];
      if (sql.includes('FROM conversations')) return [{ uid: VIEWER }];
      return [];
    }),
  };
  const svc = new PresenceDeviceService(
    presence,
    broadcast as never,
    { getOrCreate: jest.fn().mockResolvedValue({ pushTokens: (opts.tokens ?? ['fcm-1']).map(token => ({ token, platform: 'android' })) }) } as never,
    fcm as never,
    { apiBase: () => 'https://api.shoneya.com/api' } as never,
    { resolveNotificationRecipient: jest.fn().mockResolvedValue({ type: 'client', id: 'c-1' }) } as never,
    { get: () => SECRET } as never,
    db as never,
    redis as never,
  );
  return { svc, presence, broadcast, fcm, redis };
}

describe('Présence à trois états', () => {
  afterEach(() => jest.useRealTimers());

  it('jeton valide : « joignable », les contacts sont prévenus une fois', async () => {
    const { svc, presence, broadcast } = build();
    const token = signPresence({ u: USER }, SECRET, DEVICE_TOKEN_TTL_MS);

    expect(await svc.devicePing(token)).toBe(true);
    expect(PresenceService.statusOf(await presence.getPresence(USER))).toBe('reachable');
    expect(broadcast.presenceChanged).toHaveBeenCalledWith([VIEWER], expect.objectContaining({ userId: USER, status: 'reachable', online: false }));

    await svc.devicePing(token);
    expect(broadcast.presenceChanged).toHaveBeenCalledTimes(1); // déjà joignable : rien de nouveau
  });

  it('faux jeton, compte inactif ou plus de téléphone : rien ne change', async () => {
    const a = build();
    expect(await a.svc.devicePing('faux.jeton')).toBe(false);

    const b = build({ status: 'suspended' });
    expect(await b.svc.devicePing(signPresence({ u: USER }, SECRET, DEVICE_TOKEN_TTL_MS))).toBe(false);

    const c = build({ tokens: [] });
    expect(await c.svc.devicePing(signPresence({ u: USER }, SECRET, DEVICE_TOKEN_TTL_MS))).toBe(false);
    expect(PresenceService.statusOf(await c.presence.getPresence(USER))).toBe('offline');
  });

  it('dans l’appli : « en ligne » prime sur « joignable »', async () => {
    const { presence } = build();
    const p = (presence as unknown as { merge: (a: string, b: null, c: string) => unknown }).merge(
      JSON.stringify({ online: true, lastSeen: new Date().toISOString(), sockets: 1 }), null, new Date().toISOString(),
    );
    expect(PresenceService.statusOf(p as never)).toBe('online');
  });

  it('signe trop ancien : « hors ligne », vu à la dernière activité', () => {
    const { presence } = build();
    const old = new Date(Date.now() - (REACH_TTL_S + 60) * 1000).toISOString();
    const seen = new Date(Date.now() - 3_600_000).toISOString();
    const p = (presence as unknown as { merge: (a: null, b: string, c: string) => { status: string; lastSeen: string } }).merge(null, seen, old);
    expect(p.status).toBe('offline');
    expect(p.lastSeen).toBe(seen);
  });

  it('vérification sans réponse : repasse « hors ligne » et prévient', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const { svc, presence, broadcast, fcm, redis } = build();
    // joignable depuis 5 min (assez ancien pour être vérifié)
    redis.kv.set(`presence:reach:${USER}`, new Date(Date.now() - 5 * 60_000).toISOString());

    const res = await svc.probe(VIEWER, [USER]);
    expect(res[USER]).toEqual(expect.objectContaining({ status: 'reachable', checking: true }));
    expect(fcm.sendData).toHaveBeenCalledWith('fcm-1', expect.objectContaining({ kind: 'presence.ping' }), expect.objectContaining({ ttlSeconds: 20 }));

    jest.advanceTimersByTime(PROBE_TIMEOUT_MS + 10);
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));
    expect(PresenceService.statusOf(await presence.getPresence(USER))).toBe('offline');
    expect(broadcast.presenceChanged).toHaveBeenCalledWith([VIEWER], expect.objectContaining({ status: 'offline' }));
  });

  it('vérification : pas deux fois par minute pour la même personne', async () => {
    const { svc, fcm } = build();
    await svc.probe(VIEWER, [USER]);
    await svc.probe(VIEWER, [USER]);
    expect(fcm.sendData).toHaveBeenCalledTimes(1);
    svc.onModuleDestroy();
  });
});

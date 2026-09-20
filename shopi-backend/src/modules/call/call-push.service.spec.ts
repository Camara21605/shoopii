/* ============================================================
 * FICHIER : src/modules/call/call-push.service.spec.ts
 * Tests unitaires du push d'appel entrant (application fermée) :
 * jeton de refus signé + respect des réglages + contenu du push.
 * ============================================================ */

import { CallPushService, CALL_PUSH_TTL_S, RING_REPEAT_INTERVAL_MS, RING_REPEAT_MAX } from './call-push.service';

const CONFIG: Record<string, string> = {
  JWT_SECRET: 'secret-de-test-assez-long-pour-hmac-0123456789',
  RENDER_EXTERNAL_URL: 'https://api.exemple.test',
};

function build(overrides: {
  enabled?: boolean; globalPush?: boolean; dnd?: boolean;
  tokens?: { token: string; platform: string }[];
  send?: jest.Mock; config?: Record<string, string>;
} = {}) {
  const send = overrides.send ?? jest.fn().mockResolvedValue({ ok: true });
  const webPush = {
    isEnabled: () => overrides.enabled ?? true,
    parseSubscription: (t: string) => (t.startsWith('sub:') ? { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } } : null),
    send,
  };
  const prefs = {
    getOrCreate: jest.fn().mockResolvedValue({
      globalPushEnabled: overrides.globalPush ?? true,
      dndEnabled: overrides.dnd ?? false,
      pushTokens: overrides.tokens ?? [{ token: 'sub:1', platform: 'web' }],
    }),
    removeToken: jest.fn().mockResolvedValue(undefined),
  };
  const callService = {
    resolveNotificationRecipient: jest.fn().mockResolvedValue({ type: 'client', id: 'actor-1' }),
    findCallById: jest.fn().mockResolvedValue({ id: 'x', status: 'ringing' }),
  };
  const config = { get: (k: string) => (overrides.config ?? CONFIG)[k] };
  const svc = new CallPushService(webPush as any, prefs as any, callService as any, config as any);
  return { svc, send, prefs, callService };
}

const CALL = {
  calleeUserId: 'callee-1', callId: '11111111-2222-3333-4444-555555555555', conversationId: 'conv-1',
  callerUserId: 'caller-1', callerName: 'Fatoumata', callerAvatar: 'https://img.test/a.png', callType: 'audio' as const,
};

describe('CallPushService — jeton de refus signé', () => {
  it('un jeton authentique est accepté et identifie l\'appel + le destinataire', () => {
    const { svc } = build();
    const proof = svc.verifyRejectToken(svc.signRejectToken('call-1', 'user-1'));
    expect(proof).toEqual({ callId: 'call-1', calleeUserId: 'user-1' });
  });

  it('un jeton falsifié (corps modifié) est REFUSÉ', () => {
    const { svc } = build();
    const [body, sig] = svc.signRejectToken('call-1', 'user-1').split('.');
    const forged = Buffer.from(JSON.stringify({ c: 'call-AUTRE', u: 'user-1', e: Date.now() + 60_000 })).toString('base64url');
    expect(svc.verifyRejectToken(`${forged}.${sig}`)).toBeNull();
    expect(svc.verifyRejectToken(`${body}.${sig}x`)).toBeNull();
  });

  it('un jeton signé avec une AUTRE clé est REFUSÉ', () => {
    const a = build().svc;
    const b = build({ config: { ...CONFIG, JWT_SECRET: 'une-autre-cle-secrete-tout-a-fait-differente-987' } }).svc;
    expect(b.verifyRejectToken(a.signRejectToken('call-1', 'user-1'))).toBeNull();
  });

  it('un jeton expiré est REFUSÉ', () => {
    const { svc } = build();
    const token = svc.signRejectToken('call-1', 'user-1');
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + (CALL_PUSH_TTL_S + 1) * 1000;
      expect(svc.verifyRejectToken(token)).toBeNull();
    } finally { Date.now = realNow; }
  });

  it('des valeurs absurdes ne lèvent jamais d\'exception', () => {
    const { svc } = build();
    for (const bad of ['', 'abc', '.', 'a.b', 'x'.repeat(2000), undefined as any, null as any, 42 as any]) {
      expect(svc.verifyRejectToken(bad)).toBeNull();
    }
  });
});

describe('CallPushService — notifyIncoming', () => {
  it('envoie un push URGENT, court (45 s), regroupé par appel, avec le jeton de refus', async () => {
    const { svc, send } = build();
    await svc.notifyIncoming(CALL);

    expect(send).toHaveBeenCalledTimes(1);
    const [, payload, urgent, options] = send.mock.calls[0];
    expect(urgent).toBe(true);
    expect(options).toEqual({ ttlSeconds: CALL_PUSH_TTL_S, topic: '11111111222233334444555555555555' });
    expect(payload).toMatchObject({ title: 'Fatoumata', body: 'Appel audio entrant', type: 'call.incoming', tag: `call:${CALL.callId}` });
    expect(payload.data).toMatchObject({ callId: CALL.callId, conversationId: 'conv-1', callerUserId: 'caller-1', callType: 'audio' });
    expect(payload.data.rejectUrl).toBe('https://api.exemple.test/api/calls/push-reject');
    expect(svc.verifyRejectToken(payload.data.rejectToken)).toEqual({ callId: CALL.callId, calleeUserId: 'callee-1' });
  });

  it('appel vidéo → libellé « vidéo »', async () => {
    const { svc, send } = build();
    await svc.notifyIncoming({ ...CALL, callType: 'video' });
    expect(send.mock.calls[0][1].body).toBe('Appel vidéo entrant');
  });

  it('sans URL publique de l\'API : pas de bouton de refus possible (pas de jeton)', async () => {
    const { svc, send } = build({ config: { JWT_SECRET: CONFIG.JWT_SECRET } });
    await svc.notifyIncoming(CALL);
    expect(send.mock.calls[0][1].data.rejectToken).toBeUndefined();
    expect(send.mock.calls[0][1].data.rejectUrl).toBeUndefined();
  });

  it.each([
    ['push désactivé côté serveur (pas de clés VAPID)', { enabled: false }],
    ['notifications push coupées par l\'utilisateur', { globalPush: false }],
    ['mode « ne pas déranger » actif', { dnd: true }],
    ['aucun appareil web enregistré', { tokens: [] }],
    ['uniquement des appareils natifs', { tokens: [{ token: 'x', platform: 'android' }] }],
  ])('AUCUN push si : %s', async (_label, over) => {
    const { svc, send } = build(over as any);
    await svc.notifyIncoming(CALL);
    expect(send).not.toHaveBeenCalled();
  });

  it('un appareil expiré (404/410) est retiré du compte', async () => {
    const { svc, prefs } = build({ send: jest.fn().mockResolvedValue({ ok: false, gone: true }) });
    await svc.notifyIncoming(CALL);
    expect(prefs.removeToken).toHaveBeenCalledWith('client', 'actor-1', { token: 'sub:1' });
  });

  it('une erreur d\'envoi ne remonte JAMAIS (ne doit pas faire échouer l\'appel)', async () => {
    const { svc } = build({ send: jest.fn().mockRejectedValue(new Error('réseau')) });
    await expect(svc.notifyIncoming(CALL)).resolves.toBeUndefined();
  });
});

describe('CallPushService — notifyEnded', () => {
  it('envoie un push « fin d\'appel » de même tag pour fermer la notification', async () => {
    const { svc, send } = build();
    await svc.notifyEnded('callee-1', CALL.callId);
    expect(send.mock.calls[0][1]).toMatchObject({ type: 'call.ended', tag: `call:${CALL.callId}` });
  });

  it('respecte aussi les réglages (aucun push si coupé)', async () => {
    const { svc, send } = build({ globalPush: false });
    await svc.notifyEnded('callee-1', CALL.callId);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('CallPushService — sonnerie répétée (le téléphone sonne de nouveau toutes les 6 s)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const advance = async (ms: number) => { await jest.advanceTimersByTimeAsync(ms); };

  it("renvoie la notification tant que l'appel sonne, puis s'arrête au plafond", async () => {
    const { svc, send } = build();
    await svc.notifyIncoming(CALL);
    expect(send).toHaveBeenCalledTimes(1);

    await advance(RING_REPEAT_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(2);
    await advance(RING_REPEAT_INTERVAL_MS * (RING_REPEAT_MAX + 3));
    expect(send).toHaveBeenCalledTimes(1 + RING_REPEAT_MAX);   // ne sonne pas indéfiniment
  });

  it('chaque renvoi porte le MÊME tag (un seul bandeau) mais un jeton de refus valide', async () => {
    const { svc, send } = build();
    await svc.notifyIncoming(CALL);
    await advance(RING_REPEAT_INTERVAL_MS);
    const first = send.mock.calls[0][1], second = send.mock.calls[1][1];
    expect(second.tag).toBe(first.tag);
    expect(svc.verifyRejectToken(second.data.rejectToken)).toEqual({ callId: CALL.callId, calleeUserId: 'callee-1' });
  });

  it("s'arrête dès que l'appel est décroché / refusé / annulé (notifyEnded)", async () => {
    const { svc, send } = build();
    await svc.notifyIncoming(CALL);
    await svc.notifyEnded('callee-1', CALL.callId);   // 1 envoi initial + 1 « fin d'appel »
    const after = send.mock.calls.length;
    await advance(RING_REPEAT_INTERVAL_MS * 4);
    expect(send).toHaveBeenCalledTimes(after);
  });

  it("s'arrête si l'appel n'est plus en sonnerie côté serveur", async () => {
    const { svc, send, callService } = build();
    await svc.notifyIncoming(CALL);
    callService.findCallById.mockResolvedValue({ id: 'x', status: 'connected' });
    await advance(RING_REPEAT_INTERVAL_MS * 3);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("aucun minuteur si personne n'est joignable (push coupé, pas d'appareil)", async () => {
    const { svc, send } = build({ globalPush: false });
    await svc.notifyIncoming(CALL);
    await advance(RING_REPEAT_INTERVAL_MS * 3);
    expect(send).not.toHaveBeenCalled();
  });
});

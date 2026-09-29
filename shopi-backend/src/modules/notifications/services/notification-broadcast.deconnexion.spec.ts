/* ============================================================
 * FICHIER : src/modules/notifications/services/notification-broadcast.deconnexion.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests de NotificationBroadcastService.deconnecterUtilisateur() :
 * un compte banni / suspendu / supprimé perd IMMÉDIATEMENT tous ses
 * sockets temps réel, sur tous les namespaces (notifications,
 * messagerie, tracking, support) — pas seulement la messagerie.
 * ============================================================ */

import { NotificationBroadcastService } from './notification-broadcast.service';

function fauxSocket(userId: string | undefined) {
  return { data: { userId }, emit: jest.fn(), disconnect: jest.fn() };
}

function fauxServeur(sockets: ReturnType<typeof fauxSocket>[]) {
  return { fetchSockets: jest.fn().mockResolvedValue(sockets) } as any;
}

describe('NotificationBroadcastService.deconnecterUtilisateur', () => {

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function monter() {
    return new NotificationBroadcastService({} as any);
  }

  it('coupe les sockets de la cible sur TOUS les namespaces, et seulement les siens', async () => {
    const svc = monter();
    const cibleNotif = fauxSocket('banni');
    const cibleMsg1  = fauxSocket('banni');
    const cibleMsg2  = fauxSocket('banni');   // 2e appareil
    const autre      = fauxSocket('innocent');
    const anonyme    = fauxSocket(undefined);

    svc.setServer(fauxServeur([cibleNotif, autre]));
    svc.registerSessionServer(fauxServeur([cibleMsg1, cibleMsg2, anonyme]));

    const n = await svc.deconnecterUtilisateur('banni', 'account_banned');

    expect(n).toBe(3);
    for (const s of [cibleNotif, cibleMsg1, cibleMsg2]) {
      expect(s.emit).toHaveBeenCalledWith('account_status_changed', { reason: 'account_banned' });
      expect(s.emit).toHaveBeenCalledWith('session:revoked', expect.objectContaining({ reason: 'ACCOUNT_DISABLED' }));
    }
    for (const s of [autre, anonyme]) {
      expect(s.emit).not.toHaveBeenCalled();
      expect(s.disconnect).not.toHaveBeenCalled();
    }
  });

  it("laisse au client le temps de recevoir l'avertissement avant de couper", async () => {
    const svc = monter();
    const s = fauxSocket('banni');
    svc.registerSessionServer(fauxServeur([s]));

    await svc.deconnecterUtilisateur('banni', 'account_suspended');
    expect(s.disconnect).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(s.disconnect).toHaveBeenCalledWith(true);
  });

  it.each([
    ['account_banned',    'bloqué'],
    ['account_suspended', 'suspendu'],
    ['account_deleted',   'supprimé'],
  ] as const)('%s : message clair pour l’utilisateur', async (motif, mot) => {
    const svc = monter();
    const s = fauxSocket('u');
    svc.registerSessionServer(fauxServeur([s]));

    await svc.deconnecterUtilisateur('u', motif);

    const revoque = s.emit.mock.calls.find(([ev]) => ev === 'session:revoked')![1];
    expect(revoque.message).toContain(mot);
  });

  it('un namespace en panne n’empêche pas de couper les autres, et ne lève jamais', async () => {
    const svc = monter();
    const s = fauxSocket('banni');
    svc.setServer({ fetchSockets: jest.fn().mockRejectedValue(new Error('redis adapter down')) } as any);
    svc.registerSessionServer(fauxServeur([s]));

    await expect(svc.deconnecterUtilisateur('banni', 'account_banned')).resolves.toBe(1);
    jest.advanceTimersByTime(300);
    expect(s.disconnect).toHaveBeenCalledWith(true);
  });

  it('aucun serveur enregistré (démarrage) : ne fait rien, sans erreur', async () => {
    await expect(monter().deconnecterUtilisateur('x', 'account_banned')).resolves.toBe(0);
  });
});

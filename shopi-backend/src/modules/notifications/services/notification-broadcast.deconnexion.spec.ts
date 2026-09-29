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

describe('NotificationBroadcastService.fermerSessionsTempsReel (fin de session volontaire)', () => {

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('coupe tous les sockets de l’utilisateur (autres onglets, autres appareils), sur tous les namespaces', async () => {
    const svc = new NotificationBroadcastService({} as any);
    const onglet1 = fauxSocket('moi');
    const onglet2 = fauxSocket('moi');
    const autre   = fauxSocket('quelquun');
    svc.setServer(fauxServeur([onglet1, autre]));
    svc.registerSessionServer(fauxServeur([onglet2]));

    const n = await svc.fermerSessionsTempsReel('moi', 'USER_LOGOUT');

    expect(n).toBe(2);
    for (const s of [onglet1, onglet2]) {
      expect(s.emit).toHaveBeenCalledWith('session:revoked', { reason: 'USER_LOGOUT', message: 'Vous avez été déconnecté.' });
      /* Pas un bannissement : aucun message « compte bloqué » */
      expect(s.emit).not.toHaveBeenCalledWith('account_status_changed', expect.anything());
    }
    expect(autre.emit).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(onglet1.disconnect).toHaveBeenCalledWith(true);
    expect(onglet2.disconnect).toHaveBeenCalledWith(true);
    expect(autre.disconnect).not.toHaveBeenCalled();
  });

  it.each([
    ['PASSWORD_CHANGED', 'mot de passe'],
    ['ACCOUNT_CLOSED',   'fermé'],
  ] as const)('%s : message adapté', async (motif, mot) => {
    const svc = new NotificationBroadcastService({} as any);
    const s = fauxSocket('moi');
    svc.registerSessionServer(fauxServeur([s]));

    await svc.fermerSessionsTempsReel('moi', motif);

    expect(s.emit).toHaveBeenCalledWith('session:revoked', expect.objectContaining({ reason: motif, message: expect.stringContaining(mot) }));
  });

  it('ne lève jamais, même si un namespace est en panne', async () => {
    const svc = new NotificationBroadcastService({} as any);
    svc.setServer({ fetchSockets: jest.fn().mockRejectedValue(new Error('down')) } as any);
    await expect(svc.fermerSessionsTempsReel('moi', 'USER_LOGOUT')).resolves.toBe(0);
  });
});

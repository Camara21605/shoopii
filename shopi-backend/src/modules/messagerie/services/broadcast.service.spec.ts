/* ============================================================
 * FICHIER      : src/modules/messagerie/services/broadcast.service.spec.ts
 * MODULE       : Messagerie — BroadcastService
 * RÔLE         : Tests unitaires ciblés PARTIE 4 sur disconnectUser() —
 *                déconnexion forcée de TOUS les sockets d'un utilisateur
 *                (bannissement/suspension pendant un appel).
 * ============================================================ */

import { BroadcastService } from './broadcast.service';

function makeFakeSocket(id: string) {
  return { id, emit: jest.fn(), disconnect: jest.fn() };
}

describe('BroadcastService.disconnectUser — partie 4', () => {
  let service: BroadcastService;

  beforeEach(() => {
    service = new BroadcastService();
  });

  it('sans server enregistré → no-op silencieux (ne jette jamais)', async () => {
    await expect(service.disconnectUser('user-uuid', 'account_banned')).resolves.toBeUndefined();
  });

  it('plusieurs appareils : déconnecte TOUS les sockets actifs de l\'utilisateur, pas seulement un', async () => {
    const s1 = makeFakeSocket('socket-1');
    const s2 = makeFakeSocket('socket-2');
    const s3 = makeFakeSocket('socket-3');
    const fetchSockets = jest.fn().mockResolvedValue([s1, s2, s3]);
    const server = { in: jest.fn(() => ({ fetchSockets })) } as any;
    service.setServer(server);

    await service.disconnectUser('user-uuid', 'account_banned');

    expect(server.in).toHaveBeenCalledWith('user:user-uuid');
    for (const s of [s1, s2, s3]) {
      expect(s.emit).toHaveBeenCalledWith('account_status_changed', { reason: 'account_banned' });
      expect(s.disconnect).toHaveBeenCalledWith(true);
    }
  });

  it('envoie account_status_changed AVANT de couper le socket — le client doit pouvoir lire la raison', async () => {
    const order: string[] = [];
    const s1 = {
      id: 'socket-1',
      emit: jest.fn(() => order.push('emit')),
      disconnect: jest.fn(() => order.push('disconnect')),
    };
    const server = { in: jest.fn(() => ({ fetchSockets: jest.fn().mockResolvedValue([s1]) })) } as any;
    service.setServer(server);

    await service.disconnectUser('user-uuid', 'account_suspended');

    expect(order).toEqual(['emit', 'disconnect']);
  });

  it('aucun socket actif (utilisateur hors ligne) → ne jette pas, ne fait rien', async () => {
    const server = { in: jest.fn(() => ({ fetchSockets: jest.fn().mockResolvedValue([]) })) } as any;
    service.setServer(server);

    await expect(service.disconnectUser('user-uuid', 'account_banned')).resolves.toBeUndefined();
  });

  it('fetchSockets en échec (ex. multi-instance sans Redis Adapter) → dégradation gracieuse, ne jette jamais', async () => {
    const server = { in: jest.fn(() => ({ fetchSockets: jest.fn().mockRejectedValue(new Error('adapter error')) })) } as any;
    service.setServer(server);

    await expect(service.disconnectUser('user-uuid', 'account_banned')).resolves.toBeUndefined();
  });
});

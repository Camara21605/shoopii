/* ============================================================
 * FICHIER : src/modules/messagerie/utils/socket-flood-guard.spec.ts
 * ============================================================ */

import { SocketFloodGuard } from './socket-flood-guard';

describe('SocketFloodGuard', () => {
  let guard: SocketFloodGuard;

  beforeEach(() => { guard = new SocketFloodGuard(); });
  afterEach(() => guard.destroy());

  it('autorise jusqu\'au seuil max inclus', () => {
    for (let i = 0; i < 5; i++) {
      expect(guard.allow('bucket', 'socket-1', 5, 10_000)).toBe(true);
    }
  });

  it('bloque au-delà du seuil, dans la même fenêtre', () => {
    for (let i = 0; i < 5; i++) guard.allow('bucket', 'socket-1', 5, 10_000);
    expect(guard.allow('bucket', 'socket-1', 5, 10_000)).toBe(false);
  });

  it('réautorise après expiration de la fenêtre', () => {
    for (let i = 0; i < 5; i++) guard.allow('bucket', 'socket-1', 5, 50);
    expect(guard.allow('bucket', 'socket-1', 5, 50)).toBe(false);
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(guard.allow('bucket', 'socket-1', 5, 50)).toBe(true);
        resolve();
      }, 60);
    });
  });

  it('un socket flooder ne pénalise pas un autre socket (isolation par clé)', () => {
    for (let i = 0; i < 5; i++) guard.allow('bucket', 'socket-1', 5, 10_000);
    expect(guard.allow('bucket', 'socket-1', 5, 10_000)).toBe(false);
    expect(guard.allow('bucket', 'socket-2', 5, 10_000)).toBe(true);
  });

  it('des buckets différents pour la même clé sont indépendants', () => {
    for (let i = 0; i < 5; i++) guard.allow('signal', 'socket-1', 5, 10_000);
    expect(guard.allow('signal', 'socket-1', 5, 10_000)).toBe(false);
    expect(guard.allow('membership', 'socket-1', 5, 10_000)).toBe(true);
  });
});

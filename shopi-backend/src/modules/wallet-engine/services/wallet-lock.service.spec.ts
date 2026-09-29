/* ============================================================
 * FICHIER : src/modules/wallet-engine/services/wallet-lock.service.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests de WalletLockService — garantit qu'aucune opération ne
 * modifie un wallet sans :
 *   - verrou pessimiste (SELECT … FOR UPDATE) sur la ligne du wallet
 *   - transaction SQL : COMMIT si tout réussit, ROLLBACK sinon
 *   - libération systématique de la connexion
 *   - ordre de verrouillage déterministe sur deux wallets (anti-deadlock)
 * ============================================================ */

import { WalletLockService } from './wallet-lock.service';
import { WalletErreur, WalletErreurType } from '../types/wallet-engine.types';
import { makeWallet } from '../../../test/helpers/wallet.test-helper';

/* ============================================================
 * MONTAGE
 * ============================================================ */

function monter(walletsEnBase: Record<string, unknown> = {}) {
  const ordreVerrous: string[] = [];
  const locks: string[] = [];

  const createQueryBuilder = jest.fn(() => {
    let id = '';
    const qb = {
      where: jest.fn((_sql: string, params: { id: string }) => { id = params.id; return qb; }),
      setLock: jest.fn((mode: string) => { locks.push(mode); return qb; }),
      getOne: jest.fn(async () => { ordreVerrous.push(id); return walletsEnBase[id] ?? null; }),
    };
    return qb;
  });

  const qr = {
    connect:             jest.fn(async () => undefined),
    startTransaction:    jest.fn(async () => undefined),
    commitTransaction:   jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release:             jest.fn(async () => undefined),
    manager: { createQueryBuilder },
  };
  const dataSource = { createQueryRunner: jest.fn(() => qr) };

  return { svc: new WalletLockService(dataSource as any), qr, ordreVerrous, locks };
}

/* ============================================================
 * SUITE
 * ============================================================ */

describe('WalletLockService', () => {

  describe('transaction', () => {

    it('succès : connecte, ouvre la transaction, COMMIT puis libère', async () => {
      const { svc, qr } = monter();

      const r = await svc.runInTransaction(async () => 'ok');

      expect(r).toBe('ok');
      expect(qr.connect).toHaveBeenCalled();
      expect(qr.startTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it("erreur : ROLLBACK (aucune écriture partielle), relance l'erreur et libère quand même", async () => {
      const { svc, qr } = monter();
      const boom = new Error('panne au milieu du mouvement');

      await expect(svc.runInTransaction(async () => { throw boom; })).rejects.toBe(boom);

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });
  });

  describe('verrou sur un wallet', () => {

    it('verrouille la ligne en écriture (pessimistic_write) et passe le wallet au callback', async () => {
      const w = makeWallet({ id: 'w-1' });
      const { svc, locks } = monter({ 'w-1': w });

      const r = await svc.runWithLockedWallet('w-1', async (wallet) => wallet.id);

      expect(r).toBe('w-1');
      expect(locks).toEqual(['pessimistic_write']);
    });

    it('wallet introuvable : WALLET_INTROUVABLE et ROLLBACK, le callback ne tourne jamais', async () => {
      const { svc, qr } = monter({});
      const callback = jest.fn();

      const err = await svc.runWithLockedWallet('absent', callback).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(WalletErreur);
      expect((err as WalletErreur).type).toBe(WalletErreurType.WALLET_INTROUVABLE);
      expect(callback).not.toHaveBeenCalled();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('verrou sur deux wallets (virement)', () => {

    const a = makeWallet({ id: 'aaa-wallet' });
    const b = makeWallet({ id: 'bbb-wallet' });

    it.each([
      ['aaa-wallet', 'bbb-wallet'],
      ['bbb-wallet', 'aaa-wallet'],
    ])('source=%s cible=%s : verrouille TOUJOURS dans le même ordre (anti-deadlock)', async (source, cible) => {
      const { svc, ordreVerrous } = monter({ 'aaa-wallet': a, 'bbb-wallet': b });

      const r = await svc.runWithLockedDualWallets(source, cible, async (src, tgt) => [src.id, tgt.id]);

      expect(ordreVerrous).toEqual(['aaa-wallet', 'bbb-wallet']);
      /* …mais rend bien source et cible dans l'ordre demandé */
      expect(r).toEqual([source, cible]);
    });

    it("l'un des deux wallets introuvable : erreur et ROLLBACK", async () => {
      const { svc, qr } = monter({ 'aaa-wallet': a });
      await expect(svc.runWithLockedDualWallets('aaa-wallet', 'zzz-absent', jest.fn())).rejects.toBeInstanceOf(WalletErreur);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });
});

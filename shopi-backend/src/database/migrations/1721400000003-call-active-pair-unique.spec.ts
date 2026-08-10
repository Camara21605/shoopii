/* ============================================================
 * FICHIER      : src/database/migrations/1721400000003-call-active-pair-unique.spec.ts
 * RÔLE         : Tests unitaires de la migration CallActivePairUnique.
 *
 * QueryRunner mocké — pas de connexion Postgres réelle (même convention
 * que les autres migrations de ce dossier). La preuve que la contrainte
 * rejette réellement une insertion en double a été faite en direct contre
 * la vraie base de dev (voir le rapport de la partie) — un mock ne peut
 * pas exécuter du SQL réel.
 * ============================================================ */

import { CallActivePairUnique1721400000003 } from './1721400000003-call-active-pair-unique';
import type { QueryRunner } from 'typeorm';

function makeQueryRunner(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return { query: jest.fn().mockResolvedValue([]), ...overrides } as unknown as QueryRunner;
}

describe('Migration CallActivePairUnique1721400000003', () => {
  let migration: CallActivePairUnique1721400000003;

  beforeEach(() => { migration = new CallActivePairUnique1721400000003(); });
  afterEach(() => jest.clearAllMocks());

  it('up() crée un index unique d\'expression LEAST/GREATEST sur (callerId, calleeId)', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const qr = makeQueryRunner({ query });

    await migration.up(qr);

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UNIQ_calls_active_pair"');
    expect(sql).toContain('LEAST("callerId", "calleeId")');
    expect(sql).toContain('GREATEST("callerId", "calleeId")');
  });

  it('down() supprime l\'index', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const qr = makeQueryRunner({ query });

    await migration.down(qr);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('DROP INDEX IF EXISTS "UNIQ_calls_active_pair"'));
  });
});

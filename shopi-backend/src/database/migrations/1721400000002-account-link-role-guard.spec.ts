/* ============================================================
 * FICHIER      : src/database/migrations/1721400000002-account-link-role-guard.spec.ts
 * RÔLE         : Tests unitaires de la migration AccountLinkRoleGuard.
 *
 * COUVERTURE :
 *   ✅ up() pose la fonction trigger puis (re)crée le trigger BEFORE
 *      INSERT OR UPDATE sur account_links.
 *   ✅ down() supprime le trigger puis la fonction.
 *
 * QueryRunner entièrement mocké — pas de connexion Postgres réelle (même
 * convention que 1721400000000-user-unique-per-role.spec.ts). La preuve
 * que le trigger rejette réellement une insertion invalide a été faite en
 * direct contre la vraie base de dev (voir le rapport de sécurité) — un
 * mock ne peut pas exécuter du PL/pgSQL.
 * ============================================================ */

import { AccountLinkRoleGuard1721400000002 } from './1721400000002-account-link-role-guard';
import type { QueryRunner } from 'typeorm';

function makeQueryRunner(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    query: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as QueryRunner;
}

describe('Migration AccountLinkRoleGuard1721400000002', () => {
  let migration: AccountLinkRoleGuard1721400000002;

  beforeEach(() => {
    migration = new AccountLinkRoleGuard1721400000002();
  });

  afterEach(() => jest.clearAllMocks());

  it('up() crée la fonction trigger puis le trigger BEFORE INSERT OR UPDATE', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const qr = makeQueryRunner({ query });

    await migration.up(qr);

    const calls = query.mock.calls.map(c => c[0] as string);
    expect(calls.some(sql => sql.includes('CREATE OR REPLACE FUNCTION check_account_link_roles'))).toBe(true);
    expect(calls.some(sql => sql.includes('DROP TRIGGER IF EXISTS trg_check_account_link_roles'))).toBe(true);
    expect(calls.some(sql => sql.includes('CREATE TRIGGER trg_check_account_link_roles'))).toBe(true);

    // La fonction doit couvrir les deux invariants : rôle pro côté proUserId,
    // rôle client côté clientUserId.
    const fnSql = calls.find(sql => sql.includes('CREATE OR REPLACE FUNCTION check_account_link_roles'))!;
    expect(fnSql).toContain(`'company', 'delivery', 'correspondent', 'partner', 'admin'`);
    expect(fnSql).toContain(`client_role <> 'client'`);
  });

  it('down() supprime le trigger puis la fonction', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const qr = makeQueryRunner({ query });

    await migration.down(qr);

    const calls = query.mock.calls.map(c => c[0] as string);
    expect(calls.some(sql => sql.includes('DROP TRIGGER IF EXISTS trg_check_account_link_roles'))).toBe(true);
    expect(calls.some(sql => sql.includes('DROP FUNCTION IF EXISTS check_account_link_roles'))).toBe(true);
  });
});

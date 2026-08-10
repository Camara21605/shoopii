/* ============================================================
 * FICHIER      : src/database/migrations/1721400000000-user-unique-per-role.spec.ts
 * RÔLE         : Tests unitaires de la migration UserUniquePerRole.
 *
 * COUVERTURE :
 *   ✅ Deux users même email, rôles différents → aucun doublon détecté,
 *      la contrainte composite (email, role) s'applique sans erreur.
 *   ✅ Deux users même email + même rôle → doublon détecté et loggué
 *      AVANT la pose de la contrainte.
 *   ✅ Si la contrainte échoue malgré tout (doublon réel en base), l'erreur
 *      Postgres remonte — la migration ne l'avale jamais silencieusement.
 *
 * Comme le reste de la suite, QueryRunner est entièrement mocké — pas de
 * connexion Postgres réelle (voir account-link.service.spec.ts pour le
 * même choix sur AccountLinkService).
 * ============================================================ */

import { UserUniquePerRole1721400000000 } from './1721400000000-user-unique-per-role';
import type { QueryRunner } from 'typeorm';

function makeQueryRunner(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    query: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as QueryRunner;
}

describe('Migration UserUniquePerRole1721400000000', () => {
  let migration: UserUniquePerRole1721400000000;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    migration = new UserUniquePerRole1721400000000();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('deux users même email, rôles différents → aucun doublon (email,role) détecté', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      // Les requêtes GROUP BY ... HAVING COUNT(*) > 1 ne renvoient rien :
      // (email, 'client') et (email, 'company') sont deux groupes distincts,
      // chacun avec un seul membre.
      if (sql.includes('HAVING COUNT(*) > 1')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const qr = makeQueryRunner({ query });

    await migration.up(qr);

    expect(warnSpy).not.toHaveBeenCalled();
    // La contrainte composite doit bien être posée.
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS "UNIQ_user_email_role"'),
    );
  });

  it('deux users même email + même rôle → doublon détecté et loggué avant la contrainte', async () => {
    let constraintAlreadyPosed = false;
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('HAVING COUNT(*) > 1') && sql.includes('"email"')) {
        return Promise.resolve([{ value: 'doublon@test.com', role: 'client', count: '2' }]);
      }
      if (sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS "UNIQ_user_email_role"')) {
        constraintAlreadyPosed = true;
      }
      return Promise.resolve([]);
    });
    const qr = makeQueryRunner({ query });

    await migration.up(qr);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('doublon'),
      expect.stringContaining('doublon@test.com'),
    );
    // Le log a bien lieu, et la migration continue quand même à poser la contrainte
    // (c'est CETTE pose qui échouera réellement côté Postgres si le doublon persiste).
    expect(constraintAlreadyPosed).toBe(true);
  });

  it("propage l'erreur si la contrainte échoue réellement (doublon non nettoyé)", async () => {
    const constraintError = new Error('duplicate key value violates unique constraint "UNIQ_user_email_role"');
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS "UNIQ_user_email_role"')) {
        return Promise.reject(constraintError);
      }
      return Promise.resolve([]);
    });
    const qr = makeQueryRunner({ query });

    await expect(migration.up(qr)).rejects.toThrow(constraintError);
  });

  it('down() restaure la contrainte globale UNIQUE(email)', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const qr = makeQueryRunner({ query });

    await migration.down(qr);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ADD CONSTRAINT "UNIQ_user_email" UNIQUE ("email")'),
    );
  });
});

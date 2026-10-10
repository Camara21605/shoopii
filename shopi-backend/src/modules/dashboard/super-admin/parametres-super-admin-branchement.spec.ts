/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/parametres-super-admin-branchement.spec.ts
 *
 * Non-régression de l'audit « les paramètres du super-admin sont-ils bien
 * branchés ? » (2026-09) :
 *  1. Finances de la plateforme : réservées au super-admin.
 *  2. Maintenance : admins et super-admin gardent leur accès (jeton vérifié).
 *  3. Limites de retrait cohérentes même champ par champ ; écriture ciblée.
 *  5. « Mon compte » du super-admin (sans fiche Admin) ; pas de 2FA obligatoire
 *     impossible à configurer.
 * ============================================================ */

import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';

import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { maintenanceGuard } from '../../../common/middleware/maintenance.middleware';
import { SuperAdminController } from './super-admin.controller';
import { PlatformSettingsService } from './services/platform-settings.service';
import { SecuriteAdminService } from './services/securite-admin.service';
import { TwoFaService } from '../../auth/twofa/twofa.service';

function monter<T>(Classe: abstract new (...args: any[]) => T, deps: Record<string, unknown>): T {
  return Object.assign(Object.create(Classe.prototype), deps) as T;
}
const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

/* ============================================================
 * 1 — Finances
 * ============================================================ */

describe('Finances de la plateforme', () => {
  it.each(['getFinances', 'getTopActeurs', 'getActeurStats'])('1. %s réservée au super-admin', (methode) => {
    const handler = (SuperAdminController.prototype as unknown as Record<string, object>)[methode];
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.SUPER_ADMIN]);
  });
});

/* ============================================================
 * 2 — Maintenance
 * ============================================================ */

describe('Mode maintenance', () => {
  const SECRET = 'secret-de-test';
  const jeton = (role: string, secret = SECRET) => new JwtService({ secret }).sign({ sub: 'u', role });

  async function passer(path: string, token: string | null, maintenance = true) {
    const cache = { getSettings: jest.fn().mockResolvedValue({ maintenanceMode: maintenance }) };
    const req = { path, headers: token ? { authorization: `Bearer ${token}` } : {}, cookies: {} } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();
    await maintenanceGuard(cache as never, SECRET)(req, res, next);
    return { next, res };
  }

  it('2. tableau de bord admin (/api/dashboard/admin) accessible', async () => {
    const { next } = await passer('/api/dashboard/admin/audit', null);
    expect(next).toHaveBeenCalled();
  });

  it('2. admin et super-admin gardent tout leur accès (catalogue, géo…)', async () => {
    expect((await passer('/api/categories', jeton('super_admin'))).next).toHaveBeenCalled();
    expect((await passer('/api/zones/me', jeton('admin'))).next).toHaveBeenCalled();
  });

  it('2. client, jeton forgé ou absent : bloqués (503)', async () => {
    for (const token of [jeton('client'), jeton('super_admin', 'autre-secret'), null]) {
      const { next, res } = await passer('/api/categories', token);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
    }
  });

  it('2. hors maintenance : tout passe', async () => {
    expect((await passer('/api/categories', null, false)).next).toHaveBeenCalled();
  });
});

/* ============================================================
 * 3 — Limites de retrait / écriture ciblée
 * ============================================================ */

describe('Paramètres de paiement', () => {
  function monterSettings(actuel: Record<string, unknown>) {
    const ligne = { id: 1, minWithdrawalAmount: 5000, maxTransactionAmount: 5_000_000, dailyWithdrawalLimit: 0, ...actuel };
    const repo = {
      findOne: jest.fn().mockResolvedValue(ligne),
      update:  jest.fn(),
      save:    jest.fn(),
    };
    const svc = monter(PlatformSettingsService, {
      repo, logger,
      settingsCache:    { invalidate: jest.fn() },
      commissionConfig: { createOrUpdateRule: jest.fn() },
    });
    return { svc, repo };
  }

  it('3. minimum seul, supérieur au maximum déjà enregistré : refusé', async () => {
    const { svc, repo } = monterSettings({ maxTransactionAmount: 100_000 });
    await expect(svc.updateSettings({ minWithdrawalAmount: 200_000 })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('3. plafond journalier inférieur au minimum : refusé (0 = sans limite accepté)', async () => {
    const { svc } = monterSettings({ minWithdrawalAmount: 10_000 });
    await expect(svc.updateSettings({ dailyWithdrawalLimit: 5_000 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateSettings({ dailyWithdrawalLimit: 0 })).resolves.toBeDefined();
  });

  it('3. seules les colonnes envoyées sont écrites', async () => {
    const { svc, repo } = monterSettings({});
    await svc.updateSettings({ maintenanceMode: true });
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith({ id: 1 }, { maintenanceMode: true });
  });
});

/* ============================================================
 * 5 — Compte du super-admin
 * ============================================================ */

describe('Mon compte (super-admin)', () => {
  it('5. sécurité du compte sans fiche Admin : réponse, 2FA annoncée indisponible', async () => {
    const svc = monter(SecuriteAdminService, {
      adminRepo: { findOne: jest.fn().mockResolvedValue(null) },
      userRepo:  { findOne: jest.fn().mockResolvedValue({
        id: 'u-sa', password: 'hash', lastPasswordChangedAt: null, status: 'active', emailVerified: true,
        lastLoginAt: null, lastLoginIp: null,
      }) },
      sessionService: { getSessionMeta: jest.fn().mockResolvedValue(null) },
      logger,
    });
    const r = await svc.getSecurite('u-sa', null);
    expect(r).toMatchObject({ twoFaEnabled: false, twoFaDisponible: false });
    expect(r.scoreItems.find(i => i.key === 'passwordChanged')?.ok).toBe(false);
  });

  it('5. 2FA non configurable sans fiche de profil', async () => {
    const qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
    const svc = monter(TwoFaService, { adminRepo: { createQueryBuilder: jest.fn().mockReturnValue(qb) } });
    await expect(svc.estConfigurable(UserRole.SUPER_ADMIN, 'u-sa')).resolves.toBe(false);
  });
});

/* ============================================================
 * FICHIER : src/modules/dashboard/administrateur/parametres-admin-branchement.spec.ts
 *
 * Non-régression de l'audit « les paramètres de l'administrateur de zone
 * sont-ils bien branchés ? » (2026-09) :
 *  1-2. Configurations communes à la plateforme (commissions entreprises,
 *       livreurs, partenaires, validations) : modification réservée au
 *       super-admin, consultation ouverte à l'admin de zone.
 *  4. Photo de profil : uniquement une image envoyée via /upload/avatar.
 *  5. Profil et préférences d'alertes : seules leurs colonnes sont écrites.
 * ============================================================ */

import { BadRequestException } from '@nestjs/common';

import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { hashUserPhone } from '../../../common/utils/phone-hash.util';
import { CompanySettingsController } from '../../company-settings/company-settings.controller';
import { DeliverySettingsController } from '../../delivery-settings/delivery-settings.controller';
import { PartnerSettingsController } from '../../partner-settings/partner-settings.controller';
import { ValidationConfigController } from '../../validation-config/validation-config.controller';
import { AdminsService } from '../super-admin/services/admins.service';
import { ZoneAdminService } from '../../zone-admin/zone-admin.service';

function monter<T>(Classe: abstract new (...args: any[]) => T, deps: Record<string, unknown>): T {
  return Object.assign(Object.create(Classe.prototype), deps) as T;
}
const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

/** Rôles effectifs d'une route : ceux de la méthode, sinon ceux du contrôleur (getAllAndOverride). */
function roles(Controleur: abstract new (...args: any[]) => unknown, methode: string): string[] {
  const handler = (Controleur.prototype as Record<string, unknown>)[methode] as object;
  return (Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined)
      ?? (Reflect.getMetadata(ROLES_KEY, Controleur) as string[]);
}

/* ============================================================
 * 1-2 — Configurations communes : super-admin seulement
 * ============================================================ */

describe('Configurations communes à la plateforme', () => {
  const cas: Array<[string, abstract new (...args: any[]) => unknown, string, string]> = [
    ['entreprises (commissions)', CompanySettingsController,  'updateSettings', 'getSettings'],
    ['livreurs (taux plateforme)', DeliverySettingsController, 'updateSettings', 'getSettings'],
    ['partenaires (paliers)',      PartnerSettingsController,  'updateSettings', 'getSettings'],
    ['validations',                ValidationConfigController, 'updateConfig',   'getConfig'],
  ];

  it.each(cas)('1. %s : modification réservée au super-admin', (_nom, Ctrl, put) => {
    expect(roles(Ctrl, put)).toEqual([UserRole.SUPER_ADMIN]);
  });

  it.each(cas)('2. %s : consultation ouverte à l’admin de zone', (_nom, Ctrl, _put, get) => {
    expect(roles(Ctrl, get)).toEqual(expect.arrayContaining([UserRole.ADMIN, UserRole.SUPER_ADMIN]));
  });
});

/* ============================================================
 * 4 — Photo de profil
 * ============================================================ */

describe('Photo de profil de l’administrateur', () => {
  const ancien = process.env.CLOUDINARY_CLOUD_NAME;
  beforeAll(() => { process.env.CLOUDINARY_CLOUD_NAME = 'shoneya'; });
  afterAll(() => { process.env.CLOUDINARY_CLOUD_NAME = ancien; });

  function monterAvatar() {
    const userRepo = { findOne: jest.fn().mockResolvedValue({ id: 'u-a' }), update: jest.fn(), save: jest.fn() };
    return { svc: monter(AdminsService, { userRepo, adminRepo: {}, logger }), userRepo };
  }

  it('4. adresse externe refusée', async () => {
    const { svc, userRepo } = monterAvatar();
    await expect(svc.updateMyAvatar('u-a', 'https://pixel.exemple.com/suivi.png')).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('4. image envoyée via /upload/avatar acceptée, suppression possible', async () => {
    const { svc, userRepo } = monterAvatar();
    const url = 'https://res.cloudinary.com/shoneya/image/upload/v1/shopi/avatars/a.jpg';
    await expect(svc.updateMyAvatar('u-a', url)).resolves.toEqual({ profilePicture: url });
    await expect(svc.updateMyAvatar('u-a', null)).resolves.toEqual({ profilePicture: null });
    expect(userRepo.update).toHaveBeenCalledWith('u-a', { profilePicture: url });
    expect(userRepo.save).not.toHaveBeenCalled();
  });
});

/* ============================================================
 * 5 — Écritures ciblées
 * ============================================================ */

describe('Profil et alertes de l’administrateur', () => {

  it('5. profil : seules les colonnes du profil sont écrites (jamais permissions ni statut)', async () => {
    const admin = {
      id: 'ad-1', fullName: 'A B', phone: null, jobTitle: null, bio: null,
      permissions: { companies: true }, zoneId: 'z-1',
      user: { id: 'u-a', firstName: 'A', lastName: 'B', phone: null, status: 'active', email: 'a@b.c', createdAt: new Date() },
    };
    const adminRepo = { findOne: jest.fn().mockResolvedValue(admin), update: jest.fn(), save: jest.fn() };
    const userRepo  = { update: jest.fn(), save: jest.fn() };
    const svc = monter(AdminsService, { adminRepo, userRepo, logger });

    await svc.updateMyProfil('u-a', { lastName: 'Camara', phone: '+224 620 00 00 00' });

    expect(adminRepo.save).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(userRepo.update).toHaveBeenCalledWith('u-a', {
      lastName: 'Camara', phone: '+224 620 00 00 00', phoneHash: hashUserPhone('+224 620 00 00 00'),
    });
    expect(adminRepo.update).toHaveBeenCalledWith('ad-1', { fullName: 'A Camara', phone: '+224 620 00 00 00' });
  });

  it('5. alertes de zone : seule la colonne alertPreferences est écrite', async () => {
    const adminRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'ad-1', userId: 'u-a', alertPreferences: null, permissions: { x: true } }),
      update: jest.fn(), save: jest.fn(),
    };
    const svc = monter(ZoneAdminService, { adminRepo, logger });
    await svc.updatePreferences('u-a', { signalement: false });
    expect(adminRepo.save).not.toHaveBeenCalled();
    expect(adminRepo.update).toHaveBeenCalledWith('ad-1', { alertPreferences: expect.objectContaining({ signalement: false }) });
  });
});

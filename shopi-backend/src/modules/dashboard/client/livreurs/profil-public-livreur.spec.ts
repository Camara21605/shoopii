/* ================================================================
 * Profil public d'un livreur (GET /client/livreurs/:id) — sécurité.
 *
 *  1. Téléphone / WhatsApp : abonnés du livreur et livreur lui-même uniquement
 *     (avant : envoyés à tout visiteur, même anonyme).
 *  2. Compte inactif, suspendu, banni ou en pause : pas de profil public
 *     (le livreur voit toujours le sien).
 *  3. Ponctualité : jamais calculée → null, pas un « 95 % » inventé.
 *  4. :id doit être un UUID (avant : erreur 500 sur une adresse mal formée).
 * ================================================================ */
import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { LivreursClientService } from './livreurs-client.service';
import { LivreursClientController } from './livreurs-client.controller';
import { UserStatus } from '../../../../database/entities/user.entity';
import { DeliveryStatus } from '../../../../database/entities/profiles/livreur-profile.entity';

function monter<T>(Classe: abstract new (...args: any[]) => T, deps: Record<string, unknown>): T {
  return Object.assign(Object.create(Classe.prototype), deps) as T;
}

function livreur(patch: Record<string, unknown> = {}, userPatch: Record<string, unknown> = {}) {
  return {
    id: 'lv-1', fullName: 'Aly Camara', phone: '+224 620 00 00 00', whatsapp: '+224620000000',
    status: DeliveryStatus.ACTIVE, suspendedUntil: null, ponctualite: 95, totalDeliveries: 0,
    privacySettings: null, createdAt: new Date(), horaires: [], communesActives: [],
    user: { id: 'u-livreur', phone: '+224 620 00 00 00', status: UserStatus.ACTIVE, ...userPatch },
    ...patch,
  };
}

function service(profile: unknown, suivis: string[] = []) {
  const qb = { innerJoinAndSelect: jest.fn().mockReturnThis(), leftJoinAndSelect: jest.fn().mockReturnThis(),
               where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(profile) };
  const svc = monter(LivreursClientService, {
    profileRepo: { createQueryBuilder: jest.fn().mockReturnValue(qb) },
    followRepo:  { count: jest.fn().mockResolvedValue(2) },
    geoService:  { resolveFraisLivraison: jest.fn().mockResolvedValue({ fraisLivraison: 0, zoneNom: null }) },
  });
  jest.spyOn(svc as unknown as { getFollowedIds: () => Promise<Set<string>> }, 'getFollowedIds')
    .mockResolvedValue(new Set(suivis));
  return svc;
}

describe('Profil public livreur — contact', () => {
  it('1. visiteur anonyme ou non abonné : ni téléphone ni WhatsApp', async () => {
    const anonyme = await service(livreur()).getLivreurById('lv-1');
    expect(anonyme.telephone).toBeNull();
    expect(anonyme.whatsapp).toBeNull();
    expect(JSON.stringify(anonyme)).not.toContain('620');

    const nonAbonne = await service(livreur()).getLivreurById('lv-1', 'u-client');
    expect(nonAbonne.telephone).toBeNull();
  });

  it('2. abonné : téléphone et WhatsApp visibles', async () => {
    const r = await service(livreur(), ['lv-1']).getLivreurById('lv-1', 'u-client');
    expect(r.telephone).toBe('+224 620 00 00 00');
    expect(r.whatsapp).toBe('+224620000000');
  });

  it('3. le livreur voit son propre numéro', async () => {
    const r = await service(livreur()).getLivreurById('lv-1', 'u-livreur');
    expect(r.telephone).toBe('+224 620 00 00 00');
  });
});

describe('Profil public livreur — comptes hors service', () => {
  const horsService: [string, ReturnType<typeof livreur>][] = [
    ['compte suspendu',   livreur({}, { status: UserStatus.SUSPENDED })],
    ['compte banni',      livreur({}, { status: UserStatus.BANNED })],
    ['livreur suspendu',  livreur({ status: DeliveryStatus.SUSPENDED })],
    ['livreur banni',     livreur({ status: DeliveryStatus.BANNED })],
    ['livreur en pause',  livreur({ suspendedUntil: new Date(Date.now() + 86_400_000) })],
  ];

  it.each(horsService)('4. %s : introuvable pour les autres', async (_, profile) => {
    await expect(service(profile).getLivreurById('lv-1', 'u-client')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service(profile).getLivreurById('lv-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('5. le livreur en pause voit toujours son profil', async () => {
    const r = await service(livreur({ suspendedUntil: new Date(Date.now() + 86_400_000) })).getLivreurById('lv-1', 'u-livreur');
    expect(r.id).toBe('lv-1');
  });
});

describe('Profil public livreur — données affichées', () => {
  it('6. ponctualité non mesurée : null, jamais le 95 % par défaut', async () => {
    const r = await service(livreur()).getLivreurById('lv-1');
    expect(r.ponctualite).toBeNull();
  });

  it('7. :id validé comme UUID (400 au lieu d’une erreur 500)', () => {
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, LivreursClientController, 'getLivreurById') as
      Record<string, { data?: string; pipes?: unknown[] }>;
    const param = Object.values(args).find(a => a.data === 'id');
    expect(param?.pipes).toContain(ParseUUIDPipe);
  });
});

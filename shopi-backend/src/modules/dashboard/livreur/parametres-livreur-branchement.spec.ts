/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/parametres-livreur-branchement.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Non-régression de l'audit « les paramètres du livreur sont-ils bien
 * branchés ? » (2026-09) :
 *
 *  1. Tarifs : un livreur ne peut plus modifier lui-même ses tarifs
 *     (PATCH /parametres/vitesses retiré — la rubrique n'existe plus à l'écran).
 *  2. Suppression du compte : les connexions temps réel sont coupées.
 *  3. « Non disponible » sur une zone (page Ma zone) : exclu de la recherche
 *     des clients pour cette zone.
 *  A. Documents renouvelés par un livreur vérifié : revérifiés par l'admin (compte actif).
 *  B. Profil (onglet Tarifs) : frais réels des zones de livraison, plus l'ancien tarifBase.
 *  4. Validation administrateur : pièces envoyées par le livreur visibles
 *     (présence seulement, jamais l'identifiant du fichier).
 * ============================================================ */

import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import * as bcrypt from 'bcryptjs';

import { LivreurParametresController } from './livreur-parametres.controller';
import { VitessesLivreurService } from './services/vitesses-livreur.service';
import { DangerLivreurService } from './services/danger-livreur.service';
import { LivreursClientService, livreurDisponibleDansZone } from '../client/livreurs/livreurs-client.service';
import { AdminActeursService } from '../administrateur/services/admin-acteurs.service';
import { ProfilLivreurService } from './services/profil-livreur.service';
import { LivreurVerificationStatus } from '../../../database/entities/profiles/livreur-profile.entity';
import { UserStatus } from '../../../database/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

/** Construit un service sans passer par son (long) constructeur. */
function monter<T>(Classe: abstract new (...args: any[]) => T, deps: Record<string, unknown>): T {
  return Object.assign(Object.create(Classe.prototype), deps) as T;
}

/* ============================================================
 * 1 — Tarifs
 * ============================================================ */

describe('Tarifs du livreur', () => {

  it('1. aucune route ne permet au livreur de modifier ses tarifs', () => {
    const proto = LivreurParametresController.prototype as unknown as Record<string, unknown>;
    const routes = Object.getOwnPropertyNames(proto)
      .filter(n => n !== 'constructor' && typeof proto[n] === 'function')
      .map(n => ({ path: Reflect.getMetadata(PATH_METADATA, proto[n] as object), method: Reflect.getMetadata(METHOD_METADATA, proto[n] as object) }));

    expect(routes).toContainEqual({ path: 'vitesses', method: RequestMethod.GET });       // lecture conservée
    expect(routes).not.toContainEqual({ path: 'vitesses', method: RequestMethod.PATCH });
    expect((VitessesLivreurService.prototype as unknown as Record<string, unknown>).updateVitesses).toBeUndefined();
  });

  it('B. le profil montre les frais réels des zones de livraison, jamais l’ancien tarifBase', async () => {
    const profile = {
      id: 'lv-1', fullName: 'Mamadou', commune: 'Kaloum', ville: 'Conakry', communesActives: ['Dixinn', 'kaloum', 'Boké'],
      tarifBase: 15000, tarifParKm: 1500, supplementLourd: 5000, majorationNocturne: 30,
      privacySettings: null, createdAt: new Date(), horaires: [], user: { phone: null },
    };
    const qb = { innerJoinAndSelect: jest.fn().mockReturnThis(), leftJoinAndSelect: jest.fn().mockReturnThis(),
                 where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(profile) };
    const zones: Record<string, { fraisLivraison: number; zoneNom: string | null }> = {
      Kaloum:  { fraisLivraison: 10000, zoneNom: 'Conakry Centre' },
      Conakry: { fraisLivraison: 12000, zoneNom: 'Grand Conakry' },
      Dixinn:  { fraisLivraison: 10000, zoneNom: 'Conakry Centre' },
    };
    const svc = monter(LivreursClientService, {
      profileRepo: { createQueryBuilder: jest.fn().mockReturnValue(qb) },
      followRepo:  { count: jest.fn().mockResolvedValue(0) },
      geoService:  { resolveFraisLivraison: jest.fn((l: string) => Promise.resolve(zones[l] ?? { fraisLivraison: 0, zoneNom: null })) },
    });
    jest.spyOn(svc as unknown as { getFollowedIds: () => Promise<Set<string>> }, 'getFollowedIds').mockResolvedValue(new Set());

    const r = await svc.getLivreurById('lv-1');
    expect(r.tarifs).toEqual([
      { lieu: 'Kaloum',  zoneNom: 'Conakry Centre', frais: 10000 },
      { lieu: 'Conakry', zoneNom: 'Grand Conakry',  frais: 12000 },
      { lieu: 'Dixinn',  zoneNom: 'Conakry Centre', frais: 10000 },
      { lieu: 'Boké',    zoneNom: null,             frais: null },   // aucune zone : pas de prix inventé
    ]);
    expect(JSON.stringify(r.tarifs)).not.toContain('15000');
  });
});

/* ============================================================
 * 2 — Suppression du compte
 * ============================================================ */

describe('Suppression du compte livreur', () => {

  it('2. coupe les connexions temps réel déjà ouvertes', async () => {
    const fermerSessionsTempsReel = jest.fn().mockResolvedValue(undefined);
    const svc = monter(DangerLivreurService, {
      userRepo: {
        findOne:    jest.fn().mockResolvedValue({ id: 'user-livreur', password: await bcrypt.hash('secret', 4) }),
        softDelete: jest.fn().mockResolvedValue(undefined),
        update:     jest.fn().mockResolvedValue(undefined),
      },
      livreurRepo:  { findOne: jest.fn().mockResolvedValue({ id: 'lv-1', userId: 'user-livreur' }), update: jest.fn() },
      commandeRepo: { count: jest.fn().mockResolvedValue(0), query: jest.fn().mockResolvedValue([{ n: 0 }]) },
      walletRepo:   { findOne: jest.fn().mockResolvedValue(null) },
      tokenRepo:    { find: jest.fn().mockResolvedValue([]), update: jest.fn() },
      sessionService: { endSession: jest.fn() },
      notifBroadcast: { fermerSessionsTempsReel },
      logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
    });

    await svc.supprimerCompte('user-livreur', { password: 'secret' });

    expect(fermerSessionsTempsReel).toHaveBeenCalledWith('user-livreur', 'ACCOUNT_CLOSED');
  });
});

/* ============================================================
 * 3 — Disponibilité par zone dans la recherche des clients
 * ============================================================ */

describe('Recherche des livreurs par zone (clients)', () => {

  function fauxQb() {
    const conditions: string[] = [];
    const qb: any = { conditions, getCount: jest.fn().mockResolvedValue(0) };
    for (const m of ['where', 'andWhere']) qb[m] = jest.fn((sql: string) => { conditions.push(sql); return qb; });
    return qb;
  }

  it('3. la condition exclut un livreur marqué « Non disponible » sur la zone', () => {
    const sql = livreurDisponibleDansZone('zone');
    expect(sql).toContain('"lp"."zonesDisponibles" IS NOT NULL');
    expect(sql).toContain('LOWER("lp"."zonesDisponibles"::text) NOT LIKE LOWER(:zone)');
  });

  it('3. le filtre « Zone » de la liste applique cette condition', () => {
    const qb = fauxQb();
    const svc = monter(LivreursClientService, {});
    (svc as any).applyFilters(qb, { zone: 'Kaloum' });
    expect(qb.conditions).toContain(livreurDisponibleDansZone('zone'));
  });

  it('3. les compteurs par commune l’appliquent aussi', async () => {
    const qb = fauxQb();
    const svc = monter(LivreursClientService, { geoService: { itemsByNiveau: jest.fn().mockResolvedValue([{ nom: 'Kaloum' }]) } });
    (svc as any).buildBaseQuery = () => qb;
    await svc.getZoneCounts();
    expect(qb.conditions).toContain(livreurDisponibleDansZone('c'));
  });
});

/* ============================================================
 * 4 — Validation administrateur
 * ============================================================ */

describe('Validations administrateur — livreurs', () => {

  it('4. montre les pièces envoyées par le livreur, jamais l’identifiant du fichier', async () => {
    const livreur = {
      commune: 'Kaloum', ville: 'Conakry',
      documentCni: 'documents/cni-secret', documentPermis: null, documentAssurance: 'documents/assur-secret', documentCasier: null,
      user: { id: 'user-lv', firstName: 'Mamadou', lastName: 'Diallo', createdAt: new Date() },
    };
    const svc = monter(AdminActeursService, {
      zoneService:  { adminOf: jest.fn().mockResolvedValue({ id: 'adm-1', fullName: 'Admin Zone', zone: 'Conakry' }) },
      partnerRepo:  { find: jest.fn().mockResolvedValue([]) },
      companyRepo:  { find: jest.fn().mockResolvedValue([]) },
      deliveryRepo: { find: jest.fn().mockResolvedValueOnce([livreur]).mockResolvedValue([]) },
    });

    const { list } = await svc.getValidations('user-admin');

    expect(list[0]).toEqual(expect.objectContaining({
      type: 'lvr', commune: 'Kaloum',
      livreurDocs: { cni: true, permis: false, assurance: true, casier: false },
    }));
    expect(JSON.stringify(list)).not.toContain('secret');
  });
});

/* ============================================================
 * A — Documents renouvelés par un livreur déjà vérifié
 * ============================================================ */

describe('Revérification des documents renouvelés', () => {

  function monterProfil(livreur: Record<string, unknown>) {
    const etat = { ...livreur };
    const livreurRepo = {
      findOne: jest.fn(() => Promise.resolve({ ...etat })),
      update:  jest.fn((_where: unknown, patch: Record<string, unknown>) => { Object.assign(etat, patch); return Promise.resolve(); }),
    };
    const svc = monter(ProfilLivreurService, {
      livreurRepo,
      uploadService: { uploadDocument: jest.fn().mockResolvedValue({ publicId: 'documents/nouveau' }), delete: jest.fn() },
      logger: { log: jest.fn(), warn: jest.fn() },
    });
    return { svc, livreurRepo, etat };
  }
  const verifie = { id: 'lv-1', userId: 'u-lv', documentCni: 'documents/cni', documentPermis: 'documents/permis', verificationStatus: LivreurVerificationStatus.VERIFIED };

  it('A. livreur vérifié qui remplace son permis : dossier « en cours de vérification »', async () => {
    const { svc, etat } = monterProfil(verifie);
    const r = await svc.uploadDocument('u-lv', 'permis', {} as Express.Multer.File);
    expect(r.verificationStatus).toBe(LivreurVerificationStatus.REVIEWING);
    expect(etat.verificationStatus).toBe(LivreurVerificationStatus.REVIEWING);
  });

  it('A. pièce facultative (assurance) : reste vérifié', async () => {
    const { svc, etat } = monterProfil(verifie);
    await svc.uploadDocument('u-lv', 'assurance', {} as Express.Multer.File);
    expect(etat.verificationStatus).toBe(LivreurVerificationStatus.VERIFIED);
  });

  it('A. livreur vérifié qui supprime sa CNI : dossier incomplet', async () => {
    const { svc, etat } = monterProfil(verifie);
    await svc.deleteDocument('u-lv', 'cni');
    expect(etat.verificationStatus).toBe(LivreurVerificationStatus.PENDING);
  });

  function monterAdmin(verificationStatus: LivreurVerificationStatus) {
    const user = { id: 'u-lv', role: UserRole.DELIVERY, status: UserStatus.ACTIVE, firstName: 'Mamadou', lastName: 'Diallo', createdAt: new Date() };
    const deps = {
      zoneService:    { adminOf: jest.fn().mockResolvedValue({ id: 'adm-1', fullName: 'Admin Zone', zone: 'Conakry' }) },
      userRepo:       { findOne: jest.fn().mockResolvedValue(user), save: jest.fn() },
      deliveryRepo:   {
        findOne: jest.fn().mockResolvedValue({ id: 'lv-1', verificationStatus }),
        find:    jest.fn().mockResolvedValue([]),
        update:  jest.fn(),
      },
      partnerRepo:    { find: jest.fn().mockResolvedValue([]) },
      companyRepo:    { find: jest.fn().mockResolvedValue([]) },
      auditLogRepo:   { create: jest.fn((x: unknown) => x), save: jest.fn() },
      cache:          { del: jest.fn() },
      notifEvents:    { notifyActeurAccountApproved: jest.fn(), notifyActeurAccountRejected: jest.fn() },
      notifBroadcast: { deconnecterUtilisateur: jest.fn() },
      settingsCache:  { getSettings: jest.fn().mockResolvedValue({ kycRequired: false }) },
      communication:  { getTemplate: jest.fn().mockResolvedValue(null) },
    };
    const svc = monter(AdminActeursService, deps);
    jest.spyOn(svc as unknown as { resolveProfile: () => Promise<null> }, 'resolveProfile').mockResolvedValue(null);
    jest.spyOn(svc as unknown as { invalidateActeursCache: () => Promise<void> }, 'invalidateActeursCache').mockResolvedValue();
    return { svc, deps };
  }

  it('A. admin : renouvellement listé dans Validations', async () => {
    const { svc, deps } = monterAdmin(LivreurVerificationStatus.REVIEWING);
    deps.deliveryRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ commune: 'Kaloum', documentCni: 'x', documentPermis: 'y', updatedAt: new Date(),
                                user: { id: 'u-lv', firstName: 'Mamadou', lastName: 'Diallo', createdAt: new Date() } }]);
    const { list } = await svc.getValidations('u-admin');
    expect(list).toEqual([expect.objectContaining({ id: 'u-lv', type: 'lvr', renouvellement: true })]);
  });

  it('A. admin valide : « vérifié », le compte n’est pas touché', async () => {
    const { svc, deps } = monterAdmin(LivreurVerificationStatus.REVIEWING);
    const r = await svc.approveValidation('u-admin', 'u-lv');
    expect(r).toMatchObject({ renouvellement: true });
    expect(deps.deliveryRepo.update).toHaveBeenCalledWith('lv-1', { verificationStatus: LivreurVerificationStatus.VERIFIED });
    expect(deps.userRepo.save).not.toHaveBeenCalled();
  });

  it('A. admin refuse : pièce « refusée », compte NI suspendu NI déconnecté', async () => {
    const { svc, deps } = monterAdmin(LivreurVerificationStatus.REVIEWING);
    await svc.rejectValidation('u-admin', 'u-lv');
    expect(deps.deliveryRepo.update).toHaveBeenCalledWith('lv-1', { verificationStatus: LivreurVerificationStatus.REJECTED });
    expect(deps.userRepo.save).not.toHaveBeenCalled();
    expect(deps.notifBroadcast.deconnecterUtilisateur).not.toHaveBeenCalled();
  });
});

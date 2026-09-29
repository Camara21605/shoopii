/* ============================================================
 * FICHIER : src/modules/dashboard/partenaire/parametres-partenaire-branchement.spec.ts
 *
 * Non-régression de l'audit « les paramètres du partenaire sont-ils bien
 * branchés ? » (2026-09) :
 *  1. Zone sensible : pause réversible sans toucher au statut, désactivation
 *     30 jours réellement levée par la tâche planifiée, vraie suppression,
 *     lien de parrainage inactif pendant une pause.
 *  2. Mot de passe : règles côté serveur, deux colonnes écrites.
 *  3. « Nouvel acteur activé » coupé : aucune notification.
 *  5. Un enregistrement du profil n'écrit que ses colonnes.
 * ============================================================ */

import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcryptjs';

import { DangerPartenaireService, PAUSE_PARTENAIRE_INDEFINIE } from './services/danger-partenaire.service';
import { SecuritePartenaireService } from './services/securite-partenaire.service';
import { ProfilPartenaireService } from './services/profil-partenaire.service';
import { PartenaireParametresController } from './partenaire-parametres.controller';
import { AdminActeursService } from '../administrateur/services/admin-acteurs.service';
import { PublicService } from '../../public/public.service';
import { ExpiryCronService } from '../../../jobs/expiry-cron.service';
import { PartnerStatus } from '../../../database/entities/profiles/partenaire-profile.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

function monter<T>(Classe: abstract new (...args: any[]) => T, deps: Record<string, unknown>): T {
  return Object.assign(Object.create(Classe.prototype), deps) as T;
}
const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

/* ============================================================
 * 1 — Zone sensible
 * ============================================================ */

describe('Zone sensible du partenaire', () => {

  async function monterDanger(partner: Record<string, unknown>, solde = 0) {
    const deps = {
      partnerRepo: { findOne: jest.fn().mockResolvedValue({ id: 'p-1', userId: 'u-p', suspendedUntil: null, ...partner }), update: jest.fn(), remove: jest.fn() },
      userRepo: {
        findOne:    jest.fn().mockResolvedValue({ id: 'u-p', password: await bcrypt.hash('Secret123', 4) }),
        softDelete: jest.fn(), update: jest.fn(),
      },
      tokenRepo:   { find: jest.fn().mockResolvedValue([{ id: 't', sessionId: 's1' }]), update: jest.fn() },
      walletRepo:  { findOne: jest.fn().mockResolvedValue(solde ? { balance: solde, pendingBalance: 0 } : null) },
      sessionService: { endSession: jest.fn().mockResolvedValue(undefined) },
      notifBroadcast: { fermerSessionsTempsReel: jest.fn().mockResolvedValue(undefined) },
      logger,
    };
    return { svc: monter(DangerPartenaireService, deps), deps };
  }

  it('1. mauvais mot de passe : aucune action', async () => {
    const { svc, deps } = await monterDanger({ status: PartnerStatus.ACTIVE });
    await expect(svc.pauseCompte('u-p', { password: 'x' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(deps.partnerRepo.update).not.toHaveBeenCalled();
  });

  it('1. pause : ni « en attente de validation » ni « suspendu » — seule la date de pause est écrite', async () => {
    const { svc, deps } = await monterDanger({ status: PartnerStatus.ACTIVE });
    await svc.pauseCompte('u-p', { password: 'Secret123' });
    expect(deps.partnerRepo.update).toHaveBeenCalledWith('p-1', { suspendedUntil: PAUSE_PARTENAIRE_INDEFINIE });
  });

  it('1. désactivation : reprise dans 30 jours, statut inchangé', async () => {
    const { svc, deps } = await monterDanger({ status: PartnerStatus.ACTIVE });
    await svc.desactiverCompte('u-p', { password: 'Secret123' });
    const [, patch] = deps.partnerRepo.update.mock.calls[0];
    expect(Object.keys(patch)).toEqual(['suspendedUntil']);
    const jours = (patch.suspendedUntil.getTime() - Date.now()) / 86_400_000;
    expect(jours).toBeGreaterThan(29.9);
    expect(jours).toBeLessThan(30.1);
  });

  it('1. reprendre : seulement une pause volontaire, jamais une suspension de l’administration', async () => {
    const pause = await monterDanger({ status: PartnerStatus.ACTIVE, suspendedUntil: PAUSE_PARTENAIRE_INDEFINIE });
    await pause.svc.reprendre('u-p');
    expect(pause.deps.partnerRepo.update).toHaveBeenCalledWith('p-1', { suspendedUntil: null });

    /* Suspendu par l'administration (même avec une date de fin) : jamais levé par le partenaire */
    const admin = await monterDanger({ status: PartnerStatus.SUSPENDED, suspendedUntil: new Date(Date.now() + 86_400_000) });
    await expect(admin.svc.reprendre('u-p')).rejects.toBeInstanceOf(BadRequestException);
    await expect(admin.svc.pauseCompte('u-p', { password: 'Secret123' })).rejects.toBeInstanceOf(BadRequestException);
    expect(admin.deps.partnerRepo.update).not.toHaveBeenCalled();
  });

  it('1. suppression refusée tant que le portefeuille contient des commissions', async () => {
    const { svc, deps } = await monterDanger({ status: PartnerStatus.ACTIVE }, 12000);
    await expect(svc.supprimerCompte('u-p', { password: 'Secret123' })).rejects.toThrow(/portefeuille/);
    expect(deps.userRepo.softDelete).not.toHaveBeenCalled();
  });

  it('1. suppression : fiche conservée, compte supprimé, toutes les sessions coupées', async () => {
    const { svc, deps } = await monterDanger({ status: PartnerStatus.ACTIVE });
    await svc.supprimerCompte('u-p', { password: 'Secret123' });
    expect(deps.partnerRepo.remove).not.toHaveBeenCalled();
    expect(deps.userRepo.softDelete).toHaveBeenCalledWith('u-p');
    expect(deps.tokenRepo.update).toHaveBeenCalledWith({ userId: 'u-p', revoked: false }, { revoked: true, revokedReason: 'ACCOUNT_CLOSED' });
    expect(deps.notifBroadcast.fermerSessionsTempsReel).toHaveBeenCalledWith('u-p', 'ACCOUNT_CLOSED');
  });

  it('1. limite d’essais sur les actions protégées par mot de passe', () => {
    const proto = PartenaireParametresController.prototype as unknown as Record<string, object>;
    for (const m of ['pauseCompte', 'desactiverCompte', 'supprimerCompte']) {
      expect(Reflect.getMetadata(GUARDS_METADATA, proto[m])).toContain(ThrottlerGuard);
    }
  });

  it('1. lien de parrainage inactif pendant une pause', async () => {
    const svc = monter(PublicService, {
      partnerRepo: { findOne: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Mamadou', status: PartnerStatus.ACTIVE, suspendedUntil: PAUSE_PARTENAIRE_INDEFINIE }), increment: jest.fn() },
    });
    await expect(svc.resolveReferral('mamadou')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('1. la tâche planifiée lève la désactivation 30 jours des partenaires', async () => {
    const wheres: string[] = [];
    const qb: any = { execute: jest.fn().mockResolvedValue({ affected: 1 }) };
    for (const m of ['update', 'set']) qb[m] = jest.fn(() => qb);
    for (const m of ['where', 'andWhere']) qb[m] = jest.fn((sql: string) => { wheres.push(sql); return qb; });
    const repoVide = { find: jest.fn().mockResolvedValue([]), createQueryBuilder: jest.fn(() => qb) };
    const partnerRepo = { createQueryBuilder: jest.fn(() => qb) };
    const cron = monter(ExpiryCronService, { livreurRepo: repoVide, companyRepo: repoVide, partnerRepo, logger });

    await cron.runAutoReactivation();

    expect(partnerRepo.createQueryBuilder).toHaveBeenCalled();
    expect(qb.set).toHaveBeenCalledWith({ suspendedUntil: null });
  });
});

/* ============================================================
 * 2 — Mot de passe
 * ============================================================ */

describe('Changement de mot de passe du partenaire', () => {

  async function monterSecurite() {
    const deps = {
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'u-p', password: await bcrypt.hash('Ancien123', 4) }), update: jest.fn(), save: jest.fn() },
      refreshTokenRepo: { update: jest.fn() },
      notifBroadcast: { fermerSessionsTempsReel: jest.fn().mockResolvedValue(undefined) },
      logger,
    };
    return { svc: monter(SecuritePartenaireService, deps), deps };
  }

  it('2. mot de passe trop faible refusé côté serveur', async () => {
    const { svc } = await monterSecurite();
    await expect(svc.updatePassword('u-p', { currentPassword: 'Ancien123', newPassword: 'sansmajuscule1', confirmPassword: 'sansmajuscule1' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('2. mot de passe valide : seules deux colonnes écrites', async () => {
    const { svc, deps } = await monterSecurite();
    await svc.updatePassword('u-p', { currentPassword: 'Ancien123', newPassword: 'Nouveau123', confirmPassword: 'Nouveau123' });
    expect(deps.userRepo.save).not.toHaveBeenCalled();
    expect(Object.keys(deps.userRepo.update.mock.calls[0][1]).sort()).toEqual(['lastPasswordChangedAt', 'password']);
  });
});

/* ============================================================
 * 3 — Notification « Nouvel acteur activé »
 * ============================================================ */

describe('Notification « Nouvel acteur activé »', () => {

  function monterAdmin(notifSettings: string | null) {
    const notifyPartnerActeurActivated = jest.fn().mockResolvedValue(undefined);
    const svc = monter(AdminActeursService, {
      companyRepo: { findOne: jest.fn().mockResolvedValue({ id: 'co-1', partnerId: 'p-1' }) },
      partnerRepo: { findOne: jest.fn().mockResolvedValue({ id: 'p-1', notifSettings }) },
      notifEvents: { notifyPartnerActeurActivated },
    });
    return { svc, notifyPartnerActeurActivated };
  }

  it('3. envoyée par défaut', async () => {
    const { svc, notifyPartnerActeurActivated } = monterAdmin(null);
    await (svc as any).notifyRecruitingPartner('u-co', UserRole.COMPANY, 'Boutique Test');
    expect(notifyPartnerActeurActivated).toHaveBeenCalled();
  });

  it('3. coupée par le partenaire : non envoyée', async () => {
    const { svc, notifyPartnerActeurActivated } = monterAdmin(JSON.stringify({ notifActeurActive: false }));
    await (svc as any).notifyRecruitingPartner('u-co', UserRole.COMPANY, 'Boutique Test');
    expect(notifyPartnerActeurActivated).not.toHaveBeenCalled();
  });
});

/* ============================================================
 * 5 — Écriture ciblée
 * ============================================================ */

describe('Profil du partenaire', () => {

  it('5. n’écrit que ses colonnes (jamais le statut ni les compteurs)', async () => {
    const partnerRepo = { findOne: jest.fn().mockResolvedValue({ id: 'p-1', userId: 'u-p', name: 'Ancien', bio: null, status: 'active', totalCompanies: 7 }), update: jest.fn(), save: jest.fn() };
    const userRepo    = { findOne: jest.fn().mockResolvedValue({ id: 'u-p', firstName: 'A', lastName: 'B', nameChangedAt: null }), update: jest.fn(), save: jest.fn() };
    const svc = monter(ProfilPartenaireService, {
      partnerRepo, userRepo, logger,
      sessionService: { getSessionMeta: jest.fn().mockResolvedValue(null) },
    });
    await svc.updateProfil('u-p', { name: 'Nouveau nom' });
    expect(partnerRepo.save).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(partnerRepo.update).toHaveBeenCalledWith('p-1', { name: 'Nouveau nom', bio: null });
  });
});

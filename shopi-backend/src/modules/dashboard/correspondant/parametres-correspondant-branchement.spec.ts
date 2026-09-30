/* ============================================================
 * FICHIER : src/modules/dashboard/correspondant/parametres-correspondant-branchement.spec.ts
 *
 * Non-régression de l'audit « les paramètres du correspondant sont-ils bien
 * branchés ? » (2026-09) :
 *  1. Zone sensible : mot de passe exigé, pause réversible (jamais sur une
 *     suspension décidée par l'entreprise / l'admin), vraie suppression.
 *  2. Mot de passe : règles côté serveur, limite d'essais.
 *  3. Notifications : pilotent les préférences réelles du moteur.
 *  4. Confidentialité : téléphone, statistiques et visibilité respectés.
 *  5. Les identifiants de stockage des pièces ne sortent jamais du serveur.
 *  6. Un enregistrement n'écrit que ses propres colonnes.
 *  A. Règles colis appliquées à la commande : compte actif, valeur max, capacité max.
 * ============================================================ */

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcryptjs';

import { DangerService } from './services/danger.service';
import { SecuriteService } from './services/securite.service';
import { NotificationsService } from './services/notifications.service';
import { ConfidentialiteService } from './services/confidentialite.service';
import { ProfilService } from './services/profil.service';
import { CorrespondantParametresController } from './correspondant-parametres.controller';
import { CorrespondantProfilService } from '../client/correspondant-profil.service';
import { SuivisCorrespondantService } from '../../suivis/services/suivis-correspondant.service';
import { CorrespondantStatus } from '../../../database/entities/profiles/correspondant-profile.entity';
import { CommandeCreationService, STATUTS_COLIS_EN_DEPOT } from '../../commande/services/commande-creation.service';
import { NotificationActorType, NotificationType } from '../../../database/entities/notification/notification.entity';

function monter<T>(Classe: abstract new (...args: any[]) => T, deps: Record<string, unknown>): T {
  return Object.assign(Object.create(Classe.prototype), deps) as T;
}
const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

/* ============================================================
 * 1 — Zone sensible
 * ============================================================ */

describe('Zone sensible du correspondant', () => {

  async function monterDanger(cor: Record<string, unknown>, opts: { enCours?: number; solde?: number } = {}) {
    const deps = {
      userRepo: {
        findOne:    jest.fn().mockResolvedValue({ id: 'u-cor', password: await bcrypt.hash('Secret123', 4) }),
        softDelete: jest.fn().mockResolvedValue(undefined),
        update:     jest.fn().mockResolvedValue(undefined),
      },
      corRepo:      { findOne: jest.fn().mockResolvedValue({ id: 'cor-1', userId: 'u-cor', ...cor }), update: jest.fn() },
      commandeRepo: { count: jest.fn().mockResolvedValue(opts.enCours ?? 0) },
      walletRepo:   { findOne: jest.fn().mockResolvedValue(opts.solde ? { balance: opts.solde, pendingBalance: 0 } : null) },
      tokenRepo:    { find: jest.fn().mockResolvedValue([{ id: 't1', sessionId: 's1' }]), update: jest.fn() },
      sessionService: { endSession: jest.fn().mockResolvedValue(undefined) },
      notifBroadcast: { fermerSessionsTempsReel: jest.fn().mockResolvedValue(undefined) },
      logger,
    };
    return { svc: monter(DangerService, deps), deps };
  }

  it('1. mauvais mot de passe : aucune action', async () => {
    const { svc, deps } = await monterDanger({ status: CorrespondantStatus.ACTIVE });
    await expect(svc.suspendreCompte('u-cor', 'mauvais')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.supprimerCompte('u-cor', '')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(deps.corRepo.update).not.toHaveBeenCalled();
    expect(deps.userRepo.softDelete).not.toHaveBeenCalled();
  });

  it('1. pause = DISABLED (jamais SUSPENDED, réservé à l’entreprise / l’admin), seul le statut est écrit', async () => {
    const { svc, deps } = await monterDanger({ status: CorrespondantStatus.ACTIVE });
    await svc.suspendreCompte('u-cor', 'Secret123');
    expect(deps.corRepo.update).toHaveBeenCalledWith('cor-1', { status: CorrespondantStatus.DISABLED });
  });

  it('1. reprendre : seulement une pause volontaire', async () => {
    const pause = await monterDanger({ status: CorrespondantStatus.DISABLED });
    await pause.svc.reprendre('u-cor');
    expect(pause.deps.corRepo.update).toHaveBeenCalledWith('cor-1', { status: CorrespondantStatus.ACTIVE });

    const suspendu = await monterDanger({ status: CorrespondantStatus.SUSPENDED });
    await expect(suspendu.svc.reprendre('u-cor')).rejects.toBeInstanceOf(BadRequestException);
    await expect(suspendu.svc.suspendreCompte('u-cor', 'Secret123')).rejects.toBeInstanceOf(BadRequestException);
    expect(suspendu.deps.corRepo.update).not.toHaveBeenCalled();
  });

  it('1. suppression refusée tant qu’une commande passe par le relais ou que le portefeuille a des fonds', async () => {
    const colis = await monterDanger({ status: CorrespondantStatus.ACTIVE }, { enCours: 2 });
    await expect(colis.svc.supprimerCompte('u-cor', 'Secret123')).rejects.toThrow(/2 commande/);
    const fonds = await monterDanger({ status: CorrespondantStatus.ACTIVE }, { solde: 5000 });
    await expect(fonds.svc.supprimerCompte('u-cor', 'Secret123')).rejects.toThrow(/portefeuille/);
    expect(fonds.deps.userRepo.softDelete).not.toHaveBeenCalled();
  });

  it('1. suppression : compte supprimé (purge à 30 j) et TOUTES les sessions coupées', async () => {
    const { svc, deps } = await monterDanger({ status: CorrespondantStatus.ACTIVE });
    await svc.supprimerCompte('u-cor', 'Secret123');
    expect(deps.corRepo.update).toHaveBeenCalledWith('cor-1', { status: CorrespondantStatus.DELETED });
    expect(deps.userRepo.softDelete).toHaveBeenCalledWith('u-cor');
    expect(deps.tokenRepo.update).toHaveBeenCalledWith({ userId: 'u-cor', revoked: false }, { revoked: true, revokedReason: 'ACCOUNT_CLOSED' });
    expect(deps.sessionService.endSession).toHaveBeenCalledWith('u-cor', 's1');
    expect(deps.notifBroadcast.fermerSessionsTempsReel).toHaveBeenCalledWith('u-cor', 'ACCOUNT_CLOSED');
  });

  it('1 & 2. limite d’essais sur la pause, la suppression et le changement de mot de passe', () => {
    const proto = CorrespondantParametresController.prototype as unknown as Record<string, object>;
    for (const m of ['suspendreCompte', 'desactiverCompte', 'supprimerCompte', 'changePassword']) {
      expect(Reflect.getMetadata(GUARDS_METADATA, proto[m])).toContain(ThrottlerGuard);
    }
  });
});

/* ============================================================
 * 2 — Mot de passe
 * ============================================================ */

describe('Changement de mot de passe du correspondant', () => {

  function monterSecurite() {
    const qb: any = { where: jest.fn(() => qb), addSelect: jest.fn(() => qb), getOne: jest.fn() };
    const deps = {
      userRepo: { createQueryBuilder: jest.fn(() => qb), update: jest.fn(), save: jest.fn() },
      refreshTokenRepo: { update: jest.fn() },
      notifBroadcast: { fermerSessionsTempsReel: jest.fn().mockResolvedValue(undefined) },
      logger,
    };
    return { svc: monter(SecuriteService, deps), deps, qb };
  }

  it('2. mot de passe trop faible refusé côté serveur', async () => {
    const { svc, qb } = monterSecurite();
    qb.getOne.mockResolvedValue({ id: 'u-cor', password: await bcrypt.hash('Ancien123', 4) });
    await expect(svc.changePassword('u-cor', { currentPassword: 'Ancien123', newPassword: 'a' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.changePassword('u-cor', { currentPassword: 'Ancien123', newPassword: 'sansmajuscule1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('2. mot de passe valide : seules deux colonnes écrites, sessions coupées', async () => {
    const { svc, deps, qb } = monterSecurite();
    qb.getOne.mockResolvedValue({ id: 'u-cor', password: await bcrypt.hash('Ancien123', 4) });
    await svc.changePassword('u-cor', { currentPassword: 'Ancien123', newPassword: 'Nouveau123' });
    expect(deps.userRepo.save).not.toHaveBeenCalled();
    const [id, patch] = deps.userRepo.update.mock.calls[0];
    expect(id).toBe('u-cor');
    expect(Object.keys(patch).sort()).toEqual(['lastPasswordChangedAt', 'password']);
    expect(deps.notifBroadcast.fermerSessionsTempsReel).toHaveBeenCalledWith('u-cor', 'PASSWORD_CHANGED');
  });
});

/* ============================================================
 * 3 — Notifications
 * ============================================================ */

describe('Notifications du correspondant', () => {

  const reglages = {
    colis:    { nouveauColis: false, transfertLivreur: false, colisRecupere: true },
    finances: { commissionEncaissee: false },
    canaux:   { push: true, email: false, sms: true },
  };

  it('3. traduit l’écran en préférences réelles', () => {
    expect(NotificationsService.versPreferences(reglages)).toEqual({
      globalPushEnabled: true,
      globalEmailEnabled: false,
      preferences: {
        [NotificationType.ORDER_PLACED]:         { push: false, email: false },
        [NotificationType.ORDER_STATUS_CHANGED]: { push: true },
      },
    });
  });

  it('3. l’enregistrement met à jour les préférences du moteur (acteur CORRESPONDENT)', async () => {
    const update = jest.fn().mockResolvedValue({});
    const svc = monter(NotificationsService, {
      corRepo: { findOne: jest.fn().mockResolvedValue({ id: 'cor-1', userId: 'u-cor' }), update: jest.fn() },
      prefs: { update }, logger,
    });
    await svc.updateNotifications('u-cor', { notifSettings: reglages });
    expect(update).toHaveBeenCalledWith(NotificationActorType.CORRESPONDENT, 'cor-1', expect.objectContaining({ globalEmailEnabled: false }));
  });
});

/* ============================================================
 * 4 — Confidentialité
 * ============================================================ */

describe('Confidentialité du correspondant', () => {

  function monterProfil(privacySettings: unknown) {
    const cor = {
      id: 'cor-1', status: CorrespondantStatus.ACTIVE, fullName: 'Fatou Camara', createdAt: new Date('2025-01-01'),
      depotPhone: '+224 620 00 00 00', totalMissions: 120, averageRating: 4.6, colisDelaiMax: 7, privacySettings,
      user: { phone: '+224 621 11 11 11', email: 'f@c.gn' },
    };
    return monter(CorrespondantProfilService, {
      corrRepo:    { findOne: jest.fn().mockResolvedValue(cor) },
      horaireRepo: { find: jest.fn().mockResolvedValue([]) },
      isSuivi:      jest.fn().mockResolvedValue(false),
      countAbonnes: jest.fn().mockResolvedValue(3),
    });
  }

  it('4. par défaut : téléphone et statistiques visibles', async () => {
    const p = await monterProfil(null).getProfil('cor-1');
    expect(JSON.stringify(p)).toContain('+224 620 00 00 00');
    expect(p.missions).toBe(120);
    expect(p.statsMasquees).toBe(false);
  });

  it('4. « Afficher mon téléphone » / « mes statistiques » coupés : rien n’est exposé', async () => {
    const p = await monterProfil({ visibilite: { afficherTelephone: false, afficherStats: false } }).getProfil('cor-1');
    expect(JSON.stringify(p)).not.toContain('620 00 00 00');
    expect(JSON.stringify(p)).not.toContain('621 11 11 11');
    expect(p.statsMasquees).toBe(true);
    expect(p.missions).toBe(0);
  });

  it('4. « Apparaître dans la recherche » coupé : exclu de la liste et de la recherche', async () => {
    const conditions: string[] = [];
    const qb: any = { getMany: jest.fn().mockResolvedValue([]) };
    for (const m of ['leftJoinAndSelect', 'take']) qb[m] = jest.fn(() => qb);
    for (const m of ['where', 'andWhere']) qb[m] = jest.fn((sql: string) => { conditions.push(sql); return qb; });
    const svc = monter(SuivisCorrespondantService, { correspondantRepo: { createQueryBuilder: jest.fn(() => qb) } });

    await svc.getCorrespondantsWithSuiviStatus('anonymous', 'client' as any, { search: 'fatou' });

    expect(conditions).toContain(`(cor."privacySettings"->'visibilite'->>'apparaitreRecherche') IS DISTINCT FROM 'false'`);
  });
});

/* ============================================================
 * 5 & 6 — Pièces masquées, écriture ciblée
 * ============================================================ */

describe('Réponses et enregistrements des paramètres', () => {

  it('5. GET paramètres : identifiants des pièces jamais renvoyés', async () => {
    const svc = monter(ProfilService, {
      corRepo:     { findOne: jest.fn().mockResolvedValue({ id: 'cor-1', userId: 'u-cor', documentCni: 'documents/cni-secret', documentCasier: 'documents/casier-secret', documentBail: null }) },
      userRepo:    { findOne: jest.fn().mockResolvedValue({ id: 'u-cor', firstName: 'F', lastName: 'C' }) },
      horaireRepo: { find: jest.fn().mockResolvedValue([{ jour: 'lundi' }]) },
      sessionService: { getSessionMeta: jest.fn().mockResolvedValue(null) },
    });
    const res: any = await svc.getParametres('u-cor', null);
    expect(JSON.stringify(res)).not.toContain('secret');
    expect(res.documentCni).toBeTruthy();       // présence conservée pour l'écran
    expect(res.documentBail).toBeNull();
  });

  it('6. un réglage n’écrit que ses colonnes (jamais le statut)', async () => {
    const update = jest.fn();
    const svc = monter(ConfidentialiteService, {
      corRepo: {
        findOne: jest.fn().mockResolvedValue({ id: 'cor-1', userId: 'u-cor', status: CorrespondantStatus.ACTIVE, privacySettings: null }),
        update, save: jest.fn(),
      },
      logger,
    });
    await svc.updateConfidentialite('u-cor', { privacySettings: { visibilite: { afficherTelephone: false } } });
    expect(update).toHaveBeenCalledWith('cor-1', { privacySettings: { visibilite: { afficherTelephone: false } } });
  });
});

/* ============================================================
 * A — Règles colis appliquées à la commande
 * ============================================================ */

describe('Règles colis du correspondant', () => {
  type Verif = { verifierReglesCorrespondant: (c: unknown, v: number[]) => Promise<void> };

  function monterCommande(enDepot = 0) {
    const commandeRepo = { count: jest.fn().mockResolvedValue(enDepot) };
    return { svc: monter(CommandeCreationService, { commandeRepo }) as unknown as Verif, commandeRepo };
  }
  const cor = (extra: Record<string, unknown> = {}) => ({
    id: 'cor-1', fullName: 'Point Kaloum', status: CorrespondantStatus.ACTIVE,
    colisValeurMax: 1_000_000, colisCapaciteMax: 10, ...extra,
  });

  it('A. dans les limites : commande acceptée (colis en cours = payés et non terminés)', async () => {
    const { svc, commandeRepo } = monterCommande(8);
    await expect(svc.verifierReglesCorrespondant(cor(), [200_000, 300_000])).resolves.toBeUndefined();
    expect(commandeRepo.count).toHaveBeenCalledWith({ where: { correspondantId: 'cor-1', status: expect.objectContaining({ _value: STATUTS_COLIS_EN_DEPOT }) } });
  });

  it('A. correspondant en pause ou suspendu : refusé', async () => {
    for (const status of [CorrespondantStatus.DISABLED, CorrespondantStatus.SUSPENDED, CorrespondantStatus.DELETED]) {
      await expect(monterCommande().svc.verifierReglesCorrespondant(cor({ status }), [1000])).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('A. colis au-dessus de la valeur max : refusé', async () => {
    await expect(monterCommande().svc.verifierReglesCorrespondant(cor(), [1_500_000])).rejects.toThrow(/1\s?000\s?000 GNF/);
  });

  it('A. capacité atteinte : refusé', async () => {
    await expect(monterCommande(9).svc.verifierReglesCorrespondant(cor(), [1000, 2000])).rejects.toThrow(/capacité maximale/);
  });

  it('A. 0 = sans limite', async () => {
    const { svc, commandeRepo } = monterCommande(500);
    await expect(svc.verifierReglesCorrespondant(cor({ colisValeurMax: 0, colisCapaciteMax: 0 }), [9_000_000_000])).resolves.toBeUndefined();
    expect(commandeRepo.count).not.toHaveBeenCalled();
  });
});

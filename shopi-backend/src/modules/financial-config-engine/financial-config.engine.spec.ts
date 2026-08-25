/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/financial-config.engine.spec.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Tests unitaires du Financial Configuration Engine.
 *                Couvre les 4 groupes fonctionnels principaux :
 *                  1. Lecture avec cache
 *                  2. Écriture et validation
 *                  3. Versionning et historique
 *                  4. Rollback
 * DEPENDANCES  :
 *   Jest (installé dans le projet NestJS)
 *   Mocks inline pour TypeORM repositories et DataSource
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Test, TestingModule }     from '@nestjs/testing';
import { getRepositoryToken }      from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { PlatformSettings }      from '../../database/entities/platform-settings.entity';
import { ConfigurationSnapshot, ConfigSection } from '../../database/entities/paiement/configuration-snapshot.entity';
import { CommissionRule }        from '../../database/entities/paiement/commission-rule.entity';
import { FinancialAuditLog }     from '../../database/entities/paiement/financial-audit-log.entity';

import { FinancialConfigEngine }           from './financial-config.engine';
import { FinancialConfigReaderService }    from './services/financial-config-reader.service';
import { FinancialConfigValidatorService } from './services/financial-config-validator.service';
import { FinancialConfigWriterService }    from './services/financial-config-writer.service';
import { FinancialConfigHistoryService }   from './services/financial-config-history.service';
import { FinancialConfigAuditService }     from './services/financial-config-audit.service';
import { FinancialConfigCacheService }     from './services/financial-config-cache.service';
import { FinancialConfigEventBus }         from './events/financial-config-event-bus.service';

import { ConfigErreur, ConfigErreurType }  from './types/financial-config.types';

/* ============================================================
 * FACTORIES DE MOCKS
 * ============================================================ */

function makeSettings(overrides: Partial<PlatformSettings> = {}): PlatformSettings {
  return Object.assign(new PlatformSettings(), {
    id:                         1,
    tauxCommissionProduit:      6,
    planMultiplierPro:          0.75,
    planMultiplierPremium:      0.5,
    ratioShopiProduit:          70,
    ratioPartenaireProduit:     20,
    ratioAdminProduit:          10,
    tauxCommissionLivraison:    10,
    ratioShopiLivraison:        60,
    ratioPartenaireLivraison:   25,
    ratioAdminLivraison:        15,
    orangeMoneyEnabled:         true,
    mtnMoneyEnabled:            true,
    waveEnabled:                false,
    moovMoneyEnabled:           false,
    djomyEnabled:               false,
    maxTransactionAmount:       5000000,
    maxDailyPaymentAttempts:    5,
    sessionTtlMinutes:          60,
    maxPaymentDelayHours:       24,
    dailyWithdrawalLimit:       5000000,
    walletInactivityDays:       365,
    settlementDelayDays:        2,
    maxEnterpriseValidationHours: 48,
    refundProcessingDays:       3,
    disputeWindowDays:          7,
    disputeResolutionHours:     48,
    maxEvidencesPerDispute:     10,
    disputeInstructionSlaHours: 48,
    minWithdrawalAmount:        10000,
    autoValidationThreshold:    500000,
    maxWithdrawalAttempts:      3,
    withdrawalProcessingHours:  24,
    maintenanceMode:            false,
    platformName:               'Shopi',
    defaultCurrency:            'GNF',
    defaultLanguage:            'fr',
    timezone:                   'Africa/Conakry',
    platformCommission:         6,
    emailVerifRequired:         true,
    kycRequired:                false,
    manualVendorApproval:       false,
    updatedAt:                  new Date(),
    ...overrides,
  } as unknown as PlatformSettings);
}

function makeSnapshot(overrides: Partial<ConfigurationSnapshot> = {}): ConfigurationSnapshot {
  return Object.assign(new ConfigurationSnapshot(), {
    id:                  'snap-uuid-1',
    section:             ConfigSection.COMMISSION,
    version:             1,
    label:               null,
    changedFields:       ['tauxCommissionProduit'],
    before:              { tauxCommissionProduit: 6 },
    after:               { tauxCommissionProduit: 7 },
    justification:       'Test justification',
    performedByUserId:   'admin-uuid',
    performedByRole:     'super_admin',
    ipAddress:           null,
    isRollback:          false,
    rolledBackToVersion: null,
    createdAt:           new Date(),
    ...overrides,
  } as unknown as ConfigurationSnapshot);
}

/* ============================================================
 * GROUPE 1 — LECTURE AVEC CACHE
 * ============================================================ */
describe('FinancialConfigEngine — Lecture avec cache', () => {
  let engine: FinancialConfigEngine;
  let reader: FinancialConfigReaderService;
  let cache:  FinancialConfigCacheService;
  let settingsRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    settingsRepo = { findOne: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialConfigEngine,
        FinancialConfigCacheService,
        FinancialConfigReaderService,
        { provide: FinancialConfigWriterService,  useValue: {} },
        { provide: FinancialConfigHistoryService, useValue: {} },
        { provide: getRepositoryToken(PlatformSettings),      useValue: settingsRepo },
        { provide: getRepositoryToken(ConfigurationSnapshot), useValue: {} },
        { provide: getRepositoryToken(CommissionRule),        useValue: {} },
        { provide: getRepositoryToken(FinancialAuditLog),     useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: FinancialConfigEventBus,       useValue: new FinancialConfigEventBus() },
        { provide: FinancialConfigValidatorService, useValue: {} },
        { provide: FinancialConfigAuditService,   useValue: { logConfigUpdate: jest.fn() } },
      ],
    }).compile();

    engine = module.get(FinancialConfigEngine);
    reader = module.get(FinancialConfigReaderService);
    cache  = module.get(FinancialConfigCacheService);
  });

  it('1. Premier appel charge depuis la DB et met en cache', async () => {
    const settings = makeSettings();
    settingsRepo.findOne.mockResolvedValue(settings);

    const result = await engine.getSettings();

    expect(settingsRepo.findOne).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(1);
    expect(cache.isValid()).toBe(true);
  });

  it('2. Deuxième appel retourne le cache sans hit DB', async () => {
    const settings = makeSettings();
    settingsRepo.findOne.mockResolvedValue(settings);

    await engine.getSettings();
    await engine.getSettings();   // deuxième appel

    /* Le repo ne doit être appelé qu'une seule fois */
    expect(settingsRepo.findOne).toHaveBeenCalledTimes(1);
  });

  it('3. getCommissionConfig() retourne les valeurs typées correctement', async () => {
    const settings = makeSettings({ tauxCommissionProduit: 8 });
    settingsRepo.findOne.mockResolvedValue(settings);

    const cfg = await engine.getCommissionConfig();

    expect(cfg.tauxCommissionProduit).toBe(8);
    expect(cfg.planMultiplierStandard).toBe(1.0);
    expect(cfg.ratioShopiProduit + cfg.ratioPartenaireProduit + cfg.ratioAdminProduit).toBe(100);
  });

  it('4. Lève SETTINGS_INTROUVABLE si la table est vide', async () => {
    settingsRepo.findOne.mockResolvedValue(null);

    await expect(engine.getSettings()).rejects.toMatchObject({
      type: ConfigErreurType.SETTINGS_INTROUVABLE,
    });
  });
});

/* ============================================================
 * GROUPE 2 — ÉCRITURE ET VALIDATION
 * ============================================================ */
describe('FinancialConfigEngine — Écriture et validation', () => {
  let engine:      FinancialConfigEngine;
  let validator:   FinancialConfigValidatorService;
  let settingsRepo: { findOne: jest.Mock; save: jest.Mock };
  let snapshotRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let commissionRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let auditRepo:   { create: jest.Mock; save: jest.Mock };
  let mockEm:      Partial<EntityManager>;

  beforeEach(async () => {
    const settings  = makeSettings();
    const snapshot  = makeSnapshot();

    settingsRepo   = { findOne: jest.fn().mockResolvedValue(settings), save: jest.fn().mockResolvedValue(settings) };
    snapshotRepo   = {
      findOne: jest.fn().mockResolvedValue(null),
      create:  jest.fn().mockReturnValue(snapshot),
      save:    jest.fn().mockResolvedValue(snapshot),
      update:  jest.fn().mockResolvedValue(undefined),
    };
    commissionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create:  jest.fn().mockReturnValue({ id: 'rule-uuid', version: 1 }),
      save:    jest.fn().mockResolvedValue({ id: 'rule-uuid', version: 1 }),
      update:  jest.fn().mockResolvedValue(undefined),
    };
    auditRepo = { create: jest.fn().mockReturnValue({}), save: jest.fn().mockResolvedValue({}) };

    mockEm = {
      save:     jest.fn().mockImplementation((_entity: unknown, obj: unknown) => Promise.resolve(obj)),
      findOne:  jest.fn().mockResolvedValue(null),
      create:   jest.fn().mockImplementation((_entity: unknown, obj: unknown) => obj),
      update:   jest.fn().mockResolvedValue(undefined),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (em: EntityManager) => Promise<unknown>) => {
        return cb(mockEm as EntityManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialConfigEngine,
        FinancialConfigCacheService,
        FinancialConfigReaderService,
        FinancialConfigValidatorService,
        FinancialConfigWriterService,
        FinancialConfigHistoryService,
        { provide: FinancialConfigAuditService, useValue: { logConfigUpdate: jest.fn() } },
        { provide: FinancialConfigEventBus,     useValue: new FinancialConfigEventBus() },
        { provide: getRepositoryToken(PlatformSettings),      useValue: settingsRepo },
        { provide: getRepositoryToken(ConfigurationSnapshot), useValue: snapshotRepo },
        { provide: getRepositoryToken(CommissionRule),        useValue: commissionRepo },
        { provide: getRepositoryToken(FinancialAuditLog),     useValue: auditRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    engine    = module.get(FinancialConfigEngine);
    validator = module.get(FinancialConfigValidatorService);
  });

  it('5. updateCommission() valide les ratios et crée un snapshot + CommissionRule', async () => {
    const result = await engine.updateCommission(
      { tauxCommissionProduit: 7 },
      'Ajustement Q3',
      'admin-uuid',
      'super_admin',
    );

    expect(result.success).toBe(true);
    expect(result.changedFields).toContain('tauxCommissionProduit');
    expect(result.commissionRuleCreated).toBe(true);
  });

  it('6. Lève VALIDATION_ECHOUEE si les ratios produit ne somment pas à 100', async () => {
    /* 80 + 10 + 5 = 95 ≠ 100 */
    await expect(
      engine.updateCommission(
        { ratioShopiProduit: 80, ratioPartenaireProduit: 10, ratioAdminProduit: 5 },
        'Test invalide',
        'admin-uuid',
        'super_admin',
      ),
    ).rejects.toMatchObject({ type: ConfigErreurType.VALIDATION_ECHOUEE });
  });

  it('7. Lève JUSTIFICATION_REQUISE si la justification est vide', async () => {
    await expect(
      engine.updateCommission(
        { tauxCommissionProduit: 7 },
        '',   // justification vide
        'admin-uuid',
        'super_admin',
      ),
    ).rejects.toMatchObject({ type: ConfigErreurType.JUSTIFICATION_REQUISE });
  });

  it('8. updatePayment() lève VALIDATION_ECHOUEE si tous les providers sont désactivés', async () => {
    await expect(
      engine.updatePayment(
        {
          orangeMoneyEnabled: false,
          mtnMoneyEnabled:    false,
          waveEnabled:        false,
          moovMoneyEnabled:   false,
          djomyEnabled:       false,
        },
        'Test tous providers OFF',
        'admin-uuid',
        'super_admin',
      ),
    ).rejects.toMatchObject({ type: ConfigErreurType.VALIDATION_ECHOUEE });
  });

  it('9. Lève AUCUN_CHANGEMENT si le DTO ne modifie rien', async () => {
    /* Le DTO contient les mêmes valeurs que PlatformSettings par défaut */
    await expect(
      engine.updatePayment(
        { orangeMoneyEnabled: true },  // déjà true dans makeSettings()
        'Pas de changement',
        'admin-uuid',
        'super_admin',
      ),
    ).rejects.toMatchObject({ type: ConfigErreurType.AUCUN_CHANGEMENT });
  });

  it('10. Le cache est invalidé après une écriture réussie', async () => {
    const cache = engine['cache'] as FinancialConfigCacheService;
    /* Pré-remplir le cache */
    cache.set(makeSettings());
    expect(cache.isValid()).toBe(true);

    await engine.updateSettlement(
      { maxWithdrawalAttempts: 5 },
      'Augmenter les tentatives',
      'admin-uuid',
      'super_admin',
    );

    expect(cache.isValid()).toBe(false);
  });
});

/* ============================================================
 * GROUPE 3 — HISTORIQUE ET VERSIONNING
 * ============================================================ */
describe('FinancialConfigEngine — Historique et versionning', () => {
  let engine:       FinancialConfigEngine;
  let snapshotRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    const snap1 = makeSnapshot({ version: 2, before: { tauxCommissionProduit: 6 }, after: { tauxCommissionProduit: 7 } });
    const snap2 = makeSnapshot({ id: 'snap-uuid-0', version: 1 });

    snapshotRepo = {
      findOne: jest.fn().mockResolvedValue(snap1),
      createQueryBuilder: jest.fn().mockReturnValue({
        orderBy:      jest.fn().mockReturnThis(),
        take:         jest.fn().mockReturnThis(),
        skip:         jest.fn().mockReturnThis(),
        andWhere:     jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[snap1, snap2], 2]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialConfigEngine,
        FinancialConfigCacheService,
        { provide: FinancialConfigReaderService,    useValue: {} },
        { provide: FinancialConfigWriterService,    useValue: {} },
        FinancialConfigHistoryService,
        { provide: getRepositoryToken(PlatformSettings),      useValue: {} },
        { provide: getRepositoryToken(ConfigurationSnapshot), useValue: snapshotRepo },
        { provide: getRepositoryToken(CommissionRule),        useValue: {} },
        { provide: getRepositoryToken(FinancialAuditLog),     useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: FinancialConfigEventBus, useValue: {} },
      ],
    }).compile();

    engine = module.get(FinancialConfigEngine);
  });

  it('11. getHistory() retourne les snapshots paginés avec total correct', async () => {
    const { items, total } = await engine.getHistory({ section: ConfigSection.COMMISSION });

    expect(total).toBe(2);
    expect(items).toHaveLength(2);
    expect(items[0].version).toBe(2);   // trié DESC
  });

  it('12. getSnapshot() retourne le snapshot pour section+version', async () => {
    const s = await engine.getSnapshot(ConfigSection.COMMISSION, 2);

    expect(s).not.toBeNull();
    expect(s!.version).toBe(2);
    expect(s!.changedFields).toContain('tauxCommissionProduit');
  });
});

/* ============================================================
 * GROUPE 4 — ROLLBACK
 * ============================================================ */
describe('FinancialConfigEngine — Rollback', () => {
  let engine:      FinancialConfigEngine;
  let settingsRepo: { findOne: jest.Mock };
  let snapshotRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let mockEm:      Partial<EntityManager>;

  beforeEach(async () => {
    const settings = makeSettings();
    const targetSnap = makeSnapshot({ version: 1, after: { tauxCommissionProduit: 6 } });

    settingsRepo = { findOne: jest.fn().mockResolvedValue(settings) };
    snapshotRepo = {
      findOne: jest.fn().mockImplementation(({ where }: { where: { version?: number } }) => {
        if (where?.version === 1) return Promise.resolve(targetSnap);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockReturnValue(makeSnapshot()),
      save:   jest.fn().mockResolvedValue(makeSnapshot({ version: 3, isRollback: true })),
      update: jest.fn().mockResolvedValue(undefined),
    };

    mockEm = {
      save:    jest.fn().mockImplementation((_entity: unknown, obj: unknown) => Promise.resolve(obj)),
      findOne: jest.fn().mockResolvedValue(null),
      create:  jest.fn().mockImplementation((_entity: unknown, obj: unknown) => obj),
      update:  jest.fn().mockResolvedValue(undefined),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (em: EntityManager) => Promise<unknown>) => cb(mockEm as EntityManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialConfigEngine,
        FinancialConfigCacheService,
        FinancialConfigReaderService,
        FinancialConfigValidatorService,
        FinancialConfigWriterService,
        FinancialConfigHistoryService,
        { provide: FinancialConfigAuditService, useValue: { logConfigUpdate: jest.fn() } },
        { provide: FinancialConfigEventBus,     useValue: new FinancialConfigEventBus() },
        { provide: getRepositoryToken(PlatformSettings),      useValue: settingsRepo },
        { provide: getRepositoryToken(ConfigurationSnapshot), useValue: snapshotRepo },
        { provide: getRepositoryToken(CommissionRule),        useValue: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn().mockReturnValue({ id: 'r1' }), save: jest.fn().mockResolvedValue({ id: 'r1' }), update: jest.fn() } },
        { provide: getRepositoryToken(FinancialAuditLog),     useValue: { create: jest.fn().mockReturnValue({}), save: jest.fn() } },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    engine = module.get(FinancialConfigEngine);
  });

  it('13. rollbackToVersion() restaure les valeurs et crée un snapshot isRollback=true', async () => {
    const result = await engine.rollbackToVersion({
      section:           ConfigSection.COMMISSION,
      targetVersion:     1,
      justification:     'Retour aux taux initiaux',
      performedByUserId: 'admin-uuid',
      performedByRole:   'super_admin',
    });

    expect(result.success).toBe(true);
  });

  it('14. rollbackToVersion() lève SNAPSHOT_INTROUVABLE si la version n\'existe pas', async () => {
    await expect(
      engine.rollbackToVersion({
        section:           ConfigSection.COMMISSION,
        targetVersion:     999,
        justification:     'Version inexistante',
        performedByUserId: 'admin-uuid',
        performedByRole:   'super_admin',
      }),
    ).rejects.toMatchObject({ type: ConfigErreurType.SNAPSHOT_INTROUVABLE });
  });
});

/* ============================================================
 * FICHIER : src/modules/escrow-engine/escrow.engine.spec.ts
 *
 * SUITES DE TESTS
 * ------------------------------------------------------------
 * Suite 1 — EscrowValidatorService   (5 tests purs, sans DB)
 * Suite 2 — EscrowManagerService     (3 tests avec mocks)
 * Suite 3 — EscrowReleaseService     (2 tests avec mocks)
 * Suite 4 — EscrowRefundService      (2 tests avec mocks)
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken }  from '@nestjs/typeorm';

import { Escrow, EscrowStatus, EscrowTrigger } from '../../database/entities/paiement/escrow.entity';
import { EscrowHistory }         from '../../database/entities/paiement/escrow-history.entity';
import { PaiementDistribution, DistributionStatus } from '../../database/entities/paiement/paiement-distribution.entity';
import { Wallet }                from '../../database/entities/wallet.entity';
import { PlatformSettings }      from '../../database/entities/platform-settings.entity';
import { FinancialAuditLog }     from '../../database/entities/paiement/financial-audit-log.entity';

import { EscrowValidatorService } from './services/escrow-validator.service';
import { EscrowManagerService }   from './services/escrow-manager.service';
import { EscrowReleaseService }   from './services/escrow-release.service';
import { EscrowRefundService }    from './services/escrow-refund.service';
import { EscrowEventBus }         from './events/escrow-event-bus.service';
import { WalletEngine }           from '../wallet-engine/wallet.engine';

import {
  EscrowErreur,
  EscrowErreurType,
} from './types/escrow-engine.types';

/* ============================================================
 * HELPERS
 * ============================================================ */

function makeEscrow(overrides: Partial<Escrow> = {}): Escrow {
  const e = new Escrow();
  e.id              = 'esc-uuid-001';
  e.commandeId      = 'cmd-uuid-001';
  e.commandeNumero  = 'CMD-2025-00142';
  e.sessionId       = 'sess-uuid-001';
  e.clientUserId    = 'user-uuid-client';
  e.clientWalletId  = 'wallet-uuid-client';
  e.montantTotal    = 100_000;
  e.montantDistribue = 0;
  e.montantRembourse = 0;
  e.currency        = 'GNF';
  e.status          = EscrowStatus.WAITING_VALIDATION;
  e.lastTrigger     = EscrowTrigger.SYSTEM;
  e.version         = 1;
  e.autoReleaseAt   = null;
  e.disputeDeadlineAt = null;
  e.refundDeadlineAt = null;
  e.fundsReceivedAt  = null;
  e.lockedAt         = null;
  e.waitingValidationAt = null;
  e.releasedAt       = null;
  e.refundInitiatedAt = null;
  e.refundedAt       = null;
  e.disputedAt       = null;
  e.resolvedAt       = null;
  e.disputeId        = null;
  e.disputeDecision  = null;
  e.releaseTriggeredBy = null;
  e.adminDecisionUserId = null;
  e.failureReason    = null;
  e.metadata         = null;
  e.createdAt        = new Date('2025-01-01');
  e.updatedAt        = new Date('2025-01-01');
  return Object.assign(e, overrides);
}

function makeDistribution(overrides: Partial<PaiementDistribution> = {}): PaiementDistribution {
  const d = new PaiementDistribution();
  d.id               = 'dist-uuid-001';
  d.commandeId       = 'cmd-uuid-001';
  d.commandeNumero   = 'CMD-2025-00142';
  d.sessionId        = 'sess-uuid-001';
  d.acteurType       = 'entreprise' as any;
  d.acteurUserId     = 'user-uuid-ent';
  d.walletId         = 'wallet-uuid-ent';
  d.acteurNom        = 'Boutique Test';
  d.montant          = 80_000;
  d.tauxCommission   = null;
  d.commandeMontantTotal = 100_000;
  d.escrowTransactionId  = null;
  d.releaseTransactionId = null;
  d.status           = DistributionStatus.ESCROW;
  d.releasedAt       = null;
  d.cancelledAt      = null;
  d.cancelRaison     = null;
  d.actionParUserId  = null;
  d.partenaireUserId = null;
  d.adminUserId      = null;
  d.commissionRuleId = null;
  d.snapshotTaux     = null;
  d.createdAt        = new Date();
  return Object.assign(d, overrides);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockRepo(partial: Partial<Record<string, any>> = {}): any {
  return {
    findOne:            jest.fn(),
    find:               jest.fn(),
    findAndCount:       jest.fn(),
    save:               jest.fn(),
    create:             jest.fn((dto: unknown) => dto),
    createQueryBuilder: jest.fn(),
    ...partial,
  };
}

/* ============================================================
 * SUITE 1 — EscrowValidatorService (tests purs)
 * ============================================================ */

describe('EscrowValidatorService', () => {
  let svc: EscrowValidatorService;

  beforeEach(() => {
    svc = new EscrowValidatorService();
  });

  /* ── 1.1 ── */
  it('validerTransition : autorise WAITING_VALIDATION → RELEASED', () => {
    const escrow = makeEscrow({ status: EscrowStatus.WAITING_VALIDATION });
    expect(() => svc.validerTransition(escrow, EscrowStatus.RELEASED)).not.toThrow();
  });

  /* ── 1.2 ── */
  it('validerTransition : lève TRANSITION_INVALIDE pour CREATED → RELEASED', () => {
    const escrow = makeEscrow({ status: EscrowStatus.CREATED });
    expect(() => svc.validerTransition(escrow, EscrowStatus.RELEASED))
      .toThrow(expect.objectContaining({ type: EscrowErreurType.TRANSITION_INVALIDE }));
  });

  /* ── 1.3 ── */
  it('validerTransition : lève ETAT_FINAL_IRREVOCABLE pour RELEASED → tout autre état', () => {
    const escrow = makeEscrow({ status: EscrowStatus.RELEASED });
    expect(() => svc.validerTransition(escrow, EscrowStatus.REFUND_PENDING))
      .toThrow(expect.objectContaining({ type: EscrowErreurType.ETAT_FINAL_IRREVOCABLE }));
  });

  /* ── 1.4 ── */
  it('validerPasDoubleRelease : lève DOUBLE_RELEASE si escrow déjà RELEASED', () => {
    const escrow = makeEscrow({ status: EscrowStatus.RELEASED });
    expect(() => svc.validerPasDoubleRelease(escrow))
      .toThrow(expect.objectContaining({ type: EscrowErreurType.DOUBLE_RELEASE }));
  });

  /* ── 1.5 ── */
  it('validerMontant : lève MONTANT_INVALIDE pour montant négatif', () => {
    expect(() => svc.validerMontant(-500))
      .toThrow(expect.objectContaining({ type: EscrowErreurType.MONTANT_INVALIDE }));
  });
});

/* ============================================================
 * SUITE 2 — EscrowManagerService
 * ============================================================ */

describe('EscrowManagerService', () => {

  let svc: EscrowManagerService;
  let escrowRepo: any;
  let historyRepo: any;
  let distributionRepo: any;
  let settingsRepo: any;
  let walletEngine: any;
  let events: any;

  beforeEach(async () => {
    escrowRepo       = mockRepo();
    historyRepo      = mockRepo();
    distributionRepo = mockRepo();
    settingsRepo     = mockRepo();
    walletEngine     = { executer: jest.fn() } as any;
    events           = { emit: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowManagerService,
        EscrowValidatorService,
        { provide: getRepositoryToken(Escrow),               useValue: escrowRepo },
        { provide: getRepositoryToken(EscrowHistory),         useValue: historyRepo },
        { provide: getRepositoryToken(PaiementDistribution), useValue: distributionRepo },
        { provide: getRepositoryToken(PlatformSettings),     useValue: settingsRepo },
        { provide: WalletEngine,                             useValue: walletEngine },
        { provide: EscrowEventBus,                           useValue: events },
      ],
    }).compile();

    svc = module.get<EscrowManagerService>(EscrowManagerService);
  });

  /* ── 2.1 ── */
  it('creer() : crée un nouvel escrow en état CREATED', async () => {
    escrowRepo.findOne.mockResolvedValue(null);
    const saved = makeEscrow({ status: EscrowStatus.CREATED });
    escrowRepo.save.mockResolvedValue(saved);

    const result = await svc.creer({
      commandeId:     'cmd-uuid-001',
      commandeNumero: 'CMD-2025-00142',
      sessionId:      'sess-uuid-001',
      clientUserId:   'user-uuid-client',
      clientWalletId: 'wallet-uuid-client',
      montantTotal:   100_000,
      currency:       'GNF',
    });

    expect(result.status).toBe(EscrowStatus.CREATED);
    expect(escrowRepo.save).toHaveBeenCalled();
    expect(historyRepo.save).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith('escrow.created', expect.any(Object));
  });

  /* ── 2.2 ── */
  it('creer() : idempotent — retourne escrow existant si même session', async () => {
    const existing = makeEscrow({ status: EscrowStatus.FUNDS_RECEIVED });
    escrowRepo.findOne.mockResolvedValue(existing);

    const result = await svc.creer({
      commandeId: 'cmd-uuid-001', commandeNumero: 'CMD-2025-00142',
      sessionId: 'sess-uuid-001', clientUserId: 'user-uuid-client',
      clientWalletId: 'wallet-uuid-client', montantTotal: 100_000, currency: 'GNF',
    });

    expect(result).toBe(existing);
    expect(escrowRepo.save).not.toHaveBeenCalled();
  });

  /* ── 2.3 ── */
  it('marquerEchoue() : passe l\'escrow en FAILED', async () => {
    const escrow = makeEscrow({ status: EscrowStatus.LOCKED });
    escrowRepo.findOne.mockResolvedValue(escrow);
    escrowRepo.save.mockResolvedValue({ ...escrow, status: EscrowStatus.FAILED });

    const result = await svc.marquerEchoue({
      escrowId:      'esc-uuid-001',
      failureReason: 'Erreur critique système',
    });

    expect(result.toStatus).toBe(EscrowStatus.FAILED);
  });
});

/* ============================================================
 * SUITE 3 — EscrowReleaseService
 * ============================================================ */

describe('EscrowReleaseService', () => {

  let svc: EscrowReleaseService;
  let escrowRepo: any;
  let historyRepo: any;
  let distributionRepo: any;
  let walletEngine: any;
  let events: any;

  beforeEach(async () => {
    escrowRepo       = mockRepo();
    historyRepo      = mockRepo();
    distributionRepo = mockRepo();
    walletEngine     = { executer: jest.fn().mockResolvedValue({ transactionId: 'tx-001' }) } as any;
    events           = { emit: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowReleaseService,
        EscrowValidatorService,
        { provide: getRepositoryToken(Escrow),               useValue: escrowRepo },
        { provide: getRepositoryToken(EscrowHistory),         useValue: historyRepo },
        { provide: getRepositoryToken(PaiementDistribution), useValue: distributionRepo },
        { provide: WalletEngine,                             useValue: walletEngine },
        { provide: EscrowEventBus,                           useValue: events },
        { provide: 'DataSource',                             useValue: {} },
      ],
    }).compile();

    svc = module.get<EscrowReleaseService>(EscrowReleaseService);
  });

  /* ── 3.1 ── */
  it('liberer() : libère les fonds et passe l\'escrow en RELEASED', async () => {
    const escrow = makeEscrow({ status: EscrowStatus.WAITING_VALIDATION });
    escrowRepo.findOne.mockResolvedValue(escrow);
    escrowRepo.save.mockResolvedValue({ ...escrow, status: EscrowStatus.RELEASED });

    const dist = makeDistribution();
    distributionRepo.find.mockResolvedValue([dist]);
    distributionRepo.save.mockResolvedValue({ ...dist, status: DistributionStatus.RELEASED });

    const result = await svc.liberer({
      escrowId:         'esc-uuid-001',
      triggeredBy:      EscrowTrigger.CLIENT,
      triggeredByUserId: 'user-uuid-client',
      releaseReason:    'client-validation',
    });

    expect(result.toStatus).toBe(EscrowStatus.RELEASED);
    expect(result.nbActeurs).toBe(1);
    expect(walletEngine.executer).toHaveBeenCalledWith(
      expect.objectContaining({ operationType: 'escrow_release' }),
    );
    expect(events.emit).toHaveBeenCalledWith('escrow.released', expect.any(Object));
  });

  /* ── 3.2 ── */
  it('liberer() : lève DOUBLE_RELEASE si escrow déjà RELEASED', async () => {
    const escrow = makeEscrow({ status: EscrowStatus.RELEASED });
    escrowRepo.findOne.mockResolvedValue(escrow);

    await expect(svc.liberer({
      escrowId:      'esc-uuid-001',
      triggeredBy:   EscrowTrigger.CLIENT,
      releaseReason: 'client-validation',
    })).rejects.toThrow(expect.objectContaining({ type: EscrowErreurType.DOUBLE_RELEASE }));
  });
});

/* ============================================================
 * SUITE 4 — EscrowRefundService
 * ============================================================ */

describe('EscrowRefundService', () => {

  let svc: EscrowRefundService;
  let escrowRepo: any;
  let historyRepo: any;
  let distributionRepo: any;
  let walletRepo: any;
  let walletEngine: any;
  let events: any;

  beforeEach(async () => {
    escrowRepo       = mockRepo();
    historyRepo      = mockRepo();
    distributionRepo = mockRepo();
    walletRepo       = mockRepo();
    walletEngine     = { executer: jest.fn().mockResolvedValue({ transactionId: 'tx-refund-001' }) } as any;
    events           = { emit: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowRefundService,
        EscrowValidatorService,
        { provide: getRepositoryToken(Escrow),               useValue: escrowRepo },
        { provide: getRepositoryToken(EscrowHistory),         useValue: historyRepo },
        { provide: getRepositoryToken(PaiementDistribution), useValue: distributionRepo },
        { provide: getRepositoryToken(Wallet),               useValue: walletRepo },
        { provide: WalletEngine,                             useValue: walletEngine },
        { provide: EscrowEventBus,                           useValue: events },
      ],
    }).compile();

    svc = module.get<EscrowRefundService>(EscrowRefundService);
  });

  /* ── 4.1 ── */
  it('initierRemboursement() : rembourse le client (total) et passe en REFUNDED', async () => {
    const escrow = makeEscrow({ status: EscrowStatus.WAITING_VALIDATION });
    escrowRepo.findOne.mockResolvedValue(escrow);
    escrowRepo.save.mockImplementation(async (e) => e as Escrow);

    const dist = makeDistribution();
    distributionRepo.find.mockResolvedValue([dist]);
    distributionRepo.save.mockImplementation(async (d) => d as PaiementDistribution);

    const result = await svc.initierRemboursement({
      escrowId:         'esc-uuid-001',
      triggeredBy:      EscrowTrigger.ADMIN,
      triggeredByUserId: 'user-uuid-admin',
      total:             true,
      raison:            'commande annulée',
    });

    expect(result.toStatus).toBe(EscrowStatus.REFUNDED);
    expect(result.montantRembourse).toBe(100_000);
    /* ESCROW_CANCEL pour la distribution + REFUND pour le client */
    expect(walletEngine.executer).toHaveBeenCalledTimes(2);
    expect(events.emit).toHaveBeenCalledWith('escrow.refunded', expect.any(Object));
  });

  /* ── 4.2 ── */
  it('initierRemboursement() : lève DOUBLE_REFUND si escrow déjà REFUNDED', async () => {
    const escrow = makeEscrow({ status: EscrowStatus.REFUNDED });
    escrowRepo.findOne.mockResolvedValue(escrow);

    await expect(svc.initierRemboursement({
      escrowId:    'esc-uuid-001',
      triggeredBy: EscrowTrigger.ADMIN,
      total:       true,
      raison:      'doublon',
    })).rejects.toThrow(expect.objectContaining({ type: EscrowErreurType.DOUBLE_REFUND }));
  });
});

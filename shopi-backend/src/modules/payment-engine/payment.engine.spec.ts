/* ============================================================
 * TESTS : payment.engine.spec.ts
 *
 * 15 scénarios couvrant :
 *  Suite 1 — Machine à états (3 tests)
 *  Suite 2 — Traitement webhook (4 tests)
 *  Suite 3 — Confirmation paiement + EscrowEngine (4 tests)
 *  Suite 4 — Remboursement provider (2 tests)
 *  Suite 5 — Configuration provider (2 tests)
 * ============================================================ */

import {
  PaiementSessionStatus,
  PaiementProvider,
  MethodePaiementSession,
} from '../../database/entities/paiement/paiement-session.entity';
import {
  PAYMENT_SESSION_TRANSITIONS,
  PAYMENT_SESSION_FINAL_STATES,
  PaymentErreur,
  PaymentErreurType,
} from './types/payment-engine.types';
import { PaymentSessionManagerService } from './services/payment-session-manager.service';
import { PaymentWebhookProcessorService } from './services/payment-webhook-processor.service';
import { PaymentRefundService } from './services/payment-refund.service';
import { PaymentProviderConfigService } from './services/payment-provider-config.service';

/* ── Helper mock repo ─────────────────────────────────────── */
const mockRepo = (): any => ({
  findOne:        jest.fn(),
  find:           jest.fn(),
  findOneBy:      jest.fn(),
  create:         jest.fn(d => d),
  save:           jest.fn(d => Promise.resolve({ id: 'uuid', ...d })),
  update:         jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    andWhere: jest.fn().mockReturnThis(),
    orderBy:  jest.fn().mockReturnThis(),
    skip:     jest.fn().mockReturnThis(),
    take:     jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }),
});

/* ══════════════════════════════════════════════════════════
 * SUITE 1 — MACHINE À ÉTATS
 * ══════════════════════════════════════════════════════════ */

describe('Suite 1 — Machine à états PaiementSession', () => {

  test('T1 — Transitions valides depuis INITIATED', () => {
    const from = PaiementSessionStatus.INITIATED;
    const allowed = PAYMENT_SESSION_TRANSITIONS[from];
    expect(allowed).toContain(PaiementSessionStatus.PENDING);
    expect(allowed).toContain(PaiementSessionStatus.PROCESSING);
    expect(allowed).toContain(PaiementSessionStatus.FAILED);
    expect(allowed).toContain(PaiementSessionStatus.CANCELLED);
    expect(allowed).toContain(PaiementSessionStatus.EXPIRED);
  });

  test('T2 — États finaux irréversibles sont corrects', () => {
    expect(PAYMENT_SESSION_FINAL_STATES.has(PaiementSessionStatus.FAILED)).toBe(true);
    expect(PAYMENT_SESSION_FINAL_STATES.has(PaiementSessionStatus.CANCELLED)).toBe(true);
    expect(PAYMENT_SESSION_FINAL_STATES.has(PaiementSessionStatus.EXPIRED)).toBe(true);
    expect(PAYMENT_SESSION_FINAL_STATES.has(PaiementSessionStatus.REFUNDED)).toBe(true);
    /* États non finaux */
    expect(PAYMENT_SESSION_FINAL_STATES.has(PaiementSessionStatus.CONFIRMED)).toBe(false);
    expect(PAYMENT_SESSION_FINAL_STATES.has(PaiementSessionStatus.PENDING)).toBe(false);
    expect(PAYMENT_SESSION_FINAL_STATES.has(PaiementSessionStatus.PARTIALLY_REFUNDED)).toBe(false);
  });

  test('T3 — validerTransition bloque depuis état final', () => {
    const sessionRepo = mockRepo();
    const eventBus = { emit: jest.fn() } as any;
    const svc = new PaymentSessionManagerService(sessionRepo, eventBus);

    const fakeSession = {
      id:     'session-1',
      status: PaiementSessionStatus.FAILED,
    } as any;

    expect(() => svc.validerTransition(fakeSession, PaiementSessionStatus.CONFIRMED))
      .toThrow(PaymentErreur);

    try {
      svc.validerTransition(fakeSession, PaiementSessionStatus.CONFIRMED);
    } catch (e) {
      expect((e as PaymentErreur).type).toBe(PaymentErreurType.ETAT_FINAL_IRREVOCABLE);
    }
  });
});

/* ══════════════════════════════════════════════════════════
 * SUITE 2 — TRAITEMENT WEBHOOK
 * ══════════════════════════════════════════════════════════ */

describe('Suite 2 — Traitement webhook', () => {

  function buildWebhookService(overrides: Partial<Record<string, any>> = {}): any {
    const commandeRepo      = overrides.commandeRepo      ?? mockRepo();
    const sessionRepo       = overrides.sessionRepo       ?? mockRepo();
    const distributionRepo  = overrides.distributionRepo  ?? mockRepo();
    const walletRepo        = overrides.walletRepo        ?? mockRepo();
    const webhookEventRepo  = overrides.webhookEventRepo  ?? mockRepo();
    const dataSource        = overrides.dataSource        ?? { transaction: jest.fn(cb => cb({ findOne: jest.fn(), create: jest.fn(d => d), save: jest.fn(d => ({ id: 'dist-1', ...d })), manager: {} })) };
    const commissionEngine  = overrides.commissionEngine  ?? { calculer: jest.fn().mockResolvedValue({ parts: [], tauxEffectifProduit: 0.1, rule: null, snapshotTaux: {}, totalDistribue: 0 }) };
    const providerFactory   = overrides.providerFactory   ?? { resolveByName: jest.fn() };
    const escrowEngine      = overrides.escrowEngine      ?? {
      creer:              jest.fn().mockResolvedValue({ id: 'escrow-1' }),
      recevoirFonds:      jest.fn().mockResolvedValue({}),
      verrouillerFonds:   jest.fn().mockResolvedValue({}),
      attendreValidation: jest.fn().mockResolvedValue({}),
    };
    const notifEventSvc     = overrides.notifEventSvc     ?? { notifyOrderStatusChanged: jest.fn() };
    const eventBus          = overrides.eventBus          ?? { emit: jest.fn() };

    return new PaymentWebhookProcessorService(
      commandeRepo, sessionRepo, distributionRepo, walletRepo,
      webhookEventRepo, dataSource, commissionEngine, providerFactory,
      escrowEngine, notifEventSvc, eventBus,
    );
  }

  test('T4 — Webhook provider inconnu → BadRequestException', async () => {
    const svc = buildWebhookService({
      providerFactory: { resolveByName: jest.fn().mockImplementation(() => { throw new Error('inconnu'); }) },
    });

    await expect(svc.handleWebhook('unknown-provider', '{}', {}))
      .rejects.toThrow('Provider inconnu');
  });

  test('T5 — Doublon WebhookEvent PROCESSED → { received: true } sans retraitement', async () => {
    const existingEvent = {
      status:   'processed',
      attempts: 1,
      provider: 'fedapay',
      eventId:  'evt-001',
    };
    const webhookEventRepo = mockRepo();
    webhookEventRepo.findOne.mockResolvedValue(existingEvent);

    const providerFactory = {
      resolveByName: jest.fn().mockReturnValue({
        parseWebhook: jest.fn().mockResolvedValue({
          approved:             true,
          providerTransactionId: 'evt-001',
          idempotencyKey:       'key-001',
          montantConfirme:      10000,
          erreur:               null,
        }),
      }),
    };

    const svc = buildWebhookService({ webhookEventRepo, providerFactory });
    const result = await svc.handleWebhook('fedapay', '{}', {});

    expect(result).toEqual({ received: true });
    expect(webhookEventRepo.save).not.toHaveBeenCalled();
  });

  test('T6 — Webhook refusé → session mise en FAILED', async () => {
    const sessionRepo      = mockRepo();
    const webhookEventRepo = mockRepo();
    webhookEventRepo.findOne.mockResolvedValue(null);

    const provider = {
      parseWebhook: jest.fn().mockResolvedValue({
        approved:             false,
        providerTransactionId: 'tx-fail',
        idempotencyKey:       'key-fail',
        montantConfirme:      0,
        erreur:               'Solde insuffisant',
      }),
    };
    const providerFactory = { resolveByName: jest.fn().mockReturnValue(provider) };

    const svc = buildWebhookService({ sessionRepo, providerFactory, webhookEventRepo });
    const result = await svc.handleWebhook('fedapay', '{}', {});

    expect(result).toEqual({ received: true });
    expect(sessionRepo.update).toHaveBeenCalledWith(
      { idempotencyKey: 'key-fail' },
      expect.objectContaining({ status: PaiementSessionStatus.FAILED }),
    );
  });

  test('T7 — Session déjà CONFIRMED → idempotence, aucun retraitement', async () => {
    const webhookEventRepo = mockRepo();
    webhookEventRepo.findOne.mockResolvedValue(null);

    const confirmedSession = {
      id:             'session-confirmed',
      commandeId:     'cmd-1',
      status:         PaiementSessionStatus.CONFIRMED,
      provider:       PaiementProvider.FEDAPAY,
      idempotencyKey: 'key-001',
    };
    const sessionRepo = mockRepo();
    sessionRepo.findOne.mockResolvedValue(confirmedSession);

    const provider = {
      parseWebhook: jest.fn().mockResolvedValue({
        approved:             true,
        providerTransactionId: 'tx-001',
        idempotencyKey:       'key-001',
        montantConfirme:      10000,
        erreur:               null,
      }),
    };
    const providerFactory = { resolveByName: jest.fn().mockReturnValue(provider) };
    const escrowEngine    = {
      creer:              jest.fn(),
      recevoirFonds:      jest.fn(),
      verrouillerFonds:   jest.fn(),
      attendreValidation: jest.fn(),
    };

    const svc = buildWebhookService({ sessionRepo, providerFactory, webhookEventRepo, escrowEngine });
    await svc.handleWebhook('fedapay', '{}', {});

    expect(escrowEngine.creer).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════════════════════
 * SUITE 3 — CONFIRMATION + ESCROW ENGINE
 * ══════════════════════════════════════════════════════════ */

describe('Suite 3 — Confirmation paiement + EscrowEngine', () => {

  function buildConfirmService(escrowEngine: any): any {
    const session = {
      id:             'session-1',
      commandeId:     'cmd-1',
      montant:        10000,
      devise:         'GNF',
      status:         PaiementSessionStatus.INITIATED,
      provider:       PaiementProvider.FEDAPAY,
      idempotencyKey: 'key-001',
    };
    const commande = {
      id:             'cmd-1',
      numero:         'CMD-2025-001',
      clientId:       'client-1',
      companyId:      'co-1',
      livreurId:      null,
      correspondantId: null,
      sousTotal:      9000,
      fraisLivraison: 1000,
      total:          10000,
      status:         'pending',
    };
    const sessionRepo     = mockRepo();
    sessionRepo.findOne.mockResolvedValue(session);
    const commandeRepo    = mockRepo();
    commandeRepo.findOne.mockResolvedValue(commande);
    const walletRepo      = mockRepo();
    walletRepo.findOne.mockResolvedValue({ id: 'wallet-client-1', userId: 'client-1' });
    const calcul = {
      parts:               [{ acteurType: 'entreprise', acteurUserId: 'user-1', acteurNom: 'Shop', montant: 9000 }],
      tauxEffectifProduit: 0.05,
      rule:                null,
      snapshotTaux:        {},
      totalDistribue:      9000,
    };
    const commissionEngine  = { calculer: jest.fn().mockResolvedValue(calcul) };
    const providerFactory   = { resolveByName: jest.fn() };
    const notifEventSvc     = { notifyOrderStatusChanged: jest.fn() };
    const eventBus          = { emit: jest.fn() };
    const webhookEventRepo  = mockRepo();
    const distributionRepo  = mockRepo();
    const dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: any) => {
        const manager = {
          findOne: jest.fn().mockResolvedValue({ id: 'wallet-1', userId: 'user-1', pendingBalance: 0 }),
          create:  jest.fn((_cls: any, d: any) => d),
          save:    jest.fn((cls: any, d: any) => Promise.resolve({ id: 'saved-id', ...d })),
        };
        return cb(manager);
      }),
    };

    return new PaymentWebhookProcessorService(
      commandeRepo, sessionRepo, distributionRepo, walletRepo,
      webhookEventRepo, dataSource as any, commissionEngine as any,
      providerFactory as any, escrowEngine, notifEventSvc as any, eventBus as any,
    );
  }

  test('T8 — confirmerPaiement appelle EscrowEngine.creer()', async () => {
    const escrowEngine = {
      creer:              jest.fn().mockResolvedValue({ id: 'escrow-1' }),
      recevoirFonds:      jest.fn().mockResolvedValue({}),
      verrouillerFonds:   jest.fn().mockResolvedValue({}),
      attendreValidation: jest.fn().mockResolvedValue({}),
    };
    const svc = buildConfirmService(escrowEngine);
    await svc.confirmerPaiement('session-1', 'tx-1', 10000, 'key-1', 'fedapay');

    expect(escrowEngine.creer).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', commandeId: 'cmd-1' }),
    );
  });

  test('T9 — confirmerPaiement appelle la chaîne complète EscrowEngine', async () => {
    const escrowEngine = {
      creer:              jest.fn().mockResolvedValue({ id: 'escrow-1' }),
      recevoirFonds:      jest.fn().mockResolvedValue({}),
      verrouillerFonds:   jest.fn().mockResolvedValue({}),
      attendreValidation: jest.fn().mockResolvedValue({}),
    };
    const svc = buildConfirmService(escrowEngine);
    await svc.confirmerPaiement('session-1', 'tx-1', 10000, 'key-1', 'fedapay');

    expect(escrowEngine.recevoirFonds).toHaveBeenCalled();
    expect(escrowEngine.verrouillerFonds).toHaveBeenCalled();
    expect(escrowEngine.attendreValidation).toHaveBeenCalled();
  });

  test('T10 — confirmerPaiement NO-OP si session déjà CONFIRMED (idempotence)', async () => {
    const escrowEngine = {
      creer:              jest.fn(),
      recevoirFonds:      jest.fn(),
      verrouillerFonds:   jest.fn(),
      attendreValidation: jest.fn(),
    };
    const session = {
      id:     'session-1',
      status: PaiementSessionStatus.CONFIRMED,
      montant: 10000,
    };
    const sessionRepo = mockRepo();
    sessionRepo.findOne.mockResolvedValue(session);

    const svc = new PaymentWebhookProcessorService(
      mockRepo(), sessionRepo, mockRepo(), mockRepo(),
      mockRepo(), {} as any, {} as any,
      {} as any, escrowEngine as any, {} as any, { emit: jest.fn() } as any,
    );

    await svc.confirmerPaiement('session-1', 'tx-1', 10000, 'key-1', 'fedapay');
    expect(escrowEngine.creer).not.toHaveBeenCalled();
  });

  test('T11 — montant incorrect lève BadRequestException', async () => {
    const escrowEngine = {
      creer:              jest.fn(),
      recevoirFonds:      jest.fn(),
      verrouillerFonds:   jest.fn(),
      attendreValidation: jest.fn(),
    };
    const session = {
      id:     'session-1',
      status: PaiementSessionStatus.INITIATED,
      montant: 10000,
      devise: 'GNF',
      commandeId: 'cmd-1',
    };
    const commande = {
      id: 'cmd-1',
      numero: 'CMD-001',
      clientId: 'client-1',
      companyId: 'co-1',
      livreurId: null,
      correspondantId: null,
      sousTotal: 9000,
      fraisLivraison: 1000,
      total: 10000,
    };
    const sessionRepo  = mockRepo();
    sessionRepo.findOne.mockResolvedValue(session);
    const commandeRepo = mockRepo();
    commandeRepo.findOne.mockResolvedValue(commande);

    const svc = new PaymentWebhookProcessorService(
      commandeRepo, sessionRepo, mockRepo(), mockRepo(),
      mockRepo(), {} as any, { calculer: jest.fn() } as any,
      {} as any, escrowEngine as any, {} as any, { emit: jest.fn() } as any,
    );

    /* montantConfirme = 5000, montantAttendu = 10000 → delta > 1 */
    await expect(svc.confirmerPaiement('session-1', 'tx-1', 5000, 'key-1', 'fedapay'))
      .rejects.toThrow('Montant confirmé');
  });
});

/* ══════════════════════════════════════════════════════════
 * SUITE 4 — REMBOURSEMENT PROVIDER
 * ══════════════════════════════════════════════════════════ */

describe('Suite 4 — Remboursement provider', () => {

  function buildRefundService(overrides: Partial<Record<string, any>> = {}): any {
    const sessionRepo = overrides.sessionRepo ?? mockRepo();
    const escrowRepo  = overrides.escrowRepo  ?? mockRepo();
    const escrowEngine = overrides.escrowEngine ?? {
      rembourser: jest.fn().mockResolvedValue({}),
    };
    const providerFactory = overrides.providerFactory ?? {
      resolveByName: jest.fn().mockReturnValue({
        refund: jest.fn().mockResolvedValue({ refundId: 'ref-001' }),
      }),
    };
    const eventBus = { emit: jest.fn() };

    return new PaymentRefundService(sessionRepo, escrowRepo, providerFactory, escrowEngine, eventBus as any);
  }

  test('T12 — remboursement total appelle EscrowEngine.rembourser()', async () => {
    const session = {
      id:                   'session-1',
      commandeId:           'cmd-1',
      status:               PaiementSessionStatus.CONFIRMED,
      montant:              10000,
      provider:             PaiementProvider.FEDAPAY,
      providerTransactionId: 'tx-001',
    };
    const sessionRepo  = mockRepo();
    sessionRepo.findOne.mockResolvedValue(session);
    const escrowRepo   = mockRepo();
    escrowRepo.findOne.mockResolvedValue({ id: 'escrow-1', commandeId: 'cmd-1' });

    const escrowEngine = { rembourser: jest.fn().mockResolvedValue({}) };
    const svc = buildRefundService({ sessionRepo, escrowRepo, escrowEngine });

    await svc.rembourser({ sessionId: 'session-1', total: true });
    expect(escrowEngine.rembourser).toHaveBeenCalledWith(
      expect.objectContaining({ escrowId: 'escrow-1', total: true }),
    );
  });

  test('T13 — remboursement depuis statut invalide lève PaymentErreur', async () => {
    const session = {
      id:        'session-1',
      commandeId: 'cmd-1',
      status:    PaiementSessionStatus.PENDING,
      montant:   10000,
      provider:  PaiementProvider.FEDAPAY,
    };
    const sessionRepo = mockRepo();
    sessionRepo.findOne.mockResolvedValue(session);

    const svc = buildRefundService({ sessionRepo });
    await expect(svc.rembourser({ sessionId: 'session-1' }))
      .rejects.toThrow(PaymentErreur);
  });
});

/* ══════════════════════════════════════════════════════════
 * SUITE 5 — CONFIGURATION PROVIDER
 * ══════════════════════════════════════════════════════════ */

describe('Suite 5 — Configuration provider', () => {

  test('T14 — activer() met isActive=true et horodate activatedAt', async () => {
    const existing = {
      provider:  PaiementProvider.FEDAPAY,
      isActive:  false,
      activatedAt: null,
    };
    const configRepo = mockRepo();
    configRepo.findOne.mockResolvedValue(existing);
    configRepo.save.mockImplementation(async (d: any) => d);

    const svc = new PaymentProviderConfigService(configRepo);
    const result = await svc.activer(PaiementProvider.FEDAPAY, 'admin-1');

    expect(result.isActive).toBe(true);
    expect(result.activatedAt).toBeInstanceOf(Date);
    expect(result.activatedByUserId).toBe('admin-1');
  });

  test('T15 — getActiveConfig lève PaymentErreur si provider inactif', async () => {
    const inactive = {
      provider: PaiementProvider.CINETPAY,
      isActive: false,
    };
    const configRepo = mockRepo();
    configRepo.findOne.mockResolvedValue(inactive);

    const svc = new PaymentProviderConfigService(configRepo);
    await expect(svc.getActiveConfig(PaiementProvider.CINETPAY))
      .rejects.toThrow(PaymentErreur);

    try {
      await svc.getActiveConfig(PaiementProvider.CINETPAY);
    } catch (e) {
      expect((e as PaymentErreur).type).toBe(PaymentErreurType.PROVIDER_INACTIF);
    }
  });
});

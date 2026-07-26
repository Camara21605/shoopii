/* ============================================================
 * FICHIER      : src/modules/event-orchestration/event-orchestration.engine.spec.ts
 * MODULE       : EventOrchestrationEngine — Tests unitaires
 * ROLE         : Valider le bus, la publication, la déduplication,
 *                les subscribers, le retry, la DLQ, le scheduler
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';

import { EventBusService }          from './services/event-bus.service';
import { EventPublisherService }    from './services/event-publisher.service';
import { EventAuditService }        from './services/event-audit.service';
import { RetryManagerService }      from './services/retry-manager.service';
import { DlqService }               from './services/dlq.service';
import { EventOrchestrationEngine } from './event-orchestration.engine';

import {
  ORDER_EVENTS,
  PAYMENT_EVENTS,
  WALLET_EVENTS,
  SYSTEM_EVENTS,
  EventSource,
  OrderCreatedPayload,
  PaymentConfirmedPayload,
  WalletCreditedPayload,
  SystemAlertPayload,
} from './types/events.types';

/* ============================================================
 * FACTORIES DE TEST
 * ============================================================ */

function makeOrderPayload(overrides: Partial<OrderCreatedPayload> = {}): OrderCreatedPayload {
  return {
    commandeId:   'cmd-001',
    commandeRef:  'SH-2026-001',
    clientId:     'client-001',
    clientName:   'Mamadou Diallo',
    companyId:    'company-001',
    companyName:  'Boutique Alpha',
    montantTotal: 25000,
    devise:       'XOF',
    items:        [{ productId: 'prod-1', nom: 'Produit A', quantite: 2, prix: 12500 }],
    ...overrides,
  };
}

function makePaymentPayload(overrides: Partial<PaymentConfirmedPayload> = {}): PaymentConfirmedPayload {
  return {
    sessionId:    'session-001',
    commandeId:   'cmd-001',
    commandeRef:  'SH-2026-001',
    clientId:     'client-001',
    companyId:    'company-001',
    montant:      25000,
    devise:       'XOF',
    provider:     'ORANGE_MONEY',
    confirmedAt:  new Date(),
    ...overrides,
  };
}

function makeWalletPayload(overrides: Partial<WalletCreditedPayload> = {}): WalletCreditedPayload {
  return {
    walletId:      'wallet-001',
    actorId:       'actor-001',
    actorType:     'LIVREUR',
    montant:       5000,
    devise:        'XOF',
    operationType: 'COMMISSION',
    newBalance:    55000,
    ...overrides,
  };
}

function makeSystemPayload(overrides: Partial<SystemAlertPayload> = {}): SystemAlertPayload {
  return {
    severity:    'HIGH',
    alertType:   'WITHDRAWAL_STUCK',
    message:     '3 retraits bloqués depuis 24h',
    metadata:    { count: 3 },
    ...overrides,
  };
}

/* ============================================================
 * SUITE DE TESTS
 * ============================================================ */

describe('EventOrchestrationEngine', () => {
  let module: TestingModule;
  let engine: EventOrchestrationEngine;
  let bus:    EventBusService;
  let audit:  EventAuditService;
  let dlq:    DlqService;
  let retry:  RetryManagerService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        EventBusService,
        EventAuditService,
        DlqService,
        RetryManagerService,
        EventPublisherService,
        EventOrchestrationEngine,
      ],
    }).compile();

    engine = module.get(EventOrchestrationEngine);
    bus    = module.get(EventBusService);
    audit  = module.get(EventAuditService);
    dlq    = module.get(DlqService);
    retry  = module.get(RetryManagerService);
  });

  afterEach(async () => {
    /* Nettoie les listeners pour éviter les fuites entre tests */
    bus.removeAllListeners();
    await module.close();
  });

  /* ==========================================================
   * GROUPE 1 — BUS D'ÉVÉNEMENTS
   * ========================================================== */

  describe('EventBusService', () => {

    it('doit émettre un événement et notifier le subscriber', (done) => {
      bus.onEvent<OrderCreatedPayload>(ORDER_EVENTS.CREATED, (event) => {
        expect(event.eventName).toBe(ORDER_EVENTS.CREATED);
        expect(event.payload.commandeRef).toBe('SH-2026-001');
        done();
      });

      bus.emitEvent(ORDER_EVENTS.CREATED, {
        id:         'evt-test-001',
        eventName:  ORDER_EVENTS.CREATED,
        occurredAt: new Date(),
        source:     EventSource.COMMANDE,
        payload:    makeOrderPayload(),
      });
    });

    it('onceEvent doit désabonner après la première invocation', () => {
      let callCount = 0;

      bus.onceEvent(PAYMENT_EVENTS.CONFIRMED, () => { callCount++; });

      bus.emitEvent(PAYMENT_EVENTS.CONFIRMED, {
        id: 'e1', eventName: PAYMENT_EVENTS.CONFIRMED, occurredAt: new Date(),
        source: EventSource.PAIEMENT, payload: makePaymentPayload(),
      });

      bus.emitEvent(PAYMENT_EVENTS.CONFIRMED, {
        id: 'e2', eventName: PAYMENT_EVENTS.CONFIRMED, occurredAt: new Date(),
        source: EventSource.PAIEMENT, payload: makePaymentPayload(),
      });

      expect(callCount).toBe(1);
    });

    it('subscriberCount doit refléter le nombre de listeners actifs', () => {
      const h1 = () => {};
      const h2 = () => {};

      bus.onEvent(ORDER_EVENTS.CREATED, h1);
      bus.onEvent(ORDER_EVENTS.CREATED, h2);

      expect(bus.subscriberCount(ORDER_EVENTS.CREATED)).toBe(2);

      bus.offEvent(ORDER_EVENTS.CREATED, h1);
      expect(bus.subscriberCount(ORDER_EVENTS.CREATED)).toBe(1);
    });

    it('activeEventNames doit lister les événements avec au moins un listener', () => {
      bus.onEvent(ORDER_EVENTS.CREATED, () => {});
      bus.onEvent(WALLET_EVENTS.CREDITED, () => {});

      const names = bus.activeEventNames();
      expect(names).toContain(ORDER_EVENTS.CREATED);
      expect(names).toContain(WALLET_EVENTS.CREDITED);
    });
  });

  /* ==========================================================
   * GROUPE 2 — PUBLICATION & DÉDUPLICATION
   * ========================================================== */

  describe('EventPublisherService — publication', () => {

    it('publish doit retourner isDuplicate=false pour un nouvel événement', () => {
      const result = engine.publishSync(
        ORDER_EVENTS.CREATED,
        makeOrderPayload(),
        EventSource.COMMANDE,
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.eventName).toBe(ORDER_EVENTS.CREATED);
      expect(result.eventId).toBeDefined();
    });

    it('publish avec le même eventId doit retourner isDuplicate=true', () => {
      const eventId = 'dedup-test-001';

      /* Première publication — passe */
      engine.publish(ORDER_EVENTS.CREATED, makeOrderPayload(), EventSource.COMMANDE, { eventId });

      /* Même ID dans la fenêtre de 5 minutes → dupliqué */
      const result = engine.publish(
        ORDER_EVENTS.CREATED,
        makeOrderPayload(),
        EventSource.COMMANDE,
        { eventId },
      );

      expect(result.isDuplicate).toBe(true);
    });

    it('les métriques doivent s\'incrémenter après une publication synchrone', () => {
      audit.reset();

      engine.publishSync(PAYMENT_EVENTS.CONFIRMED, makePaymentPayload(), EventSource.PAIEMENT);

      /* recordPublished est appelé dans le setImmediate pour publish(),
         mais immédiatement pour publishSync() */
      const metrics = engine.getMetrics();
      expect(metrics.totalPublished).toBeGreaterThanOrEqual(1);
    });

    it('correlationId et causationId doivent être transmis dans l\'enveloppe', (done) => {
      bus.onEvent<OrderCreatedPayload>(ORDER_EVENTS.CONFIRMED, (event) => {
        expect(event.correlationId).toBe('corr-001');
        expect(event.causationId).toBe('cause-001');
        done();
      });

      engine.publish(
        ORDER_EVENTS.CONFIRMED,
        makeOrderPayload(),
        EventSource.COMMANDE,
        { correlationId: 'corr-001', causationId: 'cause-001' },
      );

      /* Forcer l'exécution du setImmediate en attendant le prochain tick */
      setImmediate(() => {});
    });
  });

  /* ==========================================================
   * GROUPE 3 — MÉTRIQUES & AUDIT
   * ========================================================== */

  describe('EventAuditService — métriques', () => {

    it('getMetrics doit retourner tous les champs requis', () => {
      const m = engine.getMetrics();

      expect(m).toHaveProperty('totalPublished');
      expect(m).toHaveProperty('totalConsumed');
      expect(m).toHaveProperty('totalFailed');
      expect(m).toHaveProperty('totalRetried');
      expect(m).toHaveProperty('totalDlq');
      expect(m).toHaveProperty('duplicatesBlocked');
      expect(m).toHaveProperty('failureRate');
      expect(m).toHaveProperty('topEvents');
      expect(m).toHaveProperty('avgProcessingMs');
      expect(m).toHaveProperty('uptimeMs');
    });

    it('failureRate doit être 0 quand il n\'y a aucun échec', () => {
      audit.reset();
      expect(engine.getMetrics().failureRate).toBe(0);
    });

    it('topEvents doit retourner les événements les plus fréquents en premier', () => {
      audit.reset();
      audit.recordPublished('order.created');
      audit.recordPublished('order.created');
      audit.recordPublished('payment.confirmed');

      const top = engine.getMetrics().topEvents;
      expect(top[0].eventName).toBe('order.created');
      expect(top[0].count).toBe(2);
    });

    it('resetMetrics doit remettre tous les compteurs à 0', () => {
      audit.recordPublished('order.created');
      audit.recordFailed('order.created');
      engine.resetMetrics();

      const m = engine.getMetrics();
      expect(m.totalPublished).toBe(0);
      expect(m.totalFailed).toBe(0);
    });
  });

  /* ==========================================================
   * GROUPE 4 — RETRY & DEAD LETTER QUEUE
   * ========================================================== */

  describe('RetryManagerService + DlqService', () => {

    it('executeWithRetry doit retourner true pour un handler qui réussit', async () => {
      const fakeEvent = {
        id: 'evt-ok', eventName: ORDER_EVENTS.CREATED,
        occurredAt: new Date(), source: EventSource.COMMANDE,
        payload: makeOrderPayload(),
      };

      const result = await retry.executeWithRetry(
        async () => {},           // handler qui réussit immédiatement
        fakeEvent,
        'TestSubscriber',
        { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5 },
      );

      expect(result).toBe(true);
    });

    it('executeWithRetry doit envoyer en DLQ après N échecs', async () => {
      const fakeEvent = {
        id: 'evt-fail', eventName: WALLET_EVENTS.FROZEN,
        occurredAt: new Date(), source: EventSource.WALLET,
        payload: {} as WalletCreditedPayload,
      };

      const result = await retry.executeWithRetry(
        async () => { throw new Error('Simulated failure'); },
        fakeEvent,
        'WalletSubscriberTest',
        { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5 },
      );

      expect(result).toBe(false);
      expect(dlq.size).toBeGreaterThan(0);
    });

    it('DlqService.list doit paginer correctement les entrées', async () => {
      /* Insérer 3 entrées */
      const evt = {
        id: 'e1', eventName: SYSTEM_EVENTS.ALERT,
        occurredAt: new Date(), source: EventSource.SYSTEM,
        payload: makeSystemPayload(),
      };

      await dlq.push(evt, 'Sub1', 'err1', 3);
      await dlq.push({ ...evt, id: 'e2' }, 'Sub2', 'err2', 3);
      await dlq.push({ ...evt, id: 'e3' }, 'Sub3', 'err3', 3);

      const page = dlq.list(1, 2);
      expect(page.items.length).toBe(2);
      expect(page.total).toBeGreaterThanOrEqual(3);
      expect(page.pages).toBeGreaterThanOrEqual(2);
    });

    it('markResolved doit supprimer l\'entrée de la DLQ', async () => {
      const evt = {
        id: 'evt-resolve', eventName: PAYMENT_EVENTS.FAILED,
        occurredAt: new Date(), source: EventSource.PAIEMENT,
        payload: {} as PaymentConfirmedPayload,
      };

      const entry = await dlq.push(evt, 'PaySub', 'network error', 5);
      expect(dlq.findById(entry.id)).toBeDefined();

      dlq.markResolved(entry.id);
      expect(dlq.findById(entry.id)).toBeUndefined();
    });

    it('replayDlqEntry doit republier l\'événement et retirer l\'entrée', async () => {
      const evt = {
        id: 'evt-replay', eventName: ORDER_EVENTS.PAID,
        occurredAt: new Date(), source: EventSource.COMMANDE,
        payload: makeOrderPayload(),
      };

      const entry = await dlq.push(evt, 'Sub', 'timeout', 5);
      const sizeBefore = dlq.size;

      const replayed = engine.replayDlqEntry(entry.id);

      expect(replayed).toBe(true);
      expect(dlq.size).toBe(sizeBefore - 1);
    });

    it('replayDlqEntry doit retourner false pour un ID inconnu', () => {
      const result = engine.replayDlqEntry('nonexistent-id');
      expect(result).toBe(false);
    });
  });

  /* ==========================================================
   * GROUPE 5 — ORCHESTRATION (SUBSCRIBE + PUBLISH)
   * ========================================================== */

  describe('EventOrchestrationEngine — orchestration pub/sub', () => {

    it('subscribe doit permettre l\'écoute d\'événements via l\'engine', (done) => {
      engine.subscribe<WalletCreditedPayload>(WALLET_EVENTS.CREDITED, (event) => {
        expect(event.payload.actorId).toBe('actor-001');
        done();
      });

      engine.publish(WALLET_EVENTS.CREDITED, makeWalletPayload(), EventSource.WALLET);
      setImmediate(() => {});
    });

    it('subscribeOnce doit désabonner après la première réception', () => {
      let count = 0;
      engine.subscribeOnce(SYSTEM_EVENTS.ALERT, () => { count++; });

      const payload = makeSystemPayload();
      engine.publishSync(SYSTEM_EVENTS.ALERT, payload, EventSource.SYSTEM);
      engine.publishSync(SYSTEM_EVENTS.ALERT, payload, EventSource.SYSTEM);

      expect(count).toBe(1);
    });

    it('getDlq doit déléguer à DlqService', async () => {
      const evt = {
        id: 'e-dlq', eventName: ORDER_EVENTS.CANCELLED,
        occurredAt: new Date(), source: EventSource.COMMANDE,
        payload: makeOrderPayload(),
      };

      await dlq.push(evt, 'CommandeSub', 'timeout', 5);

      const page = engine.getDlq(1, 50);
      expect(page.total).toBeGreaterThan(0);
    });

    it('uptimeMs doit être positif', () => {
      expect(engine.uptimeMs).toBeGreaterThan(0);
    });

    it('clearDlq doit vider entièrement la DLQ', async () => {
      const evt = {
        id: 'clr-1', eventName: SYSTEM_EVENTS.ALERT,
        occurredAt: new Date(), source: EventSource.SYSTEM,
        payload: makeSystemPayload(),
      };
      await dlq.push(evt, 'Sub', 'err', 5);
      expect(dlq.size).toBeGreaterThan(0);

      engine.clearDlq();
      expect(dlq.size).toBe(0);
    });
  });
});

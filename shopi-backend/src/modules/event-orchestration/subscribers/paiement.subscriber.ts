/* ============================================================
 * FICHIER      : src/modules/event-orchestration/subscribers/paiement.subscriber.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Subscriber des événements du domaine Paiement
 * RESPONSABILITES :
 *   - S'abonner aux PAYMENT_EVENTS et ESCROW_EVENTS
 *   - Notifier les acteurs des confirmations/échecs de paiement
 *   - Notifier les opérations d'escrow (blocage, libération, remboursement)
 *   - Relayer vers la DLQ via RetryManagerService en cas d'échec
 * DEPENDANCES  :
 *   EventBusService, RetryManagerService, NotificationEventService
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { EventBusService }     from '../services/event-bus.service';
import { RetryManagerService } from '../services/retry-manager.service';

import {
  NotificationEventService,
} from '../../notifications/events/notification-event.service';
import {
  NotificationActorType,
} from '../../../database/entities/notification/notification.entitiy';

import {
  PAYMENT_EVENTS,
  ESCROW_EVENTS,
  ShopiEvent,
  PaymentConfirmedPayload,
  PaymentFailedPayload,
  EscrowPayload,
} from '../types/events.types';

/* ============================================================
 * SUBSCRIBER
 * ============================================================ */

@Injectable()
export class PaiementSubscriber implements OnModuleInit {

  private readonly logger = new Logger(PaiementSubscriber.name);

  constructor(
    private readonly bus:        EventBusService,
    private readonly notifEvent: NotificationEventService,
    private readonly retry:      RetryManagerService,
  ) {}

  onModuleInit(): void {
    /* ---- Paiement ---- */
    this.bus.onEvent<PaymentConfirmedPayload>(
      PAYMENT_EVENTS.CONFIRMED,
      (e) => this.onPaymentConfirmed(e),
    );

    this.bus.onEvent<PaymentFailedPayload>(
      PAYMENT_EVENTS.FAILED,
      (e) => this.onPaymentFailed(e),
    );

    this.bus.onEvent<PaymentFailedPayload>(
      PAYMENT_EVENTS.EXPIRED,
      (e) => this.onPaymentExpired(e),
    );

    /* ---- Escrow ---- */
    this.bus.onEvent<EscrowPayload>(
      ESCROW_EVENTS.FUNDS_HELD,
      (e) => this.onFundsHeld(e),
    );

    this.bus.onEvent<EscrowPayload>(
      ESCROW_EVENTS.FUNDS_RELEASED,
      (e) => this.onFundsReleased(e),
    );

    this.bus.onEvent<EscrowPayload>(
      ESCROW_EVENTS.FUNDS_REFUNDED,
      (e) => this.onFundsRefunded(e),
    );

    this.bus.onEvent<EscrowPayload>(
      ESCROW_EVENTS.AUTO_RELEASED,
      (e) => this.onAutoReleased(e),
    );

    this.logger.log('PaiementSubscriber — abonnements PAYMENT_EVENTS + ESCROW_EVENTS actifs');
  }

  /* ==========================================================
   * HANDLERS PAIEMENT
   * ========================================================== */

  /**
   * payment.confirmed → notifie client + entreprise + livreur (si présent).
   */
  private async onPaymentConfirmed(
    event: ShopiEvent<PaymentConfirmedPayload>,
  ): Promise<void> {
    const { payload } = event;

    const targets: Array<{ type: NotificationActorType; id: string }> = [
      { type: NotificationActorType.CLIENT,  id: payload.clientId },
      { type: NotificationActorType.COMPANY, id: payload.companyId },
    ];
    if (payload.livreurId) {
      targets.push({ type: NotificationActorType.DELIVERY, id: payload.livreurId });
    }

    for (const t of targets) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyPaymentConfirmed({
          recipientType: t.type,
          recipientId:   t.id,
          commandeId:    payload.commandeId,
          commandeRef:   payload.commandeRef,
          montant:       payload.montant,
          devise:        payload.devise,
          sessionId:     payload.sessionId,
        }),
        event,
        `${PaiementSubscriber.name}:confirmed:${t.type}`,
      );
    }
  }

  /**
   * payment.failed → notifie le client de l'échec + indique la raison.
   */
  private async onPaymentFailed(
    event: ShopiEvent<PaymentFailedPayload>,
  ): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyPaymentFailed({
        recipientType: NotificationActorType.CLIENT,
        recipientId:   payload.clientId,
        commandeId:    payload.commandeId,
        commandeRef:   payload.commandeRef,
        reason:        payload.reason,
        sessionId:     payload.sessionId,
      }),
      event,
      PaiementSubscriber.name,
    );
  }

  /**
   * payment.expired → notifie le client que la session a expiré.
   */
  private async onPaymentExpired(
    event: ShopiEvent<PaymentFailedPayload>,
  ): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyPaymentFailed({
        recipientType: NotificationActorType.CLIENT,
        recipientId:   payload.clientId,
        commandeId:    payload.commandeId,
        commandeRef:   payload.commandeRef,
        reason:        'Session de paiement expirée. Veuillez relancer le paiement.',
        sessionId:     payload.sessionId,
      }),
      event,
      PaiementSubscriber.name,
    );
  }

  /* ==========================================================
   * HANDLERS ESCROW
   * ========================================================== */

  /**
   * escrow.funds_held → informe client et entreprise que les fonds sont sécurisés.
   */
  private async onFundsHeld(event: ShopiEvent<EscrowPayload>): Promise<void> {
    const { payload } = event;

    const targets: Array<{ type: NotificationActorType; id: string; body: string }> = [
      {
        type: NotificationActorType.CLIENT,
        id:   payload.clientId,
        body: `Vos fonds (${payload.montant} ${payload.devise}) sont sécurisés pour la commande ${payload.commandeRef}. Ils seront libérés après livraison confirmée.`,
      },
      {
        type: NotificationActorType.COMPANY,
        id:   payload.companyId,
        body: `Le paiement de ${payload.montant} ${payload.devise} est sécurisé en escrow pour la commande ${payload.commandeRef}.`,
      },
    ];

    for (const t of targets) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyEscrowEvent({
          recipientType: t.type,
          recipientId:   t.id,
          commandeId:    payload.commandeId,
          commandeRef:   payload.commandeRef,
          title:         'Fonds sécurisés en escrow',
          body:          t.body,
          montant:       payload.montant,
          devise:        payload.devise,
          escrowId:      payload.escrowId,
        }),
        event,
        `${PaiementSubscriber.name}:escrow_held:${t.type}`,
      );
    }
  }

  /**
   * escrow.funds_released → notifie l'entreprise que les fonds ont été libérés.
   */
  private async onFundsReleased(event: ShopiEvent<EscrowPayload>): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyEscrowEvent({
        recipientType: NotificationActorType.COMPANY,
        recipientId:   payload.companyId,
        commandeId:    payload.commandeId,
        commandeRef:   payload.commandeRef,
        title:         'Fonds libérés',
        body:          `${payload.montant} ${payload.devise} ont été libérés suite à la livraison confirmée de la commande ${payload.commandeRef}.`,
        montant:       payload.montant,
        devise:        payload.devise,
        escrowId:      payload.escrowId,
      }),
      event,
      PaiementSubscriber.name,
    );
  }

  /**
   * escrow.funds_refunded → notifie le client du remboursement.
   */
  private async onFundsRefunded(event: ShopiEvent<EscrowPayload>): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyEscrowEvent({
        recipientType: NotificationActorType.CLIENT,
        recipientId:   payload.clientId,
        commandeId:    payload.commandeId,
        commandeRef:   payload.commandeRef,
        title:         'Remboursement initié',
        body:          `${payload.montant} ${payload.devise} vous seront remboursés suite à la résolution du litige sur la commande ${payload.commandeRef}.`,
        montant:       payload.montant,
        devise:        payload.devise,
        escrowId:      payload.escrowId,
      }),
      event,
      PaiementSubscriber.name,
    );
  }

  /**
   * escrow.auto_released → notification de libération automatique après délai.
   * Notifie l'entreprise ET le client (confirmation implicite).
   */
  private async onAutoReleased(event: ShopiEvent<EscrowPayload>): Promise<void> {
    const { payload } = event;

    const targets: Array<{ type: NotificationActorType; id: string; body: string }> = [
      {
        type: NotificationActorType.COMPANY,
        id:   payload.companyId,
        body: `Les fonds de la commande ${payload.commandeRef} ont été libérés automatiquement après le délai de confirmation.`,
      },
      {
        type: NotificationActorType.CLIENT,
        id:   payload.clientId,
        body: `La commande ${payload.commandeRef} a été validée automatiquement. Le paiement a été libéré.`,
      },
    ];

    for (const t of targets) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyEscrowEvent({
          recipientType: t.type,
          recipientId:   t.id,
          commandeId:    payload.commandeId,
          commandeRef:   payload.commandeRef,
          title:         'Libération automatique',
          body:          t.body,
          montant:       payload.montant,
          devise:        payload.devise,
          escrowId:      payload.escrowId,
        }),
        event,
        `${PaiementSubscriber.name}:auto_released:${t.type}`,
      );
    }
  }
}

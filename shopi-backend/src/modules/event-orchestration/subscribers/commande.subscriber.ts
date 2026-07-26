/* ============================================================
 * FICHIER      : src/modules/event-orchestration/subscribers/commande.subscriber.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Subscriber des événements du domaine Commande
 * RESPONSABILITES :
 *   - S'abonner aux événements ORDER_* au démarrage du module
 *   - Déléguer les notifications aux bons acteurs via NotificationEventService
 *   - Gérer les re-tentatives via RetryManagerService
 * DEPENDANCES  :
 *   EventBusService, NotificationEventService, RetryManagerService
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { EventBusService }       from '../services/event-bus.service';
import { RetryManagerService }   from '../services/retry-manager.service';

import {
  NotificationEventService,
} from '../../notifications/events/notification-event.service';
import {
  NotificationActorType,
} from '../../../database/entities/notification/notification.entitiy';

import {
  ORDER_EVENTS,
  ShopiEvent,
  OrderCreatedPayload,
  OrderPaidPayload,
  OrderStatusChangedPayload,
  OrderCancelledPayload,
} from '../types/events.types';

/* ============================================================
 * SUBSCRIBER
 * ============================================================ */

@Injectable()
export class CommandeSubscriber implements OnModuleInit {

  private readonly logger = new Logger(CommandeSubscriber.name);

  constructor(
    private readonly bus:        EventBusService,
    private readonly notifEvent: NotificationEventService,
    private readonly retry:      RetryManagerService,
  ) {}

  /**
   * Enregistrement de tous les abonnements au démarrage du module.
   * OnModuleInit garantit que le bus et la NotifEvent sont prêts.
   */
  onModuleInit(): void {
    this.bus.onEvent<OrderCreatedPayload>(
      ORDER_EVENTS.CREATED,
      (e) => this.onOrderCreated(e),
    );

    this.bus.onEvent<OrderPaidPayload>(
      ORDER_EVENTS.PAID,
      (e) => this.onOrderPaid(e),
    );

    this.bus.onEvent<OrderStatusChangedPayload>(
      ORDER_EVENTS.CONFIRMED,
      (e) => this.onOrderStatusChanged(e),
    );

    this.bus.onEvent<OrderStatusChangedPayload>(
      ORDER_EVENTS.IN_PROGRESS,
      (e) => this.onOrderStatusChanged(e),
    );

    this.bus.onEvent<OrderStatusChangedPayload>(
      ORDER_EVENTS.AWAITING_CLIENT,
      (e) => this.onOrderStatusChanged(e),
    );

    this.bus.onEvent<OrderStatusChangedPayload>(
      ORDER_EVENTS.DELIVERED,
      (e) => this.onOrderStatusChanged(e),
    );

    this.bus.onEvent<OrderStatusChangedPayload>(
      ORDER_EVENTS.AUTO_DELIVERED,
      (e) => this.onOrderStatusChanged(e),
    );

    this.bus.onEvent<OrderCancelledPayload>(
      ORDER_EVENTS.CANCELLED,
      (e) => this.onOrderCancelled(e),
    );

    this.logger.log(`CommandeSubscriber — ${Object.keys(ORDER_EVENTS).length} événements abonnés`);
  }

  /* ==========================================================
   * HANDLERS
   * ========================================================== */

  /**
   * order.created → notifie l'entreprise + éventuellement livreur et correspondant.
   */
  private async onOrderCreated(event: ShopiEvent<OrderCreatedPayload>): Promise<void> {
    const { payload } = event;
    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyOrderPlaced({
        companyId:          payload.companyId,
        clientId:           payload.clientId,
        clientName:         payload.clientName,
        orderRef:           payload.commandeRef,
        commandeId:         payload.commandeId,
        totalAmount:        payload.montantTotal,
        livreurId:          payload.livreurId,
        livreurName:        payload.livreurName,
        correspondantId:    payload.correspondantId,
      }),
      event,
      CommandeSubscriber.name,
    );
  }

  /**
   * order.paid → notifie le client que son paiement a été reçu.
   */
  private async onOrderPaid(event: ShopiEvent<OrderPaidPayload>): Promise<void> {
    const { payload } = event;
    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyOrderStatusChanged({
        recipientType: NotificationActorType.CLIENT,
        recipientId:   payload.clientId,
        actorType:     null,
        actorId:       null,
        orderRef:      payload.commandeRef,
        commandeId:    payload.commandeId,
        newStatus:     'PAID',
        title:         'Paiement confirmé',
        body:          `Votre paiement de ${payload.montant} ${payload.devise} a bien été reçu pour la commande ${payload.commandeRef}.`,
      }),
      event,
      CommandeSubscriber.name,
    );
  }

  /**
   * order.confirmed / order.in_progress / order.awaiting_client / order.delivered / order.auto_delivered
   * → notifie tous les acteurs concernés du changement de statut.
   */
  private async onOrderStatusChanged(
    event: ShopiEvent<OrderStatusChangedPayload>,
  ): Promise<void> {
    const { payload } = event;
    const { commandeId, commandeRef, newStatus, clientId, companyId, livreurId, correspondantId } = payload;

    const recipients: Array<{
      type: NotificationActorType;
      id:   string;
      title: string;
      body:  string;
    }> = [];

    /* Mapper le statut vers un message lisible */
    const { title, body } = this.statusMessage(newStatus, commandeRef);

    /* CLIENT toujours notifié */
    recipients.push({ type: NotificationActorType.CLIENT, id: clientId, title, body });

    /* ENTREPRISE toujours notifiée */
    recipients.push({ type: NotificationActorType.COMPANY, id: companyId, title, body });

    /* LIVREUR si présent */
    if (livreurId) {
      recipients.push({ type: NotificationActorType.DELIVERY, id: livreurId, title, body });
    }

    /* CORRESPONDANT si présent */
    if (correspondantId) {
      recipients.push({ type: NotificationActorType.CORRESPONDENT, id: correspondantId, title, body });
    }

    for (const recipient of recipients) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyOrderStatusChanged({
          recipientType: recipient.type,
          recipientId:   recipient.id,
          actorType:     null,
          actorId:       null,
          orderRef:      commandeRef,
          commandeId,
          newStatus,
          title:         recipient.title,
          body:          recipient.body,
        }),
        event,
        `${CommandeSubscriber.name}:${recipient.type}`,
      );
    }
  }

  /**
   * order.cancelled → notifie client et entreprise de l'annulation.
   */
  private async onOrderCancelled(
    event: ShopiEvent<OrderCancelledPayload>,
  ): Promise<void> {
    const { payload } = event;

    const targets = [
      { type: NotificationActorType.CLIENT,  id: payload.clientId },
      { type: NotificationActorType.COMPANY, id: payload.companyId },
    ];

    for (const t of targets) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyOrderStatusChanged({
          recipientType: t.type,
          recipientId:   t.id,
          actorType:     null,
          actorId:       null,
          orderRef:      payload.commandeRef,
          commandeId:    payload.commandeId,
          newStatus:     'CANCELLED',
          title:         'Commande annulée',
          body:          `La commande ${payload.commandeRef} a été annulée. Raison : ${payload.reason}`,
        }),
        event,
        CommandeSubscriber.name,
      );
    }
  }

  /* ==========================================================
   * HELPERS
   * ========================================================== */

  /** Traduit un statut de commande en titre et corps de notification. */
  private statusMessage(status: string, ref: string): { title: string; body: string } {
    const messages: Record<string, { title: string; body: string }> = {
      IN_PROGRESS:     { title: 'Commande en cours', body: `La commande ${ref} est en cours de traitement.` },
      AWAITING_CLIENT: { title: 'Votre code est prêt', body: `Présentez votre code de confirmation pour la commande ${ref}.` },
      DELIVERED:       { title: 'Commande livrée', body: `La commande ${ref} a été confirmée comme livrée.` },
      AUTO_DELIVERED:  { title: 'Commande validée automatiquement', body: `La commande ${ref} a été validée automatiquement après le délai imparti.` },
      CONFIRMED:       { title: 'Commande confirmée', body: `L'entreprise a confirmé la commande ${ref}.` },
      DISPUTE_OPENED:  { title: 'Litige ouvert', body: `Un litige a été ouvert sur la commande ${ref}.` },
      COMPLETED:       { title: 'Commande complétée', body: `La commande ${ref} est entièrement complétée.` },
    };
    return messages[status] ?? { title: `Commande ${status}`, body: `La commande ${ref} est passée au statut ${status}.` };
  }
}

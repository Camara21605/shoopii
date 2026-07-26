/* ============================================================
 * FICHIER      : src/modules/event-orchestration/subscribers/system.subscriber.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Subscriber des événements système et litiges
 * RESPONSABILITES :
 *   - Écouter SYSTEM_EVENTS (alertes, maintenance, taux, anomalies)
 *   - Écouter DISPUTE_EVENTS (ouverture, escalade, résolution) → notif admin + acteurs
 *   - Écouter COMMISSION_EVENTS → notif commission distribuée
 *   - Logger les alertes critiques pour l'équipe ops
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
  SYSTEM_EVENTS,
  DISPUTE_EVENTS,
  COMMISSION_EVENTS,
  ShopiEvent,
  SystemAlertPayload,
  DisputeOpenedPayload,
  DisputeResolvedPayload,
  CommissionDistributedPayload,
} from '../types/events.types';

/* ============================================================
 * SUBSCRIBER
 * ============================================================ */

@Injectable()
export class SystemSubscriber implements OnModuleInit {

  private readonly logger = new Logger(SystemSubscriber.name);

  constructor(
    private readonly bus:        EventBusService,
    private readonly notifEvent: NotificationEventService,
    private readonly retry:      RetryManagerService,
  ) {}

  onModuleInit(): void {
    /* ---- Système ---- */
    this.bus.onEvent<SystemAlertPayload>(
      SYSTEM_EVENTS.ALERT,
      (e) => this.onSystemAlert(e),
    );

    this.bus.onEvent<SystemAlertPayload>(
      SYSTEM_EVENTS.MAINTENANCE_START,
      (e) => this.onMaintenanceStart(e),
    );

    this.bus.onEvent<SystemAlertPayload>(
      SYSTEM_EVENTS.MAINTENANCE_END,
      (e) => this.onMaintenanceEnd(e),
    );

    this.bus.onEvent<SystemAlertPayload>(
      SYSTEM_EVENTS.RATE_LIMIT_EXCEEDED,
      (e) => this.onRateLimitExceeded(e),
    );

    /* ---- Litiges ---- */
    this.bus.onEvent<DisputeOpenedPayload>(
      DISPUTE_EVENTS.OPENED,
      (e) => this.onDisputeOpened(e),
    );

    this.bus.onEvent<DisputeOpenedPayload>(
      DISPUTE_EVENTS.ESCALATED,
      (e) => this.onDisputeEscalated(e),
    );

    this.bus.onEvent<DisputeResolvedPayload>(
      DISPUTE_EVENTS.RESOLVED,
      (e) => this.onDisputeResolved(e),
    );

    this.bus.onEvent<DisputeResolvedPayload>(
      DISPUTE_EVENTS.AUTO_CLOSED,
      (e) => this.onDisputeAutoClosed(e),
    );

    /* ---- Commissions ---- */
    this.bus.onEvent<CommissionDistributedPayload>(
      COMMISSION_EVENTS.DISTRIBUTED,
      (e) => this.onCommissionDistributed(e),
    );

    this.logger.log('SystemSubscriber — SYSTEM_EVENTS + DISPUTE_EVENTS + COMMISSION_EVENTS actifs');
  }

  /* ==========================================================
   * HANDLERS SYSTÈME
   * ========================================================== */

  /**
   * system.alert → log ERROR + notif admin Super.
   * Toujours loggé, jamais exposé au client.
   */
  private async onSystemAlert(
    event: ShopiEvent<SystemAlertPayload>,
  ): Promise<void> {
    const { payload } = event;

    /* Niveau CRITICAL : log immédiat pour alerting ops */
    if (payload.severity === 'CRITICAL') {
      this.logger.error(
        `[SYSTEM_ALERT][CRITICAL] ${payload.alertType} — ${payload.message}`,
        JSON.stringify(payload.metadata ?? {}),
      );
    } else {
      this.logger.warn(
        `[SYSTEM_ALERT][${payload.severity}] ${payload.alertType} — ${payload.message}`,
      );
    }

    /* Notifier les admins si un adminId cible est fourni */
    if (payload.targetAdminId) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyAdminAlert({
          recipientType: NotificationActorType.ADMIN,
          recipientId:   payload.targetAdminId,
          severity:      payload.severity,
          alertType:     payload.alertType,
          title:         `Alerte système : ${payload.alertType}`,
          body:          payload.message,
          metadata:      payload.metadata,
        }),
        event,
        SystemSubscriber.name,
      );
    }
  }

  /**
   * system.maintenance_start → notif broadcast si adminId fourni.
   */
  private async onMaintenanceStart(
    event: ShopiEvent<SystemAlertPayload>,
  ): Promise<void> {
    const { payload } = event;

    this.logger.warn(`[MAINTENANCE_START] ${payload.message}`);

    if (payload.targetAdminId) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyAdminAlert({
          recipientType: NotificationActorType.ADMIN,
          recipientId:   payload.targetAdminId,
          severity:      'INFO',
          alertType:     'MAINTENANCE_START',
          title:         'Début de maintenance',
          body:          payload.message,
          metadata:      payload.metadata,
        }),
        event,
        SystemSubscriber.name,
      );
    }
  }

  /**
   * system.maintenance_end → fin de maintenance.
   */
  private async onMaintenanceEnd(
    event: ShopiEvent<SystemAlertPayload>,
  ): Promise<void> {
    const { payload } = event;

    this.logger.log(`[MAINTENANCE_END] ${payload.message}`);

    if (payload.targetAdminId) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyAdminAlert({
          recipientType: NotificationActorType.ADMIN,
          recipientId:   payload.targetAdminId,
          severity:      'INFO',
          alertType:     'MAINTENANCE_END',
          title:         'Fin de maintenance',
          body:          payload.message,
          metadata:      payload.metadata,
        }),
        event,
        SystemSubscriber.name,
      );
    }
  }

  /**
   * system.rate_limit_exceeded → log warning + alerte admin.
   */
  private async onRateLimitExceeded(
    event: ShopiEvent<SystemAlertPayload>,
  ): Promise<void> {
    const { payload } = event;

    this.logger.warn(
      `[RATE_LIMIT_EXCEEDED] ${payload.message} metadata=${JSON.stringify(payload.metadata ?? {})}`,
    );
  }

  /* ==========================================================
   * HANDLERS LITIGES
   * ========================================================== */

  /**
   * dispute.opened → notifie toutes les parties (client, entreprise, admin).
   */
  private async onDisputeOpened(
    event: ShopiEvent<DisputeOpenedPayload>,
  ): Promise<void> {
    const { payload } = event;

    const targets: Array<{ type: NotificationActorType; id: string; body: string }> = [
      {
        type: NotificationActorType.CLIENT,
        id:   payload.clientId,
        body: `Votre litige sur la commande ${payload.commandeRef} (réf. #${payload.disputeRef}) a bien été ouvert. Un administrateur va examiner votre dossier.`,
      },
      {
        type: NotificationActorType.COMPANY,
        id:   payload.companyId,
        body: `Un litige a été ouvert sur la commande ${payload.commandeRef} (réf. #${payload.disputeRef}). Motif : ${payload.reason}.`,
      },
    ];

    for (const t of targets) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyDisputeEvent({
          recipientType: t.type,
          recipientId:   t.id,
          disputeId:     payload.disputeId,
          disputeRef:    payload.disputeRef,
          commandeId:    payload.commandeId,
          commandeRef:   payload.commandeRef,
          title:         'Litige ouvert',
          body:          t.body,
          status:        'OPENED',
        }),
        event,
        `${SystemSubscriber.name}:dispute_opened:${t.type}`,
      );
    }
  }

  /**
   * dispute.escalated → prévient l'admin + escalade log.
   */
  private async onDisputeEscalated(
    event: ShopiEvent<DisputeOpenedPayload>,
  ): Promise<void> {
    const { payload } = event;

    this.logger.warn(
      `[DISPUTE_ESCALATED] disputeId=${payload.disputeId} commandeRef=${payload.commandeRef} ` +
      `clientId=${payload.clientId} companyId=${payload.companyId}`,
    );

    /* Notifier les deux parties de l'escalade */
    const targets = [
      { type: NotificationActorType.CLIENT,  id: payload.clientId },
      { type: NotificationActorType.COMPANY, id: payload.companyId },
    ];

    for (const t of targets) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyDisputeEvent({
          recipientType: t.type,
          recipientId:   t.id,
          disputeId:     payload.disputeId,
          disputeRef:    payload.disputeRef,
          commandeId:    payload.commandeId,
          commandeRef:   payload.commandeRef,
          title:         'Litige escaladé',
          body:          `Le litige #${payload.disputeRef} sur la commande ${payload.commandeRef} a été escaladé à un administrateur senior.`,
          status:        'ESCALATED',
        }),
        event,
        `${SystemSubscriber.name}:dispute_escalated:${t.type}`,
      );
    }
  }

  /**
   * dispute.resolved → notifie les deux parties + détail décision.
   */
  private async onDisputeResolved(
    event: ShopiEvent<DisputeResolvedPayload>,
  ): Promise<void> {
    const { payload } = event;

    const targets: Array<{ type: NotificationActorType; id: string; body: string }> = [
      {
        type: NotificationActorType.CLIENT,
        id:   payload.clientId,
        body: `Le litige #${payload.disputeRef} a été résolu. Décision : ${payload.decision}. ${payload.adminNote ?? ''}`,
      },
      {
        type: NotificationActorType.COMPANY,
        id:   payload.companyId,
        body: `Le litige #${payload.disputeRef} sur la commande ${payload.commandeRef} a été résolu. Décision : ${payload.decision}.`,
      },
    ];

    for (const t of targets) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyDisputeEvent({
          recipientType: t.type,
          recipientId:   t.id,
          disputeId:     payload.disputeId,
          disputeRef:    payload.disputeRef,
          commandeId:    payload.commandeId,
          commandeRef:   payload.commandeRef,
          title:         'Litige résolu',
          body:          t.body,
          status:        'RESOLVED',
        }),
        event,
        `${SystemSubscriber.name}:dispute_resolved:${t.type}`,
      );
    }
  }

  /**
   * dispute.auto_closed → fermeture automatique après délai d'inactivité.
   */
  private async onDisputeAutoClosed(
    event: ShopiEvent<DisputeResolvedPayload>,
  ): Promise<void> {
    const { payload } = event;

    const targets = [
      { type: NotificationActorType.CLIENT,  id: payload.clientId },
      { type: NotificationActorType.COMPANY, id: payload.companyId },
    ];

    for (const t of targets) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyDisputeEvent({
          recipientType: t.type,
          recipientId:   t.id,
          disputeId:     payload.disputeId,
          disputeRef:    payload.disputeRef,
          commandeId:    payload.commandeId,
          commandeRef:   payload.commandeRef,
          title:         'Litige fermé automatiquement',
          body:          `Le litige #${payload.disputeRef} a été fermé automatiquement après le délai de réponse imparti.`,
          status:        'AUTO_CLOSED',
        }),
        event,
        `${SystemSubscriber.name}:dispute_auto_closed:${t.type}`,
      );
    }
  }

  /* ==========================================================
   * HANDLERS COMMISSIONS
   * ========================================================== */

  /**
   * commission.distributed → notifie chaque bénéficiaire de sa part.
   */
  private async onCommissionDistributed(
    event: ShopiEvent<CommissionDistributedPayload>,
  ): Promise<void> {
    const { payload } = event;

    const beneficiaries: Array<{
      type:   NotificationActorType;
      id:     string;
      amount: number;
    }> = [];

    if (payload.livreurId && payload.livreurAmount) {
      beneficiaries.push({
        type:   NotificationActorType.DELIVERY,
        id:     payload.livreurId,
        amount: payload.livreurAmount,
      });
    }

    if (payload.correspondantId && payload.correspondantAmount) {
      beneficiaries.push({
        type:   NotificationActorType.CORRESPONDENT,
        id:     payload.correspondantId,
        amount: payload.correspondantAmount,
      });
    }

    for (const b of beneficiaries) {
      await this.retry.executeWithRetry(
        () => this.notifEvent.notifyCommissionReceived({
          recipientType: b.type,
          recipientId:   b.id,
          commandeId:    payload.commandeId,
          commandeRef:   payload.commandeRef,
          montant:       b.amount,
          devise:        payload.devise,
          title:         `Commission reçue : +${b.amount} ${payload.devise}`,
          body:          `Vous avez reçu une commission de ${b.amount} ${payload.devise} pour la commande ${payload.commandeRef}.`,
        }),
        event,
        `${SystemSubscriber.name}:commission:${b.type}`,
      );
    }
  }
}

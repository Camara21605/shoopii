/* ============================================================
 * FICHIER      : src/modules/event-orchestration/subscribers/wallet.subscriber.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Subscriber des événements du domaine Wallet + Withdrawal
 * RESPONSABILITES :
 *   - S'abonner aux WALLET_EVENTS et WITHDRAWAL_EVENTS
 *   - Notifier les acteurs des crédits, débits, gels de wallet
 *   - Notifier les acteurs des demandes et résultats de retrait
 *   - Déclencher des alertes admin sur les gels et anomalies
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
  WALLET_EVENTS,
  WITHDRAWAL_EVENTS,
  ShopiEvent,
  WalletCreditedPayload,
  WalletFrozenPayload,
  WithdrawalRequestedPayload,
  WithdrawalCompletedPayload,
} from '../types/events.types';

/* ============================================================
 * SUBSCRIBER
 * ============================================================ */

@Injectable()
export class WalletSubscriber implements OnModuleInit {

  private readonly logger = new Logger(WalletSubscriber.name);

  constructor(
    private readonly bus:        EventBusService,
    private readonly notifEvent: NotificationEventService,
    private readonly retry:      RetryManagerService,
  ) {}

  onModuleInit(): void {
    /* ---- Wallet ---- */
    this.bus.onEvent<WalletCreditedPayload>(
      WALLET_EVENTS.CREDITED,
      (e) => this.onWalletCredited(e),
    );

    this.bus.onEvent<WalletCreditedPayload>(
      WALLET_EVENTS.DEBITED,
      (e) => this.onWalletDebited(e),
    );

    this.bus.onEvent<WalletFrozenPayload>(
      WALLET_EVENTS.FROZEN,
      (e) => this.onWalletFrozen(e),
    );

    this.bus.onEvent<WalletFrozenPayload>(
      WALLET_EVENTS.UNFROZEN,
      (e) => this.onWalletUnfrozen(e),
    );

    /* ---- Retrait ---- */
    this.bus.onEvent<WithdrawalRequestedPayload>(
      WITHDRAWAL_EVENTS.REQUESTED,
      (e) => this.onWithdrawalRequested(e),
    );

    this.bus.onEvent<WithdrawalCompletedPayload>(
      WITHDRAWAL_EVENTS.COMPLETED,
      (e) => this.onWithdrawalCompleted(e),
    );

    this.bus.onEvent<WithdrawalRequestedPayload>(
      WITHDRAWAL_EVENTS.FAILED,
      (e) => this.onWithdrawalFailed(e),
    );

    this.bus.onEvent<WithdrawalRequestedPayload>(
      WITHDRAWAL_EVENTS.CANCELLED,
      (e) => this.onWithdrawalCancelled(e),
    );

    this.logger.log('WalletSubscriber — abonnements WALLET_EVENTS + WITHDRAWAL_EVENTS actifs');
  }

  /* ==========================================================
   * HANDLERS WALLET
   * ========================================================== */

  /**
   * wallet.credited → notifie l'acteur du crédit reçu.
   */
  private async onWalletCredited(
    event: ShopiEvent<WalletCreditedPayload>,
  ): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyWalletOperation({
        recipientType: payload.actorType as unknown as NotificationActorType,
        recipientId:   payload.actorId,
        walletId:      payload.walletId,
        operationType: 'CREDIT',
        montant:       payload.montant,
        devise:        payload.devise,
        newBalance:    payload.newBalance,
        title:         `+${payload.montant} ${payload.devise} crédité`,
        body:          `Votre portefeuille a été crédité de ${payload.montant} ${payload.devise}. Nouveau solde : ${payload.newBalance} ${payload.devise}.`,
        reference:     payload.reference,
      }),
      event,
      WalletSubscriber.name,
    );
  }

  /**
   * wallet.debited → notifie l'acteur du débit effectué.
   */
  private async onWalletDebited(
    event: ShopiEvent<WalletCreditedPayload>,
  ): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyWalletOperation({
        recipientType: payload.actorType as unknown as NotificationActorType,
        recipientId:   payload.actorId,
        walletId:      payload.walletId,
        operationType: 'DEBIT',
        montant:       payload.montant,
        devise:        payload.devise,
        newBalance:    payload.newBalance,
        title:         `-${payload.montant} ${payload.devise} débité`,
        body:          `${payload.montant} ${payload.devise} ont été débités de votre portefeuille. Nouveau solde : ${payload.newBalance} ${payload.devise}.`,
        reference:     payload.reference,
      }),
      event,
      WalletSubscriber.name,
    );
  }

  /**
   * wallet.frozen → notifie l'acteur + alerte admin.
   * Un gel de wallet est une action sensible qui requiert visibilité admin.
   */
  private async onWalletFrozen(
    event: ShopiEvent<WalletFrozenPayload>,
  ): Promise<void> {
    const { payload } = event;

    /* Notification à l'acteur dont le wallet est gelé */
    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyWalletFrozen({
        recipientType: payload.actorType as unknown as NotificationActorType,
        recipientId:   payload.actorId,
        walletId:      payload.walletId,
        reason:        payload.reason,
        frozenBy:      payload.frozenBy,
        title:         'Portefeuille gelé',
        body:          `Votre portefeuille a été gelé. Raison : ${payload.reason}. Contactez le support pour plus d'informations.`,
      }),
      event,
      `${WalletSubscriber.name}:frozen:acteur`,
    );

    /* Alerte admin systématique sur tout gel */
    this.logger.warn(
      `[WALLET_FROZEN] actorId=${payload.actorId} walletId=${payload.walletId} ` +
      `reason="${payload.reason}" frozenBy=${payload.frozenBy}`,
    );
  }

  /**
   * wallet.unfrozen → notifie l'acteur que son wallet est réactivé.
   */
  private async onWalletUnfrozen(
    event: ShopiEvent<WalletFrozenPayload>,
  ): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyWalletFrozen({
        recipientType: payload.actorType as unknown as NotificationActorType,
        recipientId:   payload.actorId,
        walletId:      payload.walletId,
        reason:        payload.reason,
        frozenBy:      payload.frozenBy,
        title:         'Portefeuille réactivé',
        body:          'Votre portefeuille a été réactivé. Vous pouvez à nouveau effectuer des transactions.',
      }),
      event,
      WalletSubscriber.name,
    );
  }

  /* ==========================================================
   * HANDLERS RETRAIT
   * ========================================================== */

  /**
   * withdrawal.requested → notifie l'acteur et informe l'admin.
   */
  private async onWithdrawalRequested(
    event: ShopiEvent<WithdrawalRequestedPayload>,
  ): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyWithdrawalStatus({
        recipientType: payload.actorType as unknown as NotificationActorType,
        recipientId:   payload.actorId,
        retraitId:     payload.retraitId,
        montant:       payload.montant,
        devise:        payload.devise,
        status:        'PENDING',
        title:         'Demande de retrait reçue',
        body:          `Votre demande de retrait de ${payload.montant} ${payload.devise} est en cours de traitement.`,
      }),
      event,
      WalletSubscriber.name,
    );
  }

  /**
   * withdrawal.completed → notifie l'acteur que le retrait a été effectué.
   */
  private async onWithdrawalCompleted(
    event: ShopiEvent<WithdrawalCompletedPayload>,
  ): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyWithdrawalStatus({
        recipientType: payload.actorType as unknown as NotificationActorType,
        recipientId:   payload.actorId,
        retraitId:     payload.retraitId,
        montant:       payload.montant,
        devise:        payload.devise,
        status:        'COMPLETED',
        title:         'Retrait effectué',
        body:          `Votre retrait de ${payload.montant} ${payload.devise} a été effectué avec succès vers ${payload.momoProvider}.`,
        transactionRef: payload.transactionRef,
      }),
      event,
      WalletSubscriber.name,
    );
  }

  /**
   * withdrawal.failed → notifie l'acteur de l'échec + raison.
   */
  private async onWithdrawalFailed(
    event: ShopiEvent<WithdrawalRequestedPayload>,
  ): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyWithdrawalStatus({
        recipientType: payload.actorType as unknown as NotificationActorType,
        recipientId:   payload.actorId,
        retraitId:     payload.retraitId,
        montant:       payload.montant,
        devise:        payload.devise,
        status:        'FAILED',
        title:         'Échec du retrait',
        body:          `Votre demande de retrait de ${payload.montant} ${payload.devise} a échoué. Les fonds ont été recrédités sur votre portefeuille.`,
      }),
      event,
      WalletSubscriber.name,
    );
  }

  /**
   * withdrawal.cancelled → notifie l'acteur de l'annulation.
   */
  private async onWithdrawalCancelled(
    event: ShopiEvent<WithdrawalRequestedPayload>,
  ): Promise<void> {
    const { payload } = event;

    await this.retry.executeWithRetry(
      () => this.notifEvent.notifyWithdrawalStatus({
        recipientType: payload.actorType as unknown as NotificationActorType,
        recipientId:   payload.actorId,
        retraitId:     payload.retraitId,
        montant:       payload.montant,
        devise:        payload.devise,
        status:        'CANCELLED',
        title:         'Retrait annulé',
        body:          `Votre demande de retrait de ${payload.montant} ${payload.devise} a été annulée.`,
      }),
      event,
      WalletSubscriber.name,
    );
  }
}

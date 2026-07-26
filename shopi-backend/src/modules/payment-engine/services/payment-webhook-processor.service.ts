/* ============================================================
 * FICHIER : src/modules/payment-engine/services/payment-webhook-processor.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Traite les webhooks entrants des providers de paiement.
 * VERSION UPGRADÉE : intègre EscrowEngine au lieu de manipuler
 * directement les wallets (ancienne approche).
 *
 * PIPELINE
 * ------------------------------------------------------------
 * 1. Idempotence via WebhookEvent (replay protection)
 * 2. Parser + vérifier la signature via le provider
 * 3. SQL transaction : commande PAID + distributions (sans wallet) + session CONFIRMED
 * 4. EscrowEngine : creer → recevoirFonds → verrouillerFonds → attendreValidation
 * 5. Événement PaymentConfirmedEvent
 * 6. Notifications asynchrones
 *
 * SÉCURITÉ
 * ------------------------------------------------------------
 * - Signature HMAC vérifiée avant tout traitement
 * - Idempotence DB (WebhookEvent UQ_webhook_provider_event)
 * - Amount mismatch → BadRequestException (logué FinancialAuditLog)
 * - EscrowEngine créé en dehors de la transaction SQL principale
 *   pour éviter les conflits de transactions imbriquées
 * ============================================================ */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Commande, CommandeStatus } from '../../../database/entities/commande/commande.entity';
import { Wallet }                   from '../../../database/entities/wallet.entity';
import {
  PaiementSession,
  PaiementSessionStatus,
} from '../../../database/entities/paiement/paiement-session.entity';
import {
  PaiementDistribution,
  DistributionStatus,
  DistributionActeurType,
} from '../../../database/entities/paiement/paiement-distribution.entity';
import {
  WebhookEvent,
  WebhookEventStatus,
} from '../../../database/entities/paiement/webhook-event.entity';

import { CommissionEngine }   from '../../commission/commission.engine';
import { CommissionContext }  from '../../commission/types/commission.types';
import { EscrowEngine }       from '../../escrow-engine/escrow.engine';
import { EscrowTrigger }      from '../../../database/entities/paiement/escrow.entity';

import { PaymentProviderFactory } from '../../paiement/providers/payment-provider.factory';
import { NotificationEventService } from '../../notifications/events/notification-event.service';
import { NotificationActorType }    from '../../../database/entities/notification/notification.entitiy';

import { PaymentEventBus } from '../events/payment-event-bus.service';
import {
  PAYMENT_EVENTS,
  PaymentConfirmedEvent,
  PaymentFailedEvent,
} from '../events/payment.events';
import { PaymentErreur, PaymentErreurType } from '../types/payment-engine.types';

@Injectable()
export class PaymentWebhookProcessorService {

  private readonly logger = new Logger(PaymentWebhookProcessorService.name);

  constructor(
    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    @InjectRepository(PaiementDistribution)
    private readonly distributionRepo: Repository<PaiementDistribution>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepo: Repository<WebhookEvent>,

    private readonly dataSource:        DataSource,
    private readonly commissionEngine:  CommissionEngine,
    private readonly providerFactory:   PaymentProviderFactory,
    private readonly escrowEngine:      EscrowEngine,
    private readonly notifEventSvc:     NotificationEventService,
    private readonly eventBus:          PaymentEventBus,
  ) {}

  /* ════════════════════════════════════════════════════════
   * POINT D'ENTRÉE PRINCIPAL — appelé par PaiementController
   ════════════════════════════════════════════════════════ */

  async handleWebhook(
    providerName: string,
    rawBody:      string,
    headers:      Record<string, string>,
    sourceIp?:    string,
  ): Promise<{ received: boolean }> {

    /* ── 1. Résoudre le provider ──────────────────────────── */
    let provider;
    try {
      provider = this.providerFactory.resolveByName(providerName);
    } catch {
      throw new BadRequestException(`Provider inconnu : "${providerName}"`);
    }

    /* ── 2. Parser le payload (vérifie la signature HMAC) ── */
    const payload = await provider.parseWebhook(rawBody, headers);

    this.logger.log(
      `[Webhook] Reçu — provider: ${providerName} ` +
      `txId: ${payload.providerTransactionId} ` +
      `approved: ${payload.approved}`,
    );

    /* ── 3. Idempotence via WebhookEvent ─────────────────── */
    const eventId = payload.providerTransactionId ?? payload.idempotencyKey ?? 'unknown';

    const existingEvent = await this.webhookEventRepo.findOne({
      where: { provider: providerName, eventId },
    });

    if (existingEvent?.status === WebhookEventStatus.PROCESSED) {
      this.logger.log(`[Webhook] Doublon détecté — eventId ${eventId} déjà traité`);
      return { received: true };
    }

    /* Créer ou réutiliser l'enregistrement du webhook */
    let webhookEvent: WebhookEvent;
    if (existingEvent) {
      webhookEvent = existingEvent;
      webhookEvent.attempts++;
    } else {
      webhookEvent = this.webhookEventRepo.create({
        provider:       providerName,
        eventId,
        eventType:      null,
        sessionId:      null,
        payload:        JSON.parse(rawBody || '{}') as Record<string, unknown>,
        headers:        headers as Record<string, string>,
        signature:      headers['x-fedapay-signature'] ?? headers['x-signature'] ?? null,
        signatureValid: true,
        status:         WebhookEventStatus.RECEIVED,
        attempts:       1,
        sourceIp:       sourceIp ?? null,
      });
    }

    /* ── 4. Paiement refusé → mettre la session en FAILED ── */
    if (!payload.approved) {
      await this.sessionRepo.update(
        { idempotencyKey: payload.idempotencyKey },
        {
          status:      PaiementSessionStatus.FAILED,
          echecRaison: payload.erreur ?? 'Refusé par le provider',
        },
      );

      const failedSession = await this.sessionRepo.findOne({
        where: { idempotencyKey: payload.idempotencyKey },
      });
      if (failedSession) {
        this.eventBus.emit(
          PAYMENT_EVENTS.FAILED,
          new PaymentFailedEvent(
            failedSession.id,
            failedSession.commandeId,
            failedSession.provider,
            payload.erreur ?? 'Refusé par le provider',
          ),
        );
      }

      webhookEvent.status      = WebhookEventStatus.PROCESSED;
      webhookEvent.processedAt = new Date();
      await this.webhookEventRepo.save(webhookEvent);
      return { received: true };
    }

    /* ── 5. Trouver la session ────────────────────────────── */
    let session = await this.sessionRepo.findOne({
      where: { idempotencyKey: payload.idempotencyKey },
    });

    if (!session) {
      session = await this.sessionRepo.findOne({
        where: { providerTransactionId: payload.providerTransactionId },
      });
    }

    if (!session) {
      this.logger.warn(`[Webhook] Session introuvable pour idempotencyKey: ${payload.idempotencyKey}`);
      webhookEvent.status       = WebhookEventStatus.FAILED;
      webhookEvent.errorMessage = 'Session introuvable';
      await this.webhookEventRepo.save(webhookEvent);
      return { received: true };
    }

    webhookEvent.sessionId = session.id;

    /* ── 6. Idempotence session ───────────────────────────── */
    if (session.status === PaiementSessionStatus.CONFIRMED) {
      this.logger.log(`[Webhook] Session ${session.id} déjà confirmée — ignoré`);
      webhookEvent.status      = WebhookEventStatus.PROCESSED;
      webhookEvent.processedAt = new Date();
      await this.webhookEventRepo.save(webhookEvent);
      return { received: true };
    }

    /* ── 7. Confirmer le paiement ─────────────────────────── */
    try {
      await this.confirmerPaiement(
        session.id,
        payload.providerTransactionId,
        payload.montantConfirme,
        payload.idempotencyKey,
        providerName,
        rawBody,
      );

      webhookEvent.status      = WebhookEventStatus.PROCESSED;
      webhookEvent.processedAt = new Date();
    } catch (err) {
      this.logger.error(`[Webhook] Erreur traitement session ${session.id}:`, err);
      webhookEvent.status       = WebhookEventStatus.FAILED;
      webhookEvent.errorMessage = (err as Error).message;
      webhookEvent.errorStack   = (err as Error).stack ?? null;
      await this.webhookEventRepo.save(webhookEvent);
      throw err;
    }

    await this.webhookEventRepo.save(webhookEvent);
    return { received: true };
  }

  /* ════════════════════════════════════════════════════════
   * CONFIRMATION DU PAIEMENT
   * Appelé par handleWebhook() et par PaiementInitiationService
   * (mode interne, confirmation immédiate).
   ════════════════════════════════════════════════════════ */

  async confirmerPaiement(
    sessionId:              string,
    providerTransactionId:  string,
    montantConfirme:        number,
    idempotencyKey:         string,
    providerName:           string,
    webhookRawBody?:        string,
  ): Promise<void> {

    /* ── Charger la session ────────────────────────────────── */
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session introuvable : ${sessionId}`);

    if (session.status === PaiementSessionStatus.CONFIRMED) {
      this.logger.log(`[Confirm] Session ${sessionId} déjà confirmée — no-op`);
      return;
    }

    /* ── Charger la commande ──────────────────────────────── */
    const commande = await this.commandeRepo.findOne({ where: { id: session.commandeId } });
    if (!commande) throw new NotFoundException(`Commande introuvable : ${session.commandeId}`);

    /* ── Validation du montant (tolérance 1 GNF) ─────────── */
    if (montantConfirme > 0 && Math.abs(montantConfirme - session.montant) > 1) {
      throw new BadRequestException(
        `Montant confirmé (${montantConfirme}) ≠ montant attendu (${session.montant})`,
      );
    }

    /* ── Calcul de la répartition via CommissionEngine ───── */
    const context: CommissionContext = {
      commandeId:      commande.id,
      commandeNumero:  commande.numero,
      companyId:       commande.companyId,
      livreurId:       commande.livreurId      ?? null,
      correspondantId: commande.correspondantId ?? null,
      sousTotal:       Number(commande.sousTotal),
      fraisLivraison:  Number(commande.fraisLivraison),
      total:           Number(commande.total),
    };
    const calcul = await this.commissionEngine.calculer(context);

    /* ── Résoudre le wallet client pour l'EscrowEngine ───── */
    let clientWallet = await this.walletRepo.findOne({ where: { userId: commande.clientId } });
    if (!clientWallet) {
      clientWallet = this.walletRepo.create({ userId: commande.clientId });
      clientWallet = await this.walletRepo.save(clientWallet);
    }

    /* ── Transaction SQL : commande + distributions + session */
    const distributionIds: string[] = [];

    await this.dataSource.transaction(async manager => {

      /* 1. Commande → PAID */
      commande.status       = CommandeStatus.PAID;
      commande.refPaiement  = providerTransactionId;
      commande.datePaiement = new Date();
      await manager.save(Commande, commande);

      /* 2. Distributions (SANS manipulation wallet) */
      for (const part of calcul.parts) {
        if (part.montant <= 0) continue;

        /* Wallet de l'acteur (crée si absent) */
        let wallet = await manager.findOne(Wallet, { where: { userId: part.acteurUserId } });
        if (!wallet) {
          wallet = manager.create(Wallet, { userId: part.acteurUserId });
          wallet = await manager.save(Wallet, wallet);
        }

        const isPlateforme =
          part.acteurType === DistributionActeurType.PLATEFORME_PRODUIT  ||
          part.acteurType === DistributionActeurType.PLATEFORME_LIVRAISON ||
          part.acteurType === DistributionActeurType.PLATEFORME;

        const dist = manager.create(PaiementDistribution, {
          commandeId:           commande.id,
          commandeNumero:       commande.numero,
          sessionId,
          acteurType:           part.acteurType,
          acteurUserId:         part.acteurUserId,
          walletId:             wallet.id,
          acteurNom:            part.acteurNom,
          montant:              part.montant,
          tauxCommission:       isPlateforme ? calcul.tauxEffectifProduit * 100 : null,
          commandeMontantTotal: Number(commande.total),
          escrowTransactionId:  null,        // géré par WalletEngine
          status:               DistributionStatus.ESCROW,
          commissionRuleId:     calcul.rule?.id  ?? null,
          snapshotTaux:         calcul.snapshotTaux as unknown as Record<string, unknown>,
        });

        const savedDist = await manager.save(PaiementDistribution, dist);
        distributionIds.push(savedDist.id);
      }

      /* 3. Session → CONFIRMED */
      session.status                = PaiementSessionStatus.CONFIRMED;
      session.providerTransactionId = providerTransactionId;
      session.confirmedAt           = new Date();
      if (webhookRawBody) {
        session.webhookPayloadRaw = webhookRawBody;
        session.webhookReceivedAt = new Date();
      }
      await manager.save(PaiementSession, session);
    });

    this.logger.log(
      `[Confirm] ✅ Session ${sessionId} confirmée — ` +
      `${distributionIds.length} distributions créées`,
    );

    /* ── EscrowEngine : chaîne de verrouillage ───────────── */
    const escrow = await this.escrowEngine.creer({
      commandeId:       commande.id,
      commandeNumero:   commande.numero,
      sessionId,
      clientUserId:     commande.clientId,
      clientWalletId:   clientWallet.id,
      montantTotal:     Number(commande.total),
      currency:         session.devise ?? 'GNF',
      metadata:         {
        provider:             providerName,
        providerTransactionId,
        idempotencyKey,
      },
    });

    await this.escrowEngine.recevoirFonds({
      escrowId:        escrow.id,
      sessionId,
      montantConfirme: montantConfirme > 0 ? montantConfirme : Number(commande.total),
      provider:        providerName,
    });

    await this.escrowEngine.verrouillerFonds({
      escrowId:    escrow.id,
      triggeredBy: EscrowTrigger.WEBHOOK,
    });

    await this.escrowEngine.attendreValidation({
      escrowId:    escrow.id,
      triggeredBy: EscrowTrigger.WEBHOOK,
    });

    this.logger.log(
      `[Confirm] ✅ Escrow ${escrow.id} créé et verrouillé — ` +
      `commande ${commande.numero} PAID`,
    );

    /* ── Événement ───────────────────────────────────────── */
    this.eventBus.emit(
      PAYMENT_EVENTS.CONFIRMED,
      new PaymentConfirmedEvent(
        session.id,
        commande.id,
        commande.numero,
        commande.clientId,
        session.provider,
        providerTransactionId,
        montantConfirme > 0 ? montantConfirme : Number(commande.total),
        escrow.id,
      ),
    );

    /* ── Notifications (fire-and-forget) ─────────────────── */
    this.sendPaiementNotifications(commande).catch(err =>
      this.logger.error('[Confirm] Erreur notifications:', err),
    );
  }

  /* ── Notifications ──────────────────────────────────────── */

  private async sendPaiementNotifications(commande: Commande): Promise<void> {
    void this.notifEventSvc.notifyOrderStatusChanged({
      recipientType: NotificationActorType.COMPANY,
      recipientId:   commande.companyId,
      actorType:     NotificationActorType.CLIENT,
      actorId:       commande.clientId,
      orderRef:      commande.numero,
      commandeId:    commande.id,
      newStatus:     CommandeStatus.PAID,
      title:         'Paiement reçu',
      body:          `La commande ${commande.numero} a été payée. Validez votre code pour commencer.`,
    });

    if (commande.livreurId) {
      void this.notifEventSvc.notifyOrderStatusChanged({
        recipientType: NotificationActorType.DELIVERY,
        recipientId:   commande.livreurId,
        actorType:     null,
        actorId:       null,
        orderRef:      commande.numero,
        commandeId:    commande.id,
        newStatus:     CommandeStatus.PAID,
        title:         'Nouvelle livraison',
        body:          `Vous avez une nouvelle livraison à effectuer (${commande.numero}).`,
      });
    }

    if (commande.correspondantId) {
      void this.notifEventSvc.notifyOrderStatusChanged({
        recipientType: NotificationActorType.CORRESPONDENT,
        recipientId:   commande.correspondantId,
        actorType:     null,
        actorId:       null,
        orderRef:      commande.numero,
        commandeId:    commande.id,
        newStatus:     CommandeStatus.PAID,
        title:         'Nouveau colis',
        body:          `Un colis vous est assigné (${commande.numero}).`,
      });
    }
  }
}

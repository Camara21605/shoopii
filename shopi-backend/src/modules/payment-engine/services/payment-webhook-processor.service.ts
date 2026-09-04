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
import { DataSource, Not, Repository } from 'typeorm';

import { Commande, CommandeStatus } from '../../../database/entities/commande/commande.entity';
import { Client }                   from '../../../database/entities/profiles/client-profile.entity';
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
import { SecurityAlertsService } from '../../security-alerts/security-alerts.service';
import { EventOrchestrationEngine } from '../../event-orchestration/event-orchestration.engine';
import { EventSource, COMMISSION_EVENTS, CommissionDistributedPayload } from '../../event-orchestration/types/events.types';

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

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    private readonly dataSource:        DataSource,
    private readonly commissionEngine:  CommissionEngine,
    private readonly providerFactory:   PaymentProviderFactory,
    private readonly escrowEngine:      EscrowEngine,
    private readonly notifEventSvc:     NotificationEventService,
    private readonly eventBus:          PaymentEventBus,
    private readonly securityAlertsService: SecurityAlertsService,
    private readonly orchestration:     EventOrchestrationEngine,
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

        /* Alerte "transaction refusée" — fire-and-forget, ne doit jamais
         * retarder/faire échouer le traitement du webhook. No-op
         * silencieux si le payeur n'est pas un CLIENT (voir
         * SecurityAlertsService.isEnabled) ou si la commande/le client
         * est introuvable (ex: commande supprimée entretemps). */
        this.notifyPaymentDeclined(failedSession.commandeId, payload.erreur ?? 'Refusé par le provider')
          .catch(() => {});
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

    /* ── Résoudre le wallet client pour l'EscrowEngine ─────
     * BUG CORRIGÉ — commande.clientId est le PK du profil Client
     * (Client.id, cf. @ManyToOne(() => Client) @JoinColumn({name:'clientId'})
     * sur Commande), PAS le User.id réel. Wallet est keyé par le vrai
     * User.id partout ailleurs (voir WalletService.getOrCreateWallet,
     * appelé avec user.id sur tous ses sites d'appel). Sans cette
     * résolution, l'escrow créait un wallet "fantôme" indexé par
     * Client.id : les remboursements (escrow-refund.service.ts, qui
     * réutilise ce clientWalletId en priorité) y créditaient des fonds
     * que le client ne pouvait jamais voir dans son wallet réel. */
    const clientProfile = await this.clientRepo.findOne({ where: { id: commande.clientId }, select: ['userId'] });
    if (!clientProfile) throw new NotFoundException(`Profil client introuvable pour la commande ${commande.numero}`);
    const clientUserId = clientProfile.userId;

    let clientWallet = await this.walletRepo.findOne({ where: { userId: clientUserId } });
    if (!clientWallet) {
      clientWallet = this.walletRepo.create({ userId: clientUserId });
      clientWallet = await this.walletRepo.save(clientWallet);
    }

    /* ── Transaction SQL : commande + distributions + session */
    const distributionIds: string[] = [];

    try {
      await this.dataSource.transaction(async manager => {

      /* 1. Commande → PAID */
      commande.status       = CommandeStatus.PAID;
      commande.refPaiement  = providerTransactionId;
      commande.datePaiement = new Date();

      /* BUG CORRIGÉ — commande.commissionShopi était figé à la création
       * de la commande (commande-creation.service.ts), calculé avec une
       * formule indépendante (PlatformSettings.platformCommission, sans
       * multiplicateur de plan ni override CompanySetting) et jamais
       * recalé ensuite : la page de suivi client et les KPIs financiers
       * du dashboard entreprise (entreprise-dashboard.service.ts) restaient
       * durablement faux dès que le plan de la boutique ou son override
       * de commission différait du cas STANDARD par défaut. On écrase ici
       * cette estimation par le montant RÉEL calculé par le CommissionEngine
       * (part PLATEFORME_PRODUIT, seule part figurant dans commissionShopi —
       * la part livraison n'y a jamais été incluse, voir commande-query.service.ts). */
      const partProduitPlateforme = calcul.parts.find(
        p => p.acteurType === DistributionActeurType.PLATEFORME_PRODUIT,
      );
      if (partProduitPlateforme) {
        commande.commissionShopi = Math.round(partProduitPlateforme.montant);
      }

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
    } catch (err) {
      /* Race entre deux livraisons quasi-simultanées du même webhook :
       * les deux passent le check "session CONFIRMED ?" ci-dessus avant
       * que l'une des deux commite, puis la seconde viole la contrainte
       * UQ_distribution_commande_acteur_type sur l'INSERT (protection
       * réelle contre le double-crédit — la transaction est rollback
       * automatiquement, aucun wallet n'est affecté deux fois). Sans ce
       * catch, cette 2e livraison remontait en erreur 500 non catégorisée
       * jusqu'au provider de paiement (retries/alerting inutiles) au lieu
       * d'un no-op idempotent propre. */
      const pgCode = (err as { code?: string })?.code;
      if (pgCode === '23505') {
        const fresh = await this.sessionRepo.findOne({ where: { id: sessionId } });
        if (fresh?.status === PaiementSessionStatus.CONFIRMED) {
          this.logger.warn(`[Confirm] Session ${sessionId} — webhook concurrent déjà traité par une autre requête, ignoré.`);
          return;
        }
      }
      throw err;
    }

    this.logger.log(
      `[Confirm] ✅ Session ${sessionId} confirmée — ` +
      `${distributionIds.length} distributions créées`,
    );

    /* ── Événement commission.distributed ──────────────────
     * Émis maintenant que les PaiementDistribution sont persistées
     * (voir CommissionDistributedEvent, commission.events.ts : "émis
     * par le module appelant après sauvegarde"). Fire-and-forget via
     * l'EventOrchestrationEngine — jamais bloquant pour la confirmation
     * du paiement elle-même. */
    try {
      const shopiTotal = calcul.parts
        .filter(p =>
          p.acteurType === DistributionActeurType.PLATEFORME_PRODUIT ||
          p.acteurType === DistributionActeurType.PLATEFORME_LIVRAISON ||
          p.acteurType === DistributionActeurType.PLATEFORME,
        )
        .reduce((s, p) => s + p.montant, 0);

      const partLivreur      = calcul.parts.find(p => p.acteurType === DistributionActeurType.LIVREUR);
      const partCorrespondant = calcul.parts.find(p => p.acteurType === DistributionActeurType.CORRESPONDANT);

      const payload: CommissionDistributedPayload = {
        commandeId:     commande.id,
        commandeRef:    commande.numero,
        devise:         session.devise ?? 'GNF',
        totalDistribue: calcul.totalDistribue,
        shopiTotal,
        livreurId:            commande.livreurId ?? undefined,
        livreurAmount:        partLivreur?.montant,
        correspondantId:      commande.correspondantId ?? undefined,
        correspondantAmount:  partCorrespondant?.montant,
        detailParActeur: calcul.parts.map(p => ({
          acteurType: p.acteurType,
          acteurId:   p.acteurUserId,
          montant:    p.montant,
          taux:       p.tauxApplique ?? 0,
        })),
      };

      this.orchestration.publish(
        COMMISSION_EVENTS.DISTRIBUTED,
        payload,
        EventSource.COMMISSION,
        { correlationId: commande.id },
      );
    } catch (err) {
      /* Ne doit jamais faire échouer la confirmation du paiement */
      this.logger.error('[Confirm] Erreur publication commission.distributed:', err);
    }

    /* ── EscrowEngine : chaîne de verrouillage ───────────── */
    const escrow = await this.escrowEngine.creer({
      commandeId:       commande.id,
      commandeNumero:   commande.numero,
      sessionId,
      clientUserId:     clientUserId,
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
        clientUserId,
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

    /* Alerte "transaction suspecte" (montant inhabituellement élevé) —
     * le pendant "refusée" du même type d'alerte est géré côté échec du
     * webhook, voir notifyPaymentDeclined(). Fire-and-forget. */
    this.notifyIfUnusuallyHigh(commande).catch(() => {});
  }

  /** Alerte "transaction suspecte" — montant significativement supérieur
   * à la moyenne des commandes payées précédentes de ce client. Même
   * principe que AnomalyDetectorService.isWithdrawalAnomaly() (facteur ×
   * moyenne + plancher absolu), mais appliqué aux achats client — cette
   * comparaison n'existait nulle part pour les commandes avant ce jour. */
  private async notifyIfUnusuallyHigh(commande: Commande): Promise<void> {
    const ANOMALY_FACTOR = 3;
    const ANOMALY_FLOOR  = 500_000; // GNF — jamais "suspect" en dessous, même si > 3x la moyenne
    const HISTORY_SIZE   = 10;
    const MIN_HISTORY    = 3;       // historique trop court → comparaison pas fiable, on ignore

    const total = Number(commande.total);
    if (total < ANOMALY_FLOOR) return;

    const history = await this.commandeRepo.find({
      where: { clientId: commande.clientId, status: CommandeStatus.PAID, id: Not(commande.id) },
      select: ['total'],
      order: { datePaiement: 'DESC' },
      take: HISTORY_SIZE,
    });
    if (history.length < MIN_HISTORY) return;

    const average = history.reduce((sum, h) => sum + Number(h.total), 0) / history.length;
    if (total < average * ANOMALY_FACTOR) return;

    const client = await this.clientRepo.findOne({ where: { id: commande.clientId }, select: ['userId'] });
    if (!client) return;

    await this.securityAlertsService.notifyIfEnabled(
      client.userId, 'transaction',
      'Transaction inhabituellement élevée',
      `Votre commande ${commande.numero} d'un montant de ${total.toLocaleString('fr-FR')} GNF est nettement `
      + `supérieure à vos achats habituels (moyenne récente : ${Math.round(average).toLocaleString('fr-FR')} GNF). `
      + 'Si vous n\'êtes pas à l\'origine de cette commande, contactez le support immédiatement.',
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

  /** Alerte "transaction refusée" — voir SecurityAlertsService. Résout le
   * User depuis Commande.clientId, qui référence Client.id (le profil, PAS
   * User.id — cf. Client { @PrimaryGeneratedColumn }, distinct de
   * Client.userId) : il faut donc repasser par Client.userId pour trouver
   * le bon destinataire, ne jamais utiliser clientId directement comme un
   * userId. */
  private async notifyPaymentDeclined(commandeId: string, raison: string): Promise<void> {
    const commande = await this.commandeRepo.findOne({ where: { id: commandeId }, select: ['id', 'clientId', 'numero', 'total'] });
    if (!commande) return;

    const client = await this.clientRepo.findOne({ where: { id: commande.clientId }, select: ['userId'] });
    if (!client) return;

    await this.securityAlertsService.notifyIfEnabled(
      client.userId, 'transaction',
      'Transaction refusée',
      `Le paiement de votre commande ${commande.numero} (${Number(commande.total).toLocaleString('fr-FR')} GNF) `
      + `a été refusé (${raison}). Si vous n'êtes pas à l'origine de cette tentative, sécurisez votre compte.`,
    );
  }
}

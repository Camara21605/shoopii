/* ============================================================
 * FICHIER : src/modules/payment-engine/services/payment-session-manager.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Gestion du cycle de vie des PaiementSessions.
 * Applique la machine à états PAYMENT_SESSION_TRANSITIONS
 * et centralise toutes les transitions de statut.
 * ============================================================ */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository }   from 'typeorm';

import {
  PaiementSession,
  PaiementSessionStatus,
} from '../../../database/entities/paiement/paiement-session.entity';

import {
  PAYMENT_SESSION_TRANSITIONS,
  PAYMENT_SESSION_FINAL_STATES,
  PaymentErreur,
  PaymentErreurType,
  PaymentSessionFilter,
  PaymentSessionPage,
} from '../types/payment-engine.types';

import { PaymentEventBus }        from '../events/payment-event-bus.service';
import { PAYMENT_EVENTS, PaymentExpiredEvent } from '../events/payment.events';

@Injectable()
export class PaymentSessionManagerService {

  private readonly logger = new Logger(PaymentSessionManagerService.name);

  constructor(
    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    private readonly eventBus: PaymentEventBus,
  ) {}

  /* ── Lecture ─────────────────────────────────────────────── */

  async findById(id: string): Promise<PaiementSession> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) {
      throw new PaymentErreur(
        PaymentErreurType.SESSION_INTROUVABLE,
        `Session de paiement introuvable : ${id}`,
        { sessionId: id },
      );
    }
    return session;
  }

  async findByIdempotencyKey(key: string): Promise<PaiementSession | null> {
    return this.sessionRepo.findOne({ where: { idempotencyKey: key } });
  }

  async findByCommandeId(commandeId: string): Promise<PaiementSession[]> {
    return this.sessionRepo.find({
      where: { commandeId },
      order: { createdAt: 'DESC' },
    });
  }

  async findConfirmedByCommandeId(commandeId: string): Promise<PaiementSession | null> {
    return this.sessionRepo.findOne({
      where: { commandeId, status: PaiementSessionStatus.CONFIRMED },
    });
  }

  /* ── Machine à états ─────────────────────────────────────── */

  /**
   * Valide et applique une transition de statut.
   * Lève PaymentErreur si la transition est invalide ou depuis un état final.
   */
  validerTransition(
    session: PaiementSession,
    versStatut: PaiementSessionStatus,
  ): void {
    if (PAYMENT_SESSION_FINAL_STATES.has(session.status)) {
      throw new PaymentErreur(
        PaymentErreurType.ETAT_FINAL_IRREVOCABLE,
        `La session ${session.id} est dans l'état final "${session.status}" — aucune transition possible`,
        { sessionId: session.id, currentStatus: session.status, requestedStatus: versStatut },
      );
    }

    const transitions = PAYMENT_SESSION_TRANSITIONS[session.status];
    if (!transitions.includes(versStatut)) {
      throw new PaymentErreur(
        PaymentErreurType.TRANSITION_INVALIDE,
        `Transition "${session.status}" → "${versStatut}" interdite`,
        { sessionId: session.id, from: session.status, to: versStatut, allowed: transitions },
      );
    }
  }

  /* ── Transitions ──────────────────────────────────────────── */

  async transitionner(
    session:       PaiementSession,
    versStatut:    PaiementSessionStatus,
    data?: Partial<Pick<PaiementSession,
      'providerTransactionId' | 'confirmedAt' | 'webhookPayloadRaw' | 'webhookReceivedAt' | 'echecRaison'
    >>,
  ): Promise<PaiementSession> {
    this.validerTransition(session, versStatut);

    const from = session.status;
    session.status = versStatut;
    if (data) Object.assign(session, data);

    const saved = await this.sessionRepo.save(session);
    this.logger.log(`[Session] ${session.id} : ${from} → ${versStatut}`);
    return saved;
  }

  /* ── Expirations (scheduler) ──────────────────────────────── */

  /**
   * Marque comme EXPIRED toutes les sessions INITIATED/PENDING
   * dont la date d'expiration est dépassée.
   */
  async expireSessionsExpirees(): Promise<number> {
    const maintenant = new Date();

    const sessions = await this.sessionRepo.find({
      where: {
        status: In([PaiementSessionStatus.INITIATED, PaiementSessionStatus.PENDING]),
      },
    });

    let count = 0;
    for (const s of sessions) {
      if (s.expiresAt && s.expiresAt <= maintenant) {
        s.status = PaiementSessionStatus.EXPIRED;
        await this.sessionRepo.save(s);

        this.eventBus.emit(
          PAYMENT_EVENTS.EXPIRED,
          new PaymentExpiredEvent(s.id, s.commandeId, s.provider, s.expiresAt),
        );
        count++;
      }
    }

    if (count > 0) {
      this.logger.log(`[Session] ${count} session(s) expirée(s)`);
    }

    return count;
  }

  /* ── Pagination / filtres ────────────────────────────────── */

  async lister(
    filter: PaymentSessionFilter,
    page  = 1,
    limit = 20,
  ): Promise<PaymentSessionPage> {
    const qb = this.sessionRepo.createQueryBuilder('s');

    if (filter.commandeId)  qb.andWhere('s.commandeId  = :cid', { cid:  filter.commandeId });
    if (filter.clientUserId) qb.andWhere('s.clientUserId = :uid', { uid: filter.clientUserId });
    if (filter.provider)    qb.andWhere('s.provider     = :prv', { prv:  filter.provider });
    if (filter.status)      qb.andWhere('s.status       = :st',  { st:   filter.status });
    if (filter.dateFrom)    qb.andWhere('s.createdAt   >= :df',  { df:   filter.dateFrom });
    if (filter.dateTo)      qb.andWhere('s.createdAt   <= :dt',  { dt:   filter.dateTo });

    qb.orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}

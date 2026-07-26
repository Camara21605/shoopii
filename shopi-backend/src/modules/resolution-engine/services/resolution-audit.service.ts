/* ============================================================
 * FICHIER : src/modules/resolution-engine/services/resolution-audit.service.ts
 *
 * RÔLE    : Audit financier fire-and-forget du Resolution Engine.
 *           Toutes les méthodes sont infaillibles (catch interne).
 *           Utilise setImmediate() pour ne jamais bloquer le flux.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import {
  FinancialAuditLog,
  FinancialAuditSeverity,
  FinancialEventType,
} from '../../../database/entities/paiement/financial-audit-log.entity';
import { DisputeStatus, DisputeDecision } from '../../../database/entities/paiement/dispute.entity';

@Injectable()
export class ResolutionAuditService {

  private readonly logger = new Logger(ResolutionAuditService.name);

  constructor(
    @InjectRepository(FinancialAuditLog)
    private readonly auditRepo: Repository<FinancialAuditLog>,
  ) {}

  /* ════════════════════════════════════════════════════════
   * OUVERTURE DE LITIGE
   ════════════════════════════════════════════════════════ */

  logOuverture(
    disputeId: string,
    commandeId: string,
    clientUserId: string,
    montantConteste: number,
  ): void {
    setImmediate(() => this._log({
      eventType:   FinancialEventType.DISPUTE_OPENED,
      severity:    FinancialAuditSeverity.HIGH,
      actorUserId: clientUserId,
      actorRole:   'client',
      entityType:  'dispute',
      entityId:    disputeId,
      commandeId,
      montant:     montantConteste,
      before:      null,
      after:       { status: DisputeStatus.OPEN },
      metadata:    { disputeId, commandeId, montantConteste },
    }));
  }

  /* ════════════════════════════════════════════════════════
   * TRANSITION DE STATUT
   ════════════════════════════════════════════════════════ */

  logTransition(
    disputeId: string,
    fromStatus: DisputeStatus,
    toStatus: DisputeStatus,
    actorUserId: string,
    actorRole: string,
  ): void {
    setImmediate(() => this._log({
      eventType:   FinancialEventType.DISPUTE_RESOLVED,
      severity:    FinancialAuditSeverity.NORMAL,
      actorUserId,
      actorRole,
      entityType:  'dispute',
      entityId:    disputeId,
      commandeId:  null,
      montant:     null,
      before:      { status: fromStatus },
      after:       { status: toStatus },
      metadata:    { fromStatus, toStatus },
    }));
  }

  /* ════════════════════════════════════════════════════════
   * DÉCISION RENDUE
   ════════════════════════════════════════════════════════ */

  logDecision(
    disputeId: string,
    commandeId: string,
    adminUserId: string,
    decision: DisputeDecision,
    montantRembourse: number | null,
  ): void {
    setImmediate(() => this._log({
      eventType:   FinancialEventType.DISPUTE_RESOLVED,
      severity:    FinancialAuditSeverity.CRITICAL,
      actorUserId: adminUserId,
      actorRole:   'admin',
      entityType:  'dispute',
      entityId:    disputeId,
      commandeId,
      montant:     montantRembourse,
      before:      { decision: null },
      after:       { decision, montantRembourse },
      metadata:    { decision, montantRembourse },
    }));
  }

  /* ════════════════════════════════════════════════════════
   * REMBOURSEMENT COMPLÉTÉ
   ════════════════════════════════════════════════════════ */

  logRemboursement(
    disputeId: string,
    commandeId: string,
    adminUserId: string,
    montantRembourse: number,
    providerRefundId?: string,
  ): void {
    setImmediate(() => this._log({
      eventType:   FinancialEventType.REFUND_CONFIRMED,
      severity:    FinancialAuditSeverity.CRITICAL,
      actorUserId: adminUserId,
      actorRole:   'admin',
      entityType:  'dispute',
      entityId:    disputeId,
      commandeId,
      montant:     montantRembourse,
      before:      { status: DisputeStatus.REFUND_PENDING },
      after:       { status: DisputeStatus.REFUNDED },
      metadata:    { disputeId, montantRembourse, providerRefundId },
    }));
  }

  /* ── Écriture interne silencieuse ─────────────────────── */
  private async _log(payload: {
    eventType:   FinancialEventType;
    severity:    FinancialAuditSeverity;
    actorUserId: string | null;
    actorRole:   string | null;
    entityType:  string | null;
    entityId:    string | null;
    commandeId:  string | null;
    montant:     number | null;
    before:      Record<string, unknown> | null;
    after:       Record<string, unknown> | null;
    metadata?:   Record<string, unknown>;
  }): Promise<void> {
    try {
      const entry = this.auditRepo.create({
        eventType:   payload.eventType,
        severity:    payload.severity,
        actorUserId: payload.actorUserId,
        actorRole:   payload.actorRole,
        entityType:  payload.entityType,
        entityId:    payload.entityId,
        commandeId:  payload.commandeId,
        montant:     payload.montant,
        walletId:    null,
        sessionId:   null,
        distributionId: null,
        devise:      'GNF',
        before:      payload.before,
        after:       payload.after,
        metadata:    payload.metadata ?? null,
        ipAddress:   null,
        userAgent:   null,
      });
      await this.auditRepo.save(entry);
    } catch (err) {
      this.logger.error(`[Audit] Erreur enregistrement :`, err);
    }
  }
}

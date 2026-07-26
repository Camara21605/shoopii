/* ============================================================
 * FICHIER : src/modules/escrow-engine/services/escrow-audit.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Journal d'audit fire-and-forget pour l'EscrowEngine.
 * Écrit dans FinancialAuditLog — ne lève JAMAIS d'exception.
 *
 * CHAMPS FinancialAuditLog utilisés :
 *   eventType, severity, actorUserId, actorRole,
 *   commandeId, walletId, montant, devise,
 *   entityType, entityId, before, after, metadata, ipAddress
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  FinancialAuditLog,
  FinancialEventType,
  FinancialAuditSeverity,
} from '../../../database/entities/paiement/financial-audit-log.entity';
import { EscrowStatus } from '../../../database/entities/paiement/escrow.entity';

@Injectable()
export class EscrowAuditService {

  private readonly logger = new Logger(EscrowAuditService.name);

  constructor(
    @InjectRepository(FinancialAuditLog)
    private readonly auditRepo: Repository<FinancialAuditLog>,
  ) {}

  /* ==========================================================
   * MÉTHODES D'AUDIT (fire-and-forget)
   * ========================================================== */

  logCreation(params: {
    escrowId: string;
    commandeId: string;
    montantTotal: number;
    currency: string;
    actorUserId?: string;
    ipAddress?: string;
  }): void {
    this.save({
      eventType:   FinancialEventType.ESCROW_LOCKED,
      severity:    FinancialAuditSeverity.NORMAL,
      entityType:  'escrow',
      entityId:    params.escrowId,
      commandeId:  params.commandeId,
      montant:     params.montantTotal,
      devise:      params.currency,
      actorUserId: params.actorUserId ?? null,
      actorRole:   'SYSTEM',
      ipAddress:   params.ipAddress ?? null,
      after:       { status: EscrowStatus.CREATED, montantTotal: params.montantTotal },
    });
  }

  logRelease(params: {
    escrowId: string;
    commandeId: string;
    montantDistribue: number;
    currency: string;
    nbActeurs: number;
    releaseReason: string;
    actorUserId?: string;
  }): void {
    this.save({
      eventType:   FinancialEventType.ESCROW_RELEASED,
      severity:    FinancialAuditSeverity.NORMAL,
      entityType:  'escrow',
      entityId:    params.escrowId,
      commandeId:  params.commandeId,
      montant:     params.montantDistribue,
      devise:      params.currency,
      actorUserId: params.actorUserId ?? null,
      actorRole:   params.actorUserId ? 'CLIENT' : 'SYSTEM',
      after:       { status: EscrowStatus.RELEASED },
      metadata:    { releaseReason: params.releaseReason, nbActeurs: params.nbActeurs },
    });
  }

  logRefund(params: {
    escrowId: string;
    commandeId: string;
    montantRembourse: number;
    currency: string;
    raison: string;
    walletTransactionId: string;
    actorUserId?: string;
  }): void {
    this.save({
      eventType:   FinancialEventType.REFUND_INITIATED,
      severity:    FinancialAuditSeverity.HIGH,
      entityType:  'escrow',
      entityId:    params.escrowId,
      commandeId:  params.commandeId,
      montant:     params.montantRembourse,
      devise:      params.currency,
      actorUserId: params.actorUserId ?? null,
      actorRole:   'SYSTEM',
      after:       { status: EscrowStatus.REFUNDED },
      metadata:    { walletTransactionId: params.walletTransactionId, raison: params.raison },
    });
  }

  logTransition(params: {
    escrowId: string;
    commandeId: string;
    fromStatus: EscrowStatus | null;
    toStatus: EscrowStatus;
    actorUserId?: string;
    note?: string;
  }): void {
    this.save({
      eventType:   FinancialEventType.ESCROW_LOCKED,
      severity:    FinancialAuditSeverity.NORMAL,
      entityType:  'escrow',
      entityId:    params.escrowId,
      commandeId:  params.commandeId,
      actorUserId: params.actorUserId ?? null,
      actorRole:   params.actorUserId ? 'USER' : 'SYSTEM',
      before:      { status: params.fromStatus },
      after:       { status: params.toStatus },
      metadata:    { note: params.note ?? null },
    });
  }

  logErreur(params: {
    escrowId: string;
    commandeId: string;
    erreur: string;
    context?: Record<string, unknown>;
  }): void {
    this.save({
      eventType:   FinancialEventType.PAYMENT_FAILED,
      severity:    FinancialAuditSeverity.CRITICAL,
      entityType:  'escrow',
      entityId:    params.escrowId,
      commandeId:  params.commandeId,
      actorRole:   'SYSTEM',
      metadata:    { erreur: params.erreur, ...params.context },
    });
  }

  /* ==========================================================
   * SAVE FIRE-AND-FORGET (jamais bloquant)
   * ========================================================== */

  private save(data: {
    eventType:    FinancialEventType;
    severity?:    FinancialAuditSeverity;
    entityType?:  string;
    entityId?:    string;
    commandeId?:  string;
    walletId?:    string;
    montant?:     number;
    devise?:      string;
    actorUserId?: string | null;
    actorRole?:   string;
    ipAddress?:   string | null;
    before?:      Record<string, unknown>;
    after?:       Record<string, unknown>;
    metadata?:    Record<string, unknown>;
  }): void {
    setImmediate(async () => {
      try {
        const entry = this.auditRepo.create({
          eventType:   data.eventType,
          severity:    data.severity ?? FinancialAuditSeverity.NORMAL,
          entityType:  data.entityType ?? 'escrow',
          entityId:    data.entityId ?? null,
          commandeId:  data.commandeId ?? null,
          walletId:    data.walletId ?? null,
          montant:     data.montant ?? null,
          devise:      data.devise ?? 'GNF',
          actorUserId: data.actorUserId ?? null,
          actorRole:   data.actorRole ?? 'SYSTEM',
          ipAddress:   data.ipAddress ?? null,
          before:      data.before ?? null,
          after:       data.after ?? null,
          metadata:    data.metadata ?? null,
        });
        await this.auditRepo.save(entry);
      } catch (err) {
        this.logger.error(`[EscrowAudit] Échec silencieux : ${(err as Error).message}`);
      }
    });
  }
}

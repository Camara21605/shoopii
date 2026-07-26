/* ============================================================
 * FICHIER : src/modules/wallet-engine/services/wallet-audit.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Journal d'audit financier pour le Wallet Engine.
 * Écrit dans FinancialAuditLog — table immuable.
 *
 * PRINCIPE
 * ------------------------------------------------------------
 * - Fire-and-forget : ne lève jamais d'exception
 * - Indépendant de la transaction principale (pas de QueryRunner)
 * - Logs toujours, même en cas d'erreur partielle
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  FinancialAuditLog,
  FinancialEventType,
  FinancialAuditSeverity,
} from '../../../database/entities/paiement/financial-audit-log.entity';
import { WalletOperationType } from '../types/wallet-engine.types';

@Injectable()
export class WalletAuditService {

  private readonly logger = new Logger(WalletAuditService.name);

  constructor(
    @InjectRepository(FinancialAuditLog)
    private readonly auditRepo: Repository<FinancialAuditLog>,
  ) {}

  /* ==========================================================
   * OPÉRATION RÉUSSIE
   * ========================================================== */

  logOperationReussie(params: {
    walletId: string;
    operationType: WalletOperationType;
    transactionId: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    actorUserId?: string | null;
    actorRole?: string | null;
    ipAddress?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): void {
    const eventType = this.resolveEventType(params.operationType);
    const severity  = this.resolveSeverite(params.operationType);

    this.save({
      eventType,
      severity,
      walletId:    params.walletId,
      actorUserId: params.actorUserId ?? null,
      actorRole:   params.actorRole   ?? null,
      ipAddress:   params.ipAddress   ?? null,
      montant:     params.amount,
      entityType: 'WalletTransaction',
      entityId:    params.transactionId,
      before: { balance: params.balanceBefore },
      after:  { balance: params.balanceAfter  },
      metadata: {
        ...params.metadata,
        operationType:  params.operationType,
        transactionId:  params.transactionId,
        referenceType:  params.referenceType,
        referenceId:    params.referenceId,
      },
    });
  }

  /* ==========================================================
   * OPÉRATION ÉCHOUÉE
   * ========================================================== */

  logOperationEchouee(params: {
    walletId: string;
    operationType: WalletOperationType;
    erreurType: string;
    erreurMessage: string;
    actorUserId?: string | null;
    actorRole?: string | null;
    ipAddress?: string | null;
    metadata?: Record<string, unknown> | null;
  }): void {
    this.save({
      eventType: FinancialEventType.PAYMENT_FAILED,
      severity:  FinancialAuditSeverity.HIGH,
      walletId:  params.walletId,
      actorUserId: params.actorUserId ?? null,
      actorRole:   params.actorRole   ?? null,
      ipAddress:   params.ipAddress   ?? null,
      montant:     null,
      entityType: 'Wallet',
      entityId:    params.walletId,
      before:  null,
      after:   null,
      metadata: {
        ...params.metadata,
        operationType: params.operationType,
        erreurType:    params.erreurType,
        erreurMessage: params.erreurMessage,
      },
    });
  }

  /* ==========================================================
   * GEL / DÉGEL WALLET
   * ========================================================== */

  logGelWallet(params: {
    walletId: string;
    motif: string;
    actorUserId: string;
    actorRole: string;
    ipAddress?: string | null;
  }): void {
    this.save({
      eventType: FinancialEventType.WALLET_FROZEN,
      severity:  FinancialAuditSeverity.HIGH,
      walletId:  params.walletId,
      actorUserId: params.actorUserId,
      actorRole:   params.actorRole,
      ipAddress:   params.ipAddress ?? null,
      montant:     null,
      entityType: 'Wallet',
      entityId:    params.walletId,
      before:  null,
      after:   null,
      metadata: { motif: params.motif },
    });
  }

  logDegelWallet(params: {
    walletId: string;
    actorUserId: string;
    actorRole: string;
    ipAddress?: string | null;
  }): void {
    this.save({
      eventType: FinancialEventType.WALLET_UNFROZEN,
      severity:  FinancialAuditSeverity.NORMAL,
      walletId:  params.walletId,
      actorUserId: params.actorUserId,
      actorRole:   params.actorRole,
      ipAddress:   params.ipAddress ?? null,
      montant:     null,
      entityType: 'Wallet',
      entityId:    params.walletId,
      before:  null,
      after:   null,
      metadata: null,
    });
  }

  /* ==========================================================
   * DOUBLON IDEMPOTENCY
   * ========================================================== */

  logDoublonIdempotency(params: {
    walletId: string;
    idempotencyKey: string;
    operationType: WalletOperationType;
    actorUserId?: string | null;
    ipAddress?: string | null;
  }): void {
    this.save({
      eventType: FinancialEventType.DOUBLE_PAYMENT_BLOCKED,
      severity:  FinancialAuditSeverity.HIGH,
      walletId:  params.walletId,
      actorUserId: params.actorUserId ?? null,
      actorRole:   null,
      ipAddress:   params.ipAddress   ?? null,
      montant:     null,
      entityType: 'Wallet',
      entityId:    params.walletId,
      before:  null,
      after:   null,
      metadata: {
        idempotencyKey: params.idempotencyKey,
        operationType:  params.operationType,
      },
    });
  }

  /* ==========================================================
   * HELPERS PRIVÉS
   * ========================================================== */

  private resolveEventType(op: WalletOperationType): FinancialEventType {
    switch (op) {
      case WalletOperationType.ESCROW_CREDIT:      return FinancialEventType.ESCROW_LOCKED;
      case WalletOperationType.ESCROW_RELEASE:     return FinancialEventType.ESCROW_RELEASED;
      case WalletOperationType.ESCROW_CANCEL:      return FinancialEventType.ESCROW_CANCELLED;
      case WalletOperationType.WITHDRAWAL_INIT:    return FinancialEventType.WITHDRAWAL_REQUESTED;
      case WalletOperationType.WITHDRAWAL_CONFIRM: return FinancialEventType.WITHDRAWAL_COMPLETED;
      case WalletOperationType.WITHDRAWAL_FAIL:    return FinancialEventType.WITHDRAWAL_FAILED;
      case WalletOperationType.REFUND:             return FinancialEventType.REFUND_INITIATED;
      case WalletOperationType.BLOCK:              return FinancialEventType.WALLET_FROZEN;
      case WalletOperationType.UNBLOCK:            return FinancialEventType.WALLET_UNFROZEN;
      default:                                      return FinancialEventType.PAYMENT_CONFIRMED;
    }
  }

  private resolveSeverite(op: WalletOperationType): FinancialAuditSeverity {
    switch (op) {
      case WalletOperationType.ADJUSTMENT:
      case WalletOperationType.CORRECTION:
      case WalletOperationType.BLOCK:
        return FinancialAuditSeverity.HIGH;

      case WalletOperationType.WITHDRAWAL_INIT:
      case WalletOperationType.WITHDRAWAL_CONFIRM:
      case WalletOperationType.WITHDRAWAL_FAIL:
        return FinancialAuditSeverity.HIGH;

      default:
        return FinancialAuditSeverity.NORMAL;
    }
  }

  private save(data: {
    eventType: FinancialEventType;
    severity: FinancialAuditSeverity;
    walletId: string;
    actorUserId: string | null;
    actorRole: string | null;
    ipAddress: string | null;
    montant: number | null;
    entityType: string;
    entityId: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }): void {
    this.auditRepo
      .save(
        this.auditRepo.create({
          eventType:  data.eventType,
          severity:   data.severity,
          walletId:   data.walletId,
          actorUserId:data.actorUserId,
          actorRole:  data.actorRole,
          ipAddress:  data.ipAddress,
          montant:    data.montant,
          devise:     'GNF',
          entityType: data.entityType,
          entityId:   data.entityId,
          before:     data.before,
          after:      data.after,
          metadata:   data.metadata,
          commandeId:     null,
          sessionId:      null,
          distributionId: null,
          userAgent:      null,
        }),
      )
      .catch((err) => {
        this.logger.error(
          `[WalletAudit] Échec enregistrement audit : ${err?.message ?? String(err)}`,
        );
      });
  }
}

/* ============================================================
 * FICHIER : src/modules/settlement-engine/services/settlement-audit.service.ts
 *
 * RÔLE    : Écrit les entrées FinancialAuditLog pour chaque
 *           événement du Settlement Engine.
 *           Fire-and-forget via setImmediate — ne lève jamais.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  FinancialAuditLog,
  FinancialEventType,
  FinancialAuditSeverity,
} from '../../../database/entities/paiement/financial-audit-log.entity';

@Injectable()
export class SettlementAuditService {

  private readonly logger = new Logger(SettlementAuditService.name);

  constructor(
    @InjectRepository(FinancialAuditLog)
    private readonly auditRepo: Repository<FinancialAuditLog>,
  ) {}

  logWithdrawalRequested(params: {
    retraitId: string;
    walletId: string;
    userId: string;
    montant: number;
    methode: string;
    ipAddress?: string | null;
  }): void {
    this._log({
      eventType:  FinancialEventType.WITHDRAWAL_REQUESTED,
      severity:   FinancialAuditSeverity.NORMAL,
      walletId:   params.walletId,
      actorUserId: params.userId,
      metadata:   { retraitId: params.retraitId, montant: params.montant, methode: params.methode },
      ipAddress:  params.ipAddress ?? null,
    });
  }

  logWithdrawalProcessing(params: {
    retraitId: string;
    walletId: string;
    userId: string;
    montant: number;
    attempt: number;
  }): void {
    this._log({
      eventType:  FinancialEventType.WITHDRAWAL_PROCESSING,
      severity:   FinancialAuditSeverity.NORMAL,
      walletId:   params.walletId,
      actorUserId: params.userId,
      metadata:   { retraitId: params.retraitId, montant: params.montant, attempt: params.attempt },
    });
  }

  logWithdrawalCompleted(params: {
    retraitId: string;
    walletId: string;
    userId: string;
    montant: number;
    providerReference: string;
  }): void {
    this._log({
      eventType:  FinancialEventType.WITHDRAWAL_COMPLETED,
      severity:   FinancialAuditSeverity.NORMAL,
      walletId:   params.walletId,
      actorUserId: params.userId,
      metadata:   {
        retraitId:         params.retraitId,
        montant:           params.montant,
        providerReference: params.providerReference,
      },
    });
  }

  logWithdrawalFailed(params: {
    retraitId: string;
    walletId: string;
    userId: string;
    montant: number;
    raison: string;
    attempt: number;
    definitive: boolean;
  }): void {
    this._log({
      eventType:  FinancialEventType.WITHDRAWAL_FAILED,
      severity:   params.definitive ? FinancialAuditSeverity.HIGH : FinancialAuditSeverity.NORMAL,
      walletId:   params.walletId,
      actorUserId: params.userId,
      metadata:   {
        retraitId:  params.retraitId,
        montant:    params.montant,
        raison:     params.raison,
        attempt:    params.attempt,
        definitive: params.definitive,
      },
    });
  }

  logEligibiliteRefusee(params: {
    walletId: string;
    userId: string;
    montant: number;
    raison: string;
    ipAddress?: string | null;
  }): void {
    this._log({
      eventType:  FinancialEventType.WITHDRAWAL_FAILED,
      severity:   FinancialAuditSeverity.HIGH,
      walletId:   params.walletId,
      actorUserId: params.userId,
      metadata:   { montant: params.montant, raison: params.raison, phase: 'eligibility' },
      ipAddress:  params.ipAddress ?? null,
    });
  }

  private _log(payload: {
    eventType: FinancialEventType;
    severity: FinancialAuditSeverity;
    walletId?: string | null;
    actorUserId?: string | null;
    commandeId?: string | null;
    ipAddress?: string | null;
    metadata?: Record<string, unknown> | null;
  }): void {
    setImmediate(async () => {
      try {
        const entry = this.auditRepo.create({
          eventType:  payload.eventType,
          severity:   payload.severity,
          walletId:   payload.walletId   ?? null,
          actorUserId: payload.actorUserId ?? null,
          commandeId: payload.commandeId  ?? null,
          ipAddress:  payload.ipAddress   ?? null,
          metadata:   payload.metadata    ?? null,
        });
        await this.auditRepo.save(entry);
      } catch (err) {
        this.logger.error(`[SettlementAudit] Échec log audit : ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }
}

/* ============================================================
 * FICHIER : src/modules/payment-engine/services/payment-audit.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Journal d'audit financier dédié aux événements de paiement.
 * Fire-and-forget via setImmediate() — ne bloque jamais.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import {
  FinancialAuditLog,
  FinancialEventType,
  FinancialAuditSeverity,
} from '../../../database/entities/paiement/financial-audit-log.entity';

@Injectable()
export class PaymentAuditService {

  private readonly logger = new Logger(PaymentAuditService.name);

  constructor(
    @InjectRepository(FinancialAuditLog)
    private readonly auditRepo: Repository<FinancialAuditLog>,
  ) {}

  /* ── Helpers privés ──────────────────────────────────────── */

  private save(
    eventType: FinancialEventType,
    severity:  FinancialAuditSeverity,
    data: {
      actorUserId?:  string | null;
      actorRole?:    string | null;
      entityType?:   string;
      entityId?:     string;
      commandeId?:   string;
      sessionId?:    string;
      walletId?:     string;
      montant?:      number;
      devise?:       string;
      before?:       Record<string, unknown>;
      after?:        Record<string, unknown>;
      metadata?:     Record<string, unknown>;
    },
  ): void {
    setImmediate(async () => {
      try {
        const entry = this.auditRepo.create({
          eventType,
          severity,
          actorUserId:  data.actorUserId  ?? null,
          actorRole:    data.actorRole    ?? 'system',
          entityType:   data.entityType   ?? 'payment_session',
          entityId:     data.entityId     ?? data.sessionId ?? null,
          commandeId:   data.commandeId   ?? null,
          sessionId:    data.sessionId    ?? null,
          walletId:     data.walletId     ?? null,
          montant:      data.montant      ?? null,
          devise:       data.devise       ?? 'GNF',
          before:       data.before       ?? null,
          after:        data.after        ?? null,
          metadata:     data.metadata     ?? null,
        });
        await this.auditRepo.save(entry);
      } catch (err) {
        this.logger.error('[Audit] Erreur enregistrement audit:', err);
      }
    });
  }

  /* ── Points d'entrée ─────────────────────────────────────── */

  logPaiementInitie(data: {
    sessionId:    string;
    commandeId:   string;
    clientUserId: string;
    montant:      number;
    provider:     string;
  }): void {
    this.save(FinancialEventType.PAYMENT_INITIATED, FinancialAuditSeverity.NORMAL, {
      actorUserId: data.clientUserId,
      actorRole:   'client',
      entityType:  'payment_session',
      entityId:    data.sessionId,
      commandeId:  data.commandeId,
      sessionId:   data.sessionId,
      montant:     data.montant,
      metadata:    { provider: data.provider },
    });
  }

  logPaiementConfirme(data: {
    sessionId:             string;
    commandeId:            string;
    clientUserId:          string;
    montantConfirme:       number;
    provider:              string;
    providerTransactionId: string;
    escrowId:              string;
  }): void {
    this.save(FinancialEventType.PAYMENT_CONFIRMED, FinancialAuditSeverity.HIGH, {
      actorUserId: data.clientUserId,
      actorRole:   'client',
      entityType:  'payment_session',
      entityId:    data.sessionId,
      commandeId:  data.commandeId,
      sessionId:   data.sessionId,
      montant:     data.montantConfirme,
      metadata:    {
        provider:             data.provider,
        providerTransactionId: data.providerTransactionId,
        escrowId:             data.escrowId,
      },
    });
  }

  logPaiementEchoue(data: {
    sessionId:  string;
    commandeId: string;
    provider:   string;
    raison:     string;
  }): void {
    this.save(FinancialEventType.PAYMENT_FAILED, FinancialAuditSeverity.NORMAL, {
      entityType: 'payment_session',
      entityId:   data.sessionId,
      commandeId: data.commandeId,
      sessionId:  data.sessionId,
      metadata:   { provider: data.provider, raison: data.raison },
    });
  }

  logSignatureInvalide(data: {
    provider:  string;
    eventId?:  string;
    sourceIp?: string;
  }): void {
    this.save(FinancialEventType.WEBHOOK_SIGNATURE_INVALID, FinancialAuditSeverity.CRITICAL, {
      entityType: 'webhook',
      metadata:   { provider: data.provider, eventId: data.eventId, sourceIp: data.sourceIp },
    });
  }

  logRemboursementInitie(data: {
    sessionId:    string;
    commandeId:   string;
    montant:      number;
    adminUserId?: string;
    raison?:      string;
  }): void {
    this.save(FinancialEventType.REFUND_INITIATED, FinancialAuditSeverity.HIGH, {
      actorUserId: data.adminUserId,
      actorRole:   data.adminUserId ? 'admin' : 'system',
      entityType:  'payment_session',
      entityId:    data.sessionId,
      commandeId:  data.commandeId,
      sessionId:   data.sessionId,
      montant:     data.montant,
      metadata:    { raison: data.raison },
    });
  }

  logRemboursementConfirme(data: {
    sessionId:        string;
    commandeId:       string;
    montantRembourse: number;
    providerRefundId?: string;
  }): void {
    this.save(FinancialEventType.REFUND_CONFIRMED, FinancialAuditSeverity.HIGH, {
      entityType: 'payment_session',
      entityId:   data.sessionId,
      commandeId: data.commandeId,
      sessionId:  data.sessionId,
      montant:    data.montantRembourse,
      metadata:   { providerRefundId: data.providerRefundId },
    });
  }

  logMontantIncorrect(data: {
    sessionId:       string;
    montantAttendu:  number;
    montantRecu:     number;
    provider:        string;
  }): void {
    this.save(FinancialEventType.AMOUNT_MISMATCH_DETECTED, FinancialAuditSeverity.CRITICAL, {
      entityType: 'payment_session',
      entityId:   data.sessionId,
      sessionId:  data.sessionId,
      metadata:   {
        montantAttendu: data.montantAttendu,
        montantRecu:    data.montantRecu,
        provider:       data.provider,
      },
    });
  }
}

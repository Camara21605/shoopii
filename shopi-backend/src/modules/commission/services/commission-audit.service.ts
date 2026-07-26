/* ============================================================
 * FICHIER : src/modules/commission/services/commission-audit.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Écrit des entrées d'audit dans financial_audit_logs pour chaque
 * étape significative du moteur de commissions.
 *
 * CAS TRACÉS
 * ─────────────────────────────────────────────────────────────
 *  - Calcul de commission réussi   → PAYMENT_CONFIRMED (NORMAL)
 *  - Erreur de calcul              → correspondant eventType (HIGH/CRITICAL)
 *  - Changement de CommissionRule  → COMMISSION_RULE_CHANGED (HIGH)
 *  - Partenaire/Admin absent       → loggué en WARNING (NORMAL)
 *
 * GARANTIE
 * ─────────────────────────────────────────────────────────────
 *  Les appels à ce service ne doivent PAS bloquer la transaction
 *  principale. Ils s'exécutent de manière fire-and-forget dans
 *  CommissionEngine.calculer() via .catch(logger.error).
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *  Repository<FinancialAuditLog>
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import {
  FinancialAuditLog,
  FinancialEventType,
  FinancialAuditSeverity,
} from '../../../database/entities/paiement/financial-audit-log.entity';

import {
  CommissionContext,
  CommissionResult,
  CommissionErreur,
  CommissionErreurType,
} from '../types/commission.types';

@Injectable()
export class CommissionAuditService {

  private readonly logger = new Logger(CommissionAuditService.name);

  constructor(
    @InjectRepository(FinancialAuditLog)
    private readonly auditRepo: Repository<FinancialAuditLog>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * logCalculReussi() — calcul de commission OK
   * ────────────────────────────────────────────────────────── */

  /**
   * Trace un calcul de commission réussi.
   * Appelé juste après CommissionCalculatorService.calculer().
   */
  async logCalculReussi(
    context: CommissionContext,
    result:  CommissionResult,
  ): Promise<void> {
    await this.ecrire({
      eventType:  FinancialEventType.PAYMENT_CONFIRMED,
      severity:   FinancialAuditSeverity.NORMAL,
      actorUserId: null,
      actorRole:  'system',
      commandeId: context.commandeId,
      montant:    result.totalDistribue,
      entityType: 'CommissionResult',
      entityId:   result.rule?.id ?? null,
      metadata: {
        commandeNumero:         context.commandeNumero,
        ruleId:                 result.rule?.id ?? null,
        ruleVersion:            result.rule?.version ?? null,
        tauxEffectifProduit:    result.tauxEffectifProduit,
        tauxEffectifLivraison:  result.tauxEffectifLivraison,
        commissionProduitBrute: result.commissionProduitBrute,
        commissionLivBrute:     result.commissionLivraisonBrute,
        totalDistribue:         result.totalDistribue,
        nbParts:                result.parts.length,
        parts: result.parts.map(p => ({
          type:    p.acteurType,
          userId:  p.acteurUserId,
          montant: p.montant,
        })),
      },
    });
  }

  /* ──────────────────────────────────────────────────────────
   * logErreur() — calcul échoué
   * ────────────────────────────────────────────────────────── */

  /**
   * Trace une erreur dans le moteur de commissions.
   * La sévérité est ajustée selon le type d'erreur.
   */
  async logErreur(
    context: CommissionContext,
    erreur:  CommissionErreur | Error,
  ): Promise<void> {
    const isCommissionErreur = erreur instanceof CommissionErreur;
    const severity = this.resolveSeverite(
      isCommissionErreur ? erreur.type : null,
    );

    await this.ecrire({
      eventType:  FinancialEventType.DOUBLE_PAYMENT_BLOCKED,
      severity,
      actorUserId: null,
      actorRole:  'system',
      commandeId: context.commandeId,
      montant:    null,
      entityType: 'CommissionError',
      entityId:   null,
      metadata: {
        commandeNumero: context.commandeNumero,
        erreurType:     isCommissionErreur ? CommissionErreurType[erreur.type] : 'INCONNU',
        message:        erreur.message,
        context:        isCommissionErreur ? erreur.context : undefined,
      },
    });
  }

  /* ──────────────────────────────────────────────────────────
   * logChangementRegle() — nouvelle CommissionRule activée
   * ────────────────────────────────────────────────────────── */

  /**
   * Trace la création d'une nouvelle CommissionRule.
   * Appelé par CommissionConfigService.createOrUpdateRule().
   *
   * @param changedByUserId Super Admin ayant modifié les taux
   * @param newRuleId UUID de la nouvelle CommissionRule
   * @param previousRuleId UUID de l'ancienne règle (si existante)
   * @param details Champs modifiés (before/after)
   */
  async logChangementRegle(
    changedByUserId: string,
    newRuleId:       string,
    previousRuleId:  string | null,
    details:         Record<string, unknown>,
  ): Promise<void> {
    await this.ecrire({
      eventType:  FinancialEventType.COMMISSION_RULE_CHANGED,
      severity:   FinancialAuditSeverity.HIGH,
      actorUserId: changedByUserId,
      actorRole:  'super_admin',
      commandeId: null,
      montant:    null,
      entityType: 'CommissionRule',
      entityId:   newRuleId,
      metadata: {
        previousRuleId,
        ...details,
      },
    });
  }

  /* ──────────────────────────────────────────────────────────
   * Privé : ecrire()
   * ────────────────────────────────────────────────────────── */

  /**
   * Insère une ligne dans financial_audit_logs.
   * Ne throw jamais : les erreurs d'audit ne doivent pas bloquer.
   */
  private async ecrire(data: Partial<FinancialAuditLog>): Promise<void> {
    try {
      const entry = this.auditRepo.create(data);
      await this.auditRepo.save(entry);
    } catch (err) {
      /* L'audit ne doit jamais bloquer le flux principal */
      this.logger.error('[Audit] Impossible d\'écrire dans financial_audit_logs:', err);
    }
  }

  /* ──────────────────────────────────────────────────────────
   * Privé : resolveSeverite()
   * ────────────────────────────────────────────────────────── */

  private resolveSeverite(
    erreurType: CommissionErreurType | null,
  ): FinancialAuditSeverity {
    if (erreurType === null) return FinancialAuditSeverity.HIGH;

    switch (erreurType) {
      case CommissionErreurType.DOUBLON_CALCUL:
        return FinancialAuditSeverity.HIGH;
      case CommissionErreurType.RATIOS_INVALIDES:
      case CommissionErreurType.MONTANT_INCOHERENT:
        return FinancialAuditSeverity.CRITICAL;
      case CommissionErreurType.REGLE_ABSENTE:
      case CommissionErreurType.REGLE_DESACTIVEE:
        return FinancialAuditSeverity.CRITICAL;
      case CommissionErreurType.PARTENAIRE_ABSENT:
      case CommissionErreurType.ADMIN_ABSENT:
        return FinancialAuditSeverity.NORMAL;
      default:
        return FinancialAuditSeverity.HIGH;
    }
  }
}

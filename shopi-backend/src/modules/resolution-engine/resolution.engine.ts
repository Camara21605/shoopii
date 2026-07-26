/* ============================================================
 * FICHIER : src/modules/resolution-engine/resolution.engine.ts
 *
 * RÔLE    : Point d'entrée unique du Resolution Engine.
 *           Orchestre les 6 services spécialisés.
 *           Exporté et utilisé par les modules métier.
 *
 * SÉPARATION DES RESPONSABILITÉS
 * ─────────────────────────────────────────────────────────────
 *   DisputeManagerService  → cycle de vie du litige
 *   EvidenceManagerService → preuves
 *   DecisionManagerService → décision + EscrowEngine
 *   RefundManagerService   → remboursement provider-side
 *   ResolutionHistoryService → journal immuable
 *   ResolutionAuditService → audit financier fire-and-forget
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { Dispute }          from '../../database/entities/paiement/dispute.entity';
import { DisputeEvidence }  from '../../database/entities/paiement/dispute-evidence.entity';
import { DisputeHistory }   from '../../database/entities/paiement/dispute-history.entity';

import { DisputeManagerService }     from './services/dispute-manager.service';
import { EvidenceManagerService }    from './services/evidence-manager.service';
import { DecisionManagerService }    from './services/decision-manager.service';
import { RefundManagerService }      from './services/refund-manager.service';
import { ResolutionHistoryService }  from './services/resolution-history.service';
import { ResolutionAuditService }    from './services/resolution-audit.service';

import {
  OuvertureDisputeContext, PriseEnChargeContext,
  DemandePreuvesContext, PassageDecisionContext,
  EvidenceSubmissionContext, EvidenceValidationContext,
  DecisionContext, RemboursementContext,
  FermetureContext, EscaladeContext,
  DisputeOuvertureResult, DisputeEvidenceResult,
  DisputeDecisionResult, DisputeRemboursementResult,
  DisputeListFilter,
} from './types/resolution-engine.types';

@Injectable()
export class ResolutionEngine {

  constructor(
    private readonly disputeManager:     DisputeManagerService,
    private readonly evidenceManager:    EvidenceManagerService,
    private readonly decisionManager:    DecisionManagerService,
    private readonly refundManager:      RefundManagerService,
    private readonly historyService:     ResolutionHistoryService,
    private readonly auditService:       ResolutionAuditService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * LITIGES — CYCLE DE VIE
   ════════════════════════════════════════════════════════ */

  /** Ouvre un litige (client) après vérification fenêtre + unicité. */
  ouvrirDispute(ctx: OuvertureDisputeContext): Promise<DisputeOuvertureResult> {
    return this.disputeManager.ouvrir(ctx);
  }

  /** Admin prend en charge le litige (OPEN → UNDER_REVIEW). */
  prendreEnCharge(ctx: PriseEnChargeContext): Promise<Dispute> {
    return this.disputeManager.prendreEnCharge(ctx);
  }

  /** Admin demande des preuves supplémentaires (→ WAITING_FOR_EVIDENCE). */
  demanderPreuves(ctx: DemandePreuvesContext): Promise<Dispute> {
    return this.disputeManager.demanderPreuves(ctx);
  }

  /** Admin fait passer le litige en décision (→ DECISION_PENDING). */
  passerEnDecision(ctx: PassageDecisionContext): Promise<Dispute> {
    return this.disputeManager.passerEnDecision(ctx);
  }

  /** Admin escalade vers un super admin. */
  escalader(ctx: EscaladeContext): Promise<Dispute> {
    return this.disputeManager.escalader(ctx);
  }

  /** Fermeture forcée d'un litige (admin / système). */
  fermerDispute(ctx: FermetureContext): Promise<Dispute> {
    return this.disputeManager.fermer(ctx);
  }

  /* ════════════════════════════════════════════════════════
   * PREUVES
   ════════════════════════════════════════════════════════ */

  /** Soumettre une pièce justificative. */
  soumettrePreuve(ctx: EvidenceSubmissionContext): Promise<DisputeEvidenceResult> {
    return this.evidenceManager.soumettre(ctx);
  }

  /** Admin valide une preuve. */
  validerPreuve(ctx: EvidenceValidationContext): Promise<DisputeEvidence> {
    return this.evidenceManager.valider(ctx);
  }

  /** Lister les preuves d'un litige. */
  listerPreuves(disputeId: string): Promise<DisputeEvidence[]> {
    return this.evidenceManager.listerParDispute(disputeId);
  }

  /* ════════════════════════════════════════════════════════
   * DÉCISION
   ════════════════════════════════════════════════════════ */

  /**
   * Rend la décision finale et déclenche EscrowEngine.resoudreLitige().
   * Transition automatique : DECISION_PENDING → APPROVED/REJECTED → état suivant.
   */
  rendreDecision(ctx: DecisionContext): Promise<DisputeDecisionResult> {
    return this.decisionManager.rendreDecision(ctx);
  }

  /* ════════════════════════════════════════════════════════
   * REMBOURSEMENT
   ════════════════════════════════════════════════════════ */

  /**
   * Traite le remboursement provider-side (REFUND_PENDING → CLOSED).
   * EscrowEngine a déjà été appelé par rendreDecision().
   */
  traiterRemboursement(ctx: RemboursementContext): Promise<DisputeRemboursementResult> {
    return this.refundManager.traiterRemboursement(ctx);
  }

  /* ════════════════════════════════════════════════════════
   * CONSULTATION
   ════════════════════════════════════════════════════════ */

  getDispute(id: string): Promise<Dispute> {
    return this.disputeManager.findById(id);
  }

  listerDisputes(filter: DisputeListFilter): Promise<{ data: Dispute[]; total: number }> {
    return this.disputeManager.lister(filter);
  }

  getHistorique(disputeId: string): Promise<DisputeHistory[]> {
    return this.historyService.getHistorique(disputeId);
  }
}

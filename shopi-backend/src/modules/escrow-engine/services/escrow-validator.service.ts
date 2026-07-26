/* ============================================================
 * FICHIER : src/modules/escrow-engine/services/escrow-validator.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Validation pure (aucun accès DB).
 * Toutes les méthodes lèvent EscrowErreur si la règle est violée.
 *
 * RESPONSABILITÉS
 * ------------------------------------------------------------
 * 1. Valider les transitions d'état (machine à états)
 * 2. Valider les montants (positifs, cohérents)
 * 3. Valider l'autorisation d'action selon le rôle
 * 4. Bloquer les états finaux irrévocables
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { Escrow, EscrowStatus } from '../../../database/entities/paiement/escrow.entity';
import {
  EscrowErreur,
  EscrowErreurType,
  ESCROW_TRANSITIONS,
  ESCROW_ETATS_FINAUX,
  EscrowRefundContext,
} from '../types/escrow-engine.types';

@Injectable()
export class EscrowValidatorService {

  /* ==========================================================
   * TRANSITIONS D'ÉTAT
   * ========================================================== */

  /**
   * Vérifie qu'une transition vers `toStatus` est autorisée
   * depuis l'état courant de l'escrow.
   *
   * Lève EscrowErreur si la transition est illégale.
   */
  validerTransition(escrow: Escrow, toStatus: EscrowStatus): void {
    if (ESCROW_ETATS_FINAUX.has(escrow.status)) {
      throw new EscrowErreur(
        EscrowErreurType.ETAT_FINAL_IRREVOCABLE,
        `L'escrow ${escrow.id} est en état final "${escrow.status}" — aucune transition possible.`,
        { escrowId: escrow.id, currentStatus: escrow.status, toStatus },
      );
    }

    const autorisees = ESCROW_TRANSITIONS[escrow.status] ?? [];
    if (!autorisees.includes(toStatus)) {
      throw new EscrowErreur(
        EscrowErreurType.TRANSITION_INVALIDE,
        `Transition "${escrow.status}" → "${toStatus}" non autorisée pour l'escrow ${escrow.id}.`,
        {
          escrowId: escrow.id,
          fromStatus: escrow.status,
          toStatus,
          autorisees,
        },
      );
    }
  }

  /* ==========================================================
   * DOUBLE-RELEASE / DOUBLE-REFUND
   * ========================================================== */

  /**
   * Bloque toute tentative de libérer un escrow déjà libéré.
   */
  validerPasDoubleRelease(escrow: Escrow): void {
    if (escrow.status === EscrowStatus.RELEASED) {
      throw new EscrowErreur(
        EscrowErreurType.DOUBLE_RELEASE,
        `L'escrow ${escrow.id} a déjà été libéré (RELEASED) — double-release interdit.`,
        { escrowId: escrow.id, releasedAt: escrow.releasedAt },
      );
    }
  }

  /**
   * Bloque toute tentative de rembourser un escrow déjà remboursé.
   */
  validerPasDoubleRefund(escrow: Escrow): void {
    if (
      escrow.status === EscrowStatus.REFUNDED ||
      escrow.status === EscrowStatus.REFUND_PENDING
    ) {
      throw new EscrowErreur(
        EscrowErreurType.DOUBLE_REFUND,
        `L'escrow ${escrow.id} est déjà en "${escrow.status}" — double-refund interdit.`,
        { escrowId: escrow.id, currentStatus: escrow.status, refundedAt: escrow.refundedAt },
      );
    }
  }

  /* ==========================================================
   * MONTANTS
   * ========================================================== */

  /**
   * Valide qu'un montant est strictement positif et fini.
   */
  validerMontant(montant: number, label = 'Montant'): void {
    if (!isFinite(montant) || montant <= 0) {
      throw new EscrowErreur(
        EscrowErreurType.MONTANT_INVALIDE,
        `${label} invalide : ${montant}. Doit être un nombre positif.`,
        { montant },
      );
    }
  }

  /**
   * Valide qu'un montant de remboursement ne dépasse pas le montant total.
   */
  validerMontantRemboursement(ctx: EscrowRefundContext, montantTotal: number): void {
    if (!ctx.total && ctx.montantRembourse !== undefined) {
      this.validerMontant(ctx.montantRembourse, 'Montant remboursé');

      if (ctx.montantRembourse > montantTotal) {
        throw new EscrowErreur(
          EscrowErreurType.MONTANT_INSUFFISANT,
          `Montant remboursé (${ctx.montantRembourse}) dépasse le montant total de l'escrow (${montantTotal}).`,
          { montantRembourse: ctx.montantRembourse, montantTotal },
        );
      }
    }
  }

  /**
   * Valide la cohérence du montant reçu avec le montant attendu.
   * Accepte un écart de 1 unité (arrondi provider).
   */
  validerMontantConfirme(montantConfirme: number, montantAttendu: number): void {
    this.validerMontant(montantConfirme, 'Montant confirmé');

    const ecart = Math.abs(montantConfirme - montantAttendu);
    if (ecart > 1) {
      throw new EscrowErreur(
        EscrowErreurType.MONTANT_INVALIDE,
        `Montant confirmé (${montantConfirme}) incohérent avec montant attendu (${montantAttendu}). Écart : ${ecart}.`,
        { montantConfirme, montantAttendu, ecart },
      );
    }
  }

  /* ==========================================================
   * ÉTATS PRÉ-REQUIS
   * ========================================================== */

  /**
   * Vérifie que l'escrow est dans l'un des états attendus.
   */
  validerEtatAttendu(escrow: Escrow, ...etatsAttendus: EscrowStatus[]): void {
    if (!etatsAttendus.includes(escrow.status)) {
      throw new EscrowErreur(
        EscrowErreurType.TRANSITION_INVALIDE,
        `L'escrow ${escrow.id} doit être en [${etatsAttendus.join(', ')}] mais est en "${escrow.status}".`,
        { escrowId: escrow.id, currentStatus: escrow.status, etatsAttendus },
      );
    }
  }

  /**
   * Vérifie qu'un litige est bien ouvert avant de le résoudre.
   */
  validerLitigeOuvert(escrow: Escrow): void {
    if (escrow.status !== EscrowStatus.DISPUTED || !escrow.disputeId) {
      throw new EscrowErreur(
        EscrowErreurType.LITIGE_NON_RESOLU,
        `L'escrow ${escrow.id} n'est pas en litige (status="${escrow.status}", disputeId=${escrow.disputeId}).`,
        { escrowId: escrow.id, status: escrow.status, disputeId: escrow.disputeId },
      );
    }
  }
}

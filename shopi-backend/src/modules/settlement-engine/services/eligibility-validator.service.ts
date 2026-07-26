/* ============================================================
 * FICHIER : src/modules/settlement-engine/services/eligibility-validator.service.ts
 *
 * RÔLE    : Vérifie qu'un acteur peut soumettre ou traiter un retrait.
 *
 * RÈGLES (toutes configurables via PlatformSettings + Wallet) :
 *   1. Wallet ACTIVE (non gelé, non fermé)
 *   2. Solde disponible >= montant demandé
 *   3. Montant >= minWithdrawalAmount
 *   4. Montant <= maxTransactionAmount
 *   5. Limite journalière non dépassée
 *   6. Aucun retrait PROCESSING pour ce wallet (double-retrait)
 *   7. Aucun litige bloquant en cours (OPEN/UNDER_REVIEW/DECISION_PENDING)
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';

import { Wallet, WalletStatus } from '../../../database/entities/wallet.entity';
import { Retrait, RetraitStatus } from '../../../database/entities/paiement/retrait.entity';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { Dispute, DisputeStatus } from '../../../database/entities/paiement/dispute.entity';

import { EligibiliteResult, SettlementErreur, SettlementErreurType } from '../types/settlement-engine.types';

/** Statuts de dispute qui bloquent un retrait. */
const BLOCKING_DISPUTE_STATUSES = [
  DisputeStatus.OPEN,
  DisputeStatus.UNDER_REVIEW,
  DisputeStatus.WAITING_FOR_EVIDENCE,
  DisputeStatus.DECISION_PENDING,
  DisputeStatus.REFUND_PENDING,
];

@Injectable()
export class EligibilityValidatorService {

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
  ) {}

  /**
   * Valide l'éligibilité complète d'une demande de retrait.
   * Lève une SettlementErreur si l'acteur ou le wallet ne sont pas éligibles.
   */
  async valider(walletId: string, montant: number, userId: string): Promise<void> {
    const [wallet, settings] = await Promise.all([
      this.walletRepo.findOne({ where: { id: walletId } }),
      this.settingsRepo.findOne({ where: { id: 1 } }),
    ]);

    if (!wallet) {
      throw new SettlementErreur(
        SettlementErreurType.WALLET_INTROUVABLE,
        `Wallet ${walletId} introuvable.`,
        { walletId },
      );
    }

    if (!settings) {
      throw new SettlementErreur(
        SettlementErreurType.ERREUR_INTERNE,
        'PlatformSettings introuvable.',
      );
    }

    // Règle 1 : wallet actif
    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new SettlementErreur(
        SettlementErreurType.ELIGIBILITE_ECHOUEE,
        `Wallet ${walletId} non actif (statut : ${wallet.status}).`,
        { walletId, status: wallet.status },
      );
    }

    // Règle 2 : solde suffisant
    if (wallet.balance < montant) {
      throw new SettlementErreur(
        SettlementErreurType.SOLDE_INSUFFISANT,
        `Solde insuffisant : disponible=${wallet.balance}, demandé=${montant}.`,
        { walletId, balance: wallet.balance, montant },
      );
    }

    // Règle 3 : montant minimum
    if (montant < settings.minWithdrawalAmount) {
      throw new SettlementErreur(
        SettlementErreurType.MONTANT_INVALIDE,
        `Montant ${montant} inférieur au minimum autorisé (${settings.minWithdrawalAmount}).`,
        { montant, minimum: settings.minWithdrawalAmount },
      );
    }

    // Règle 4 : montant maximum
    if (montant > settings.maxTransactionAmount) {
      throw new SettlementErreur(
        SettlementErreurType.MONTANT_INVALIDE,
        `Montant ${montant} dépasse le maximum par transaction (${settings.maxTransactionAmount}).`,
        { montant, maximum: settings.maxTransactionAmount },
      );
    }

    // Règle 5 : limite journalière
    const limiteJournaliere = Math.min(
      settings.dailyWithdrawalLimit,
      wallet.dailyWithdrawLimit > 0 ? wallet.dailyWithdrawLimit : Infinity,
    );
    if (limiteJournaliere > 0 && wallet.todayWithdrawAmount + montant > limiteJournaliere) {
      throw new SettlementErreur(
        SettlementErreurType.ELIGIBILITE_ECHOUEE,
        `Limite de retrait journalière dépassée (${wallet.todayWithdrawAmount}/${limiteJournaliere}).`,
        { walletId, todayWithdrawAmount: wallet.todayWithdrawAmount, limite: limiteJournaliere },
      );
    }

    // Règle 6 : aucun retrait déjà en cours (double-retrait)
    const retraitEnCours = await this.retraitRepo.findOne({
      where: { walletId, status: RetraitStatus.PROCESSING },
    });
    if (retraitEnCours) {
      throw new SettlementErreur(
        SettlementErreurType.RETRAIT_DEJA_EN_COURS,
        `Un retrait est déjà en cours (id=${retraitEnCours.id}).`,
        { walletId, retraitEnCoursId: retraitEnCours.id },
      );
    }

    // Règle 7 : aucun litige bloquant (query directe, sans dépendance circulaire)
    const litigeBloquant = await this.disputeRepo.findOne({
      where: {
        clientUserId: userId,
        status: In(BLOCKING_DISPUTE_STATUSES),
      },
    });
    if (litigeBloquant) {
      throw new SettlementErreur(
        SettlementErreurType.ELIGIBILITE_ECHOUEE,
        `Litige en cours bloquant les retraits (id=${litigeBloquant.id}, statut=${litigeBloquant.status}).`,
        { userId, disputeId: litigeBloquant.id, disputeStatus: litigeBloquant.status },
      );
    }
  }

  /**
   * Version non-bloquante : retourne un résultat sans lever d'exception.
   * Utile pour les vérifications préalables en lecture seule.
   */
  async verifier(walletId: string, montant: number, userId: string): Promise<EligibiliteResult> {
    try {
      await this.valider(walletId, montant, userId);
      return { eligible: true, raison: null };
    } catch (err) {
      return {
        eligible: false,
        raison: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

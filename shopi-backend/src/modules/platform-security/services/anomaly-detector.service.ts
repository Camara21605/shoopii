/* ============================================================
 * FICHIER      : src/modules/platform-security/services/anomaly-detector.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Détection d'anomalies comportementales en temps réel.
 * Utilise des fenêtres temporelles glissantes en mémoire pour
 * identifier les comportements suspects sans requête DB à chaud.
 *
 * DÉTECTIONS COUVERTES
 * ─────────────────────────────────────────────────────────────
 * 1. Brute force — >5 tentatives de connexion échouées en 15 min
 *    par la même paire (IP, userId). Seuil configurable.
 *
 * 2. Retrait anormal — montant >3x la moyenne historique du même
 *    utilisateur ET >3x le seuil absolu (500 000 GNF).
 *    Protège contre les gros retraits frauduleux après compromission.
 *
 * 3. Pic de remboursements — taux de remboursements >15% des
 *    paiements sur l'heure écoulée. Signal de fraude carouseau.
 *
 * SÉCURITÉ
 * ─────────────────────────────────────────────────────────────
 * Les détections sont best-effort. Ce service ne remplace pas
 * les contrôles d'accès côté base de données.
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *   SecurityEventService → log() pour persister les anomalies
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';

import { SecurityEventService }             from './security-event.service';
import { SecurityEventType, SecuritySeverity } from '../../../database/entities/security/security-event-log.entity';
import { AnomalyResult }                    from '../types/security.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** Nombre maximal de tentatives échouées avant blocage (fenêtre LOGIN_WINDOW_MS). */
const BRUTE_FORCE_THRESHOLD = 5;
/** Fenêtre temporelle brute force (15 minutes). */
const LOGIN_WINDOW_MS       = 15 * 60 * 1000;

/** Facteur de multiplication pour qualifier un retrait d'anormal. */
const WITHDRAWAL_ANOMALY_FACTOR   = 3;
/** Montant absolu minimum à partir duquel le facteur s'applique (GNF). */
const WITHDRAWAL_ANOMALY_FLOOR    = 500_000;
/** Taille de la fenêtre historique de retraits (dernières N valeurs). */
const WITHDRAWAL_HISTORY_SIZE     = 10;

/** Taux de remboursements déclenchant l'alerte pic (%). */
const REFUND_RATE_THRESHOLD_PCT   = 15;
/** Fenêtre temporelle pour le taux de remboursements (1 heure). */
const REFUND_WINDOW_MS            = 60 * 60 * 1000;

/* ============================================================
 * TYPES INTERNES
 * ============================================================ */

interface LoginWindow {
  count:       number;
  windowStart: number; // ms timestamp
}

interface WithdrawalHistory {
  amounts: number[];
}

interface RefundWindow {
  payments: number;
  refunds:  number;
  windowStart: number; // ms timestamp
}

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class AnomalyDetectorService {

  private readonly logger = new Logger(AnomalyDetectorService.name);

  /* ── Brute force : clé = `${ipAddress}:${actorId}` ─────── */
  private readonly loginWindows = new Map<string, LoginWindow>();

  /* ── Historique des retraits par userId ─────────────────── */
  private readonly withdrawalHistories = new Map<string, WithdrawalHistory>();

  /* ── Compteur de remboursements agrégé ──────────────────── */
  private refundWindow: RefundWindow = {
    payments:    0,
    refunds:     0,
    windowStart: Date.now(),
  };

  constructor(private readonly securityEvent: SecurityEventService) {}

  /* ==========================================================
   * BRUTE FORCE DETECTION
   * ========================================================== */

  /**
   * Enregistre une tentative de connexion échouée.
   * Retourne un AnomalyResult indiquant si le seuil est atteint.
   *
   * @param actorId   — UUID de l'utilisateur ciblé (peut être inconnu)
   * @param ipAddress — IP source de la tentative
   */
  recordFailedLogin(actorId: string, ipAddress: string): AnomalyResult {
    const key = `${ipAddress}:${actorId}`;
    const now = Date.now();

    let window = this.loginWindows.get(key);

    if (!window || now - window.windowStart > LOGIN_WINDOW_MS) {
      /* Nouvelle fenêtre */
      window = { count: 1, windowStart: now };
    } else {
      window.count++;
    }
    this.loginWindows.set(key, window);

    if (window.count >= BRUTE_FORCE_THRESHOLD) {
      this.logger.warn(
        `[AnomalyDetector] Brute force détecté — ip=${ipAddress} actor=${actorId} ` +
        `count=${window.count}`,
      );

      /* Persistance asynchrone — ne pas bloquer l'appelant */
      this.securityEvent.logAsync({
        eventType: SecurityEventType.BRUTE_FORCE_DETECTED,
        severity:  SecuritySeverity.CRITICAL,
        actorId:   actorId !== 'unknown' ? actorId : undefined,
        ipAddress,
        action:    'login',
        details: {
          attempts:      window.count,
          windowMinutes: LOGIN_WINDOW_MS / 60000,
          key,
        },
      });

      return {
        isAnomaly: true,
        reason:    `${window.count} tentatives de connexion échouées en ${LOGIN_WINDOW_MS / 60000} min`,
        severity:  SecuritySeverity.CRITICAL,
        metadata:  { attempts: window.count, ipAddress, actorId },
      };
    }

    return { isAnomaly: false };
  }

  /* ==========================================================
   * RETRAIT ANORMAL
   * ========================================================== */

  /**
   * Enregistre un retrait et vérifie s'il est anormal.
   * Un retrait est anormal s'il dépasse WITHDRAWAL_ANOMALY_FACTOR fois
   * la moyenne des retraits précédents du même utilisateur.
   */
  recordWithdrawal(userId: string, amount: number): AnomalyResult {
    let history = this.withdrawalHistories.get(userId);
    if (!history) {
      history = { amounts: [] };
      this.withdrawalHistories.set(userId, history);
    }

    const isAnomaly = this.isWithdrawalAnomaly(history.amounts, amount);

    /* Ajoute le montant APRÈS la vérification (ne pollue pas la baseline) */
    history.amounts.push(amount);
    if (history.amounts.length > WITHDRAWAL_HISTORY_SIZE) {
      history.amounts.shift();
    }

    if (isAnomaly) {
      const avg = history.amounts.length > 0
        ? history.amounts.reduce((a, b) => a + b, 0) / history.amounts.length
        : 0;

      this.logger.warn(
        `[AnomalyDetector] Retrait anormal — userId=${userId} amount=${amount} avg=${Math.round(avg)}`,
      );

      this.securityEvent.logAsync({
        eventType: SecurityEventType.ABNORMAL_WITHDRAWAL,
        severity:  SecuritySeverity.HIGH,
        actorId:   userId,
        action:    'withdrawal',
        details:   { amount, avg: Math.round(avg), factor: WITHDRAWAL_ANOMALY_FACTOR },
      });

      return {
        isAnomaly: true,
        reason:    `Montant anormalement élevé (${amount.toLocaleString()} GNF vs moyenne ${Math.round(avg).toLocaleString()} GNF)`,
        severity:  SecuritySeverity.HIGH,
        metadata:  { amount, historicalAvg: Math.round(avg) },
      };
    }

    return { isAnomaly: false };
  }

  private isWithdrawalAnomaly(history: number[], amount: number): boolean {
    if (amount < WITHDRAWAL_ANOMALY_FLOOR) return false;
    if (history.length === 0) return false;

    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    return amount > avg * WITHDRAWAL_ANOMALY_FACTOR;
  }

  /* ==========================================================
   * PIC DE REMBOURSEMENTS
   * ========================================================== */

  /** Enregistre un paiement confirmé dans la fenêtre courante. */
  recordPayment(): void {
    this.ensureRefundWindowCurrent();
    this.refundWindow.payments++;
  }

  /** Enregistre un remboursement dans la fenêtre courante. */
  recordRefund(): AnomalyResult {
    this.ensureRefundWindowCurrent();
    this.refundWindow.refunds++;

    const rate = this.getRefundRate();
    if (this.refundWindow.payments >= 10 && rate > REFUND_RATE_THRESHOLD_PCT) {
      this.logger.error(
        `[AnomalyDetector] Pic de remboursements — rate=${rate}% ` +
        `(${this.refundWindow.refunds}/${this.refundWindow.payments})`,
      );

      this.securityEvent.logAsync({
        eventType: SecurityEventType.REFUND_SPIKE_DETECTED,
        severity:  SecuritySeverity.HIGH,
        action:    'refund_spike',
        details: {
          ratePct:  rate,
          refunds:  this.refundWindow.refunds,
          payments: this.refundWindow.payments,
        },
      });

      return {
        isAnomaly: true,
        reason:    `Taux de remboursements anormalement élevé : ${rate}%`,
        severity:  SecuritySeverity.HIGH,
        metadata:  { ratePct: rate, refunds: this.refundWindow.refunds, payments: this.refundWindow.payments },
      };
    }

    return { isAnomaly: false };
  }

  /** Retourne le taux de remboursements actuel (%). */
  getRefundRate(): number {
    if (this.refundWindow.payments === 0) return 0;
    return Math.round((this.refundWindow.refunds / this.refundWindow.payments) * 10000) / 100;
  }

  /* ==========================================================
   * MAINTENANCE
   * ========================================================== */

  /**
   * Purge les fenêtres brute force expirées.
   * Appelé par SecurityScheduler toutes les 15 minutes.
   * Évite la croissance indéfinie de la Map.
   */
  cleanupExpiredWindows(): number {
    const threshold = Date.now() - LOGIN_WINDOW_MS;
    let removed = 0;

    for (const [key, window] of this.loginWindows.entries()) {
      if (window.windowStart < threshold) {
        this.loginWindows.delete(key);
        removed++;
      }
    }

    return removed;
  }

  private ensureRefundWindowCurrent(): void {
    if (Date.now() - this.refundWindow.windowStart > REFUND_WINDOW_MS) {
      this.refundWindow = { payments: 0, refunds: 0, windowStart: Date.now() };
    }
  }

  /** Retourne les statistiques des fenêtres actives (pour les tests). */
  getStats(): {
    activeLoginWindows:  number;
    trackedUsers:        number;
    refundWindowPayments: number;
    refundWindowRefunds:  number;
  } {
    return {
      activeLoginWindows:   this.loginWindows.size,
      trackedUsers:         this.withdrawalHistories.size,
      refundWindowPayments: this.refundWindow.payments,
      refundWindowRefunds:  this.refundWindow.refunds,
    };
  }
}

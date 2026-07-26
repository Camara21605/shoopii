/* ============================================================
 * FICHIER      : src/modules/reporting-engine/services/alert.service.ts
 * MODULE       : ReportingEngine
 * ROLE         : Alertes financières configurables avec dé-duplication
 * RESPONSABILITES :
 *   - Détecter les anomalies financières en temps réel
 *   - Éviter les doublons d'alertes (une alerte par type par heure)
 *   - Gérer les seuils configurables par type d'alerte
 *   - Exposer les alertes actives aux dashboards
 * DEPENDANCES  :
 *   PaiementSession, Dispute, Wallet, Retrait (repos directs)
 *   Node.js EventEmitter (pas @nestjs/event-emitter)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaiementSession } from '../../../database/entities/paiement/paiement-session.entity';
import { Dispute }         from '../../../database/entities/paiement/dispute.entity';
import { Wallet }          from '../../../database/entities/wallet.entity';
import { Retrait }         from '../../../database/entities/paiement/retrait.entity';

import {
  FinancialAlert,
  AlertCheckResult,
  AlertType,
  AlertSeverity,
} from '../types/reporting.types';

/* ============================================================
 * SEUILS PAR DÉFAUT
 * ============================================================ */

/**
 * Seuils par défaut pour la détection des anomalies.
 * À terme, ces seuils pourront être configurés via PlatformSettings.
 */
const DEFAULT_THRESHOLDS = {
  /* % d'augmentation du taux de remboursements vs la veille */
  refundSpikePercent:    50,
  /* % d'augmentation des litiges ouverts vs la veille */
  disputeSpikePercent:   30,
  /* % de baisse du CA brut vs la veille */
  salesDropPercent:      40,
  /* Montant seuil pour wallets à solde négatif (0 = tout wallet négatif) */
  negativeWalletAmount:  0,
  /* Nb de retraits bloqués (pending > 48h) avant alerte */
  withdrawalStuckCount:  5,
  /* % d'augmentation volume paiements vs la veille */
  paymentVolumeSpikePercent: 200,
  /* Nb d'échecs provider avant alerte dans une fenêtre 1h */
  providerFailureCount:  20,
  /* Nb de wallets gelés en 24h avant alerte */
  walletFreezeCount:     3,
};

/* ============================================================
 * TYPES INTERNES
 * ============================================================ */

interface AlertEntry {
  alert:     FinancialAlert;
  expiresAt: number; // timestamp ms
}

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class AlertService {

  /**
   * Store d'alertes actives.
   * Clé : `${AlertType}:${YYYY-MM-DD-HH}` pour dé-duplication 1h.
   * Une alerte par type par heure — évite le flood sur dashboards.
   */
  private readonly activeAlerts = new Map<string, AlertEntry>();

  /** TTL d'une entrée d'alerte : 24h */
  private readonly ALERT_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,
  ) {}

  /* ==========================================================
   * API PUBLIQUE
   * ========================================================== */

  /**
   * Lance toutes les vérifications d'alerte et retourne un résumé.
   * Destiné à être appelé par un scheduler (toutes les 5 minutes).
   */
  async runAllChecks(): Promise<AlertCheckResult> {
    const [
      refundAlerts,
      disputeAlerts,
      salesAlerts,
      negativeWalletAlerts,
      withdrawalAlerts,
      providerAlerts,
    ] = await Promise.all([
      this.checkRefundSpike(),
      this.checkDisputeSpike(),
      this.checkSalesDrop(),
      this.checkNegativeWallets(),
      this.checkWithdrawalStuck(),
      this.checkProviderFailures(),
    ]);

    const newAlerts = [
      refundAlerts,
      disputeAlerts,
      salesAlerts,
      negativeWalletAlerts,
      withdrawalAlerts,
      providerAlerts,
    ].filter(Boolean) as FinancialAlert[];

    /* Stocker les nouvelles alertes (dé-duplication par clé) */
    for (const alert of newAlerts) {
      this.storeAlert(alert);
    }

    /* Purger les alertes expirées */
    this.purgeExpired();

    return {
      checked:  6,
      triggered: newAlerts.length,
      alerts:    newAlerts,
    };
  }

  /**
   * Retourne les alertes actives (non expirées) pour les dashboards.
   * Filtre optionnel par rôle cible.
   */
  getActiveAlerts(options?: { targetRole?: string }): FinancialAlert[] {
    this.purgeExpired();

    const entries = Array.from(this.activeAlerts.values())
      .map(e => e.alert);

    if (!options?.targetRole) return entries;

    /* Certaines alertes ne sont pertinentes que pour certains rôles */
    const roleAlertTypes: Record<string, AlertType[]> = {
      admin:    [AlertType.DISPUTE_SPIKE, AlertType.REFUND_SPIKE],
      partner:  [AlertType.NEGATIVE_WALLET, AlertType.SALES_DROP],
      super_admin: Object.values(AlertType) as AlertType[],
    };

    const allowedTypes = roleAlertTypes[options.targetRole] ?? [];
    return entries.filter(a => allowedTypes.includes(a.type));
  }

  /**
   * Supprime manuellement une alerte résolue.
   */
  dismissAlert(alertId: string): void {
    for (const [key, entry] of this.activeAlerts.entries()) {
      if (entry.alert.id === alertId) {
        this.activeAlerts.delete(key);
        return;
      }
    }
  }

  /* ==========================================================
   * VÉRIFICATIONS
   * ========================================================== */

  /**
   * Détecte un pic de remboursements vs la veille.
   * Compare le nb de remboursements de la dernière heure vs la même
   * heure hier.
   */
  private async checkRefundSpike(): Promise<FinancialAlert | null> {
    const [current, previous] = await Promise.all([
      this.sessionRepo.manager.query(
        `SELECT COUNT(*) AS nb FROM "paiement_sessions"
         WHERE "status" = 'refunded'
           AND "createdAt" >= NOW() - INTERVAL '1 hour'`,
      ),
      this.sessionRepo.manager.query(
        `SELECT COUNT(*) AS nb FROM "paiement_sessions"
         WHERE "status" = 'refunded'
           AND "createdAt" BETWEEN NOW() - INTERVAL '25 hours'
                               AND NOW() - INTERVAL '23 hours'`,
      ),
    ]);

    const curr = +current[0]?.nb  || 0;
    const prev = +previous[0]?.nb || 0;

    if (prev === 0 && curr === 0) return null;
    if (prev === 0 && curr > 0) {
      return this.buildAlert(AlertType.REFUND_SPIKE, AlertSeverity.HIGH,
        `Remboursements initiés (${curr}) sans baseline hier — surveillance activée`,
        { current: curr, previous: prev },
      );
    }

    const pct = Math.round((curr - prev) / prev * 100);
    if (pct >= DEFAULT_THRESHOLDS.refundSpikePercent) {
      return this.buildAlert(
        AlertType.REFUND_SPIKE,
        pct >= 100 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
        `Pic de remboursements : +${pct}% vs même heure hier (${curr} vs ${prev})`,
        { current: curr, previous: prev, delta: pct },
      );
    }

    return null;
  }

  /**
   * Détecte un pic de litiges ouverts vs la veille.
   */
  private async checkDisputeSpike(): Promise<FinancialAlert | null> {
    const [current, previous] = await Promise.all([
      this.disputeRepo.manager.query(
        `SELECT COUNT(*) AS nb FROM "disputes"
         WHERE "status" = 'open'
           AND "openedAt" >= NOW() - INTERVAL '1 hour'`,
      ),
      this.disputeRepo.manager.query(
        `SELECT COUNT(*) AS nb FROM "disputes"
         WHERE "status" = 'open'
           AND "openedAt" BETWEEN NOW() - INTERVAL '25 hours'
                              AND NOW() - INTERVAL '23 hours'`,
      ),
    ]);

    const curr = +current[0]?.nb  || 0;
    const prev = +previous[0]?.nb || 0;

    if (prev === 0 && curr <= 1) return null;

    const pct = prev > 0
      ? Math.round((curr - prev) / prev * 100)
      : (curr > 0 ? 100 : 0);

    if (pct >= DEFAULT_THRESHOLDS.disputeSpikePercent) {
      return this.buildAlert(
        AlertType.DISPUTE_SPIKE,
        pct >= 80 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
        `Pic de litiges : +${pct}% vs même heure hier (${curr} vs ${prev})`,
        { current: curr, previous: prev, delta: pct },
      );
    }

    return null;
  }

  /**
   * Détecte une chute du CA brut sur les dernières 2h vs les 2h précédentes.
   */
  private async checkSalesDrop(): Promise<FinancialAlert | null> {
    const [current, previous] = await Promise.all([
      this.sessionRepo.manager.query(
        `SELECT COALESCE(SUM("montant"), 0) AS ca FROM "paiement_sessions"
         WHERE "status" = 'confirmed'
           AND "confirmedAt" >= NOW() - INTERVAL '2 hours'`,
      ),
      this.sessionRepo.manager.query(
        `SELECT COALESCE(SUM("montant"), 0) AS ca FROM "paiement_sessions"
         WHERE "status" = 'confirmed'
           AND "confirmedAt" BETWEEN NOW() - INTERVAL '4 hours'
                                 AND NOW() - INTERVAL '2 hours'`,
      ),
    ]);

    const curr = +current[0]?.ca  || 0;
    const prev = +previous[0]?.ca || 0;

    if (prev === 0) return null;

    const pct = Math.round((prev - curr) / prev * 100);
    if (pct >= DEFAULT_THRESHOLDS.salesDropPercent) {
      return this.buildAlert(
        AlertType.SALES_DROP,
        pct >= 70 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
        `Baisse du CA : -${pct}% sur les 2 dernières heures`,
        { current: curr, previous: prev, drop: pct },
      );
    }

    return null;
  }

  /**
   * Détecte les wallets à solde négatif (anomalie grave = bug ou fraude).
   */
  private async checkNegativeWallets(): Promise<FinancialAlert | null> {
    const rows = await this.walletRepo.manager.query(
      `SELECT COUNT(*) AS nb FROM "wallets"
       WHERE balance < $1 AND "status" = 'active'`,
      [DEFAULT_THRESHOLDS.negativeWalletAmount],
    );

    const nb = +rows[0]?.nb || 0;
    if (nb === 0) return null;

    return this.buildAlert(
      AlertType.NEGATIVE_WALLET,
      AlertSeverity.CRITICAL,
      `${nb} wallet(s) avec solde négatif détectés — vérification urgente requise`,
      { count: nb },
    );
  }

  /**
   * Détecte les retraits bloqués en statut PENDING depuis plus de 48h.
   */
  private async checkWithdrawalStuck(): Promise<FinancialAlert | null> {
    const rows = await this.retraitRepo.manager.query(
      `SELECT COUNT(*) AS nb FROM "retraits"
       WHERE "status" = 'pending'
         AND "requestedAt" < NOW() - INTERVAL '48 hours'`,
    );

    const nb = +rows[0]?.nb || 0;
    if (nb < DEFAULT_THRESHOLDS.withdrawalStuckCount) return null;

    return this.buildAlert(
      AlertType.WITHDRAWAL_STUCK,
      nb >= 20 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
      `${nb} retrait(s) bloqués depuis plus de 48h — intervention requise`,
      { count: nb },
    );
  }

  /**
   * Détecte un taux d'échec élevé sur un provider de paiement (1h).
   */
  private async checkProviderFailures(): Promise<FinancialAlert | null> {
    const rows = await this.sessionRepo.manager.query(
      `SELECT "provider",
              COUNT(*) AS nb_total,
              COUNT(CASE WHEN "status" IN ('failed','cancelled') THEN 1 END) AS nb_failed
       FROM "paiement_sessions"
       WHERE "createdAt" >= NOW() - INTERVAL '1 hour'
       GROUP BY "provider"
       HAVING COUNT(CASE WHEN "status" IN ('failed','cancelled') THEN 1 END) >= $1`,
      [DEFAULT_THRESHOLDS.providerFailureCount],
    );

    if (!rows.length) return null;

    const worst    = rows[0] as { provider: string; nb_total: string; nb_failed: string };
    const pct      = Math.round(+worst.nb_failed / +worst.nb_total * 100);

    return this.buildAlert(
      AlertType.PROVIDER_FAILURE,
      AlertSeverity.CRITICAL,
      `Provider ${worst.provider} : ${worst.nb_failed} échecs sur ${worst.nb_total} transactions (${pct}%) dans la dernière heure`,
      { provider: worst.provider, failed: +worst.nb_failed, total: +worst.nb_total, taux: pct },
    );
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES
   * ========================================================== */

  /**
   * Construit un objet FinancialAlert avec un ID unique et un timestamp.
   */
  private buildAlert(
    type:     AlertType,
    severity: AlertSeverity,
    message:  string,
    metadata: Record<string, unknown>,
  ): FinancialAlert {
    const now = new Date();
    return {
      id:       `${type}-${now.getTime()}`,
      type,
      severity,
      message,
      metadata,
      triggeredAt: now,
      acknowledged: false,
    };
  }

  /**
   * Stocke une alerte en dé-dupliquant par type + heure courante.
   * Format de clé : `${AlertType}:${YYYY-MM-DD-HH}`
   * Une seule alerte par type par heure pour éviter le flood.
   */
  private storeAlert(alert: FinancialAlert): void {
    const now = new Date();
    const hour= `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}`;
    const key = `${alert.type}:${hour}`;

    if (this.activeAlerts.has(key)) return;

    this.activeAlerts.set(key, {
      alert,
      expiresAt: now.getTime() + this.ALERT_TTL_MS,
    });
  }

  /**
   * Supprime les entrées expirées pour éviter les fuites mémoire.
   */
  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.activeAlerts.entries()) {
      if (entry.expiresAt <= now) {
        this.activeAlerts.delete(key);
      }
    }
  }
}

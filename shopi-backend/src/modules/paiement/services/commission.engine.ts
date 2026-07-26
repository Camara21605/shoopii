/* ============================================================
 * FICHIER : src/modules/paiement/services/commission.engine.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Calcule la répartition financière exacte pour chaque acteur
 * d'une commande, selon les règles de commission de la plateforme
 * et le plan de l'entreprise.
 *
 * ─────────────────────────────────────────────────────────────
 * RÈGLES DE COMMISSION
 * ─────────────────────────────────────────────────────────────
 *
 *  Taux de base : PlatformSettings.platformCommission (défaut 6%)
 *
 *  Réductions selon le plan de l'entreprise :
 *    STANDARD : 0%  de réduction → taux complet (ex: 6%)
 *    PRO      : 25% de réduction → taux × 0.75 (ex: 4.5%)
 *    PREMIUM  : 50% de réduction → taux × 0.50 (ex: 3%)
 *
 *  Formula :
 *    commissionShopi   = sousTotal × tauxEffectif
 *    partEntreprise    = sousTotal - commissionShopi
 *    partLivreur       = fraisLivraison (100%)
 *    partCorrespondant = fraisCorrespondant (si present)
 *    partPlateforme    = commissionShopi
 *
 *  Total distribué = partEntreprise + partLivreur + partCorrespondant
 *                   + partPlateforme
 *                  = commande.total  ✅
 *
 * ─────────────────────────────────────────────────────────────
 * GARANTIES MATHÉMATIQUES
 * ─────────────────────────────────────────────────────────────
 *
 *  Le total distribué DOIT être exactement égal au total payé
 *  par le client. En cas d'écart (arrondi), la différence est
 *  absorbée par la part de la plateforme (toujours en dernier).
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/paiement/services/commission.engine.ts
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { PlatformSettings }   from '../../../database/entities/platform-settings.entity';
import { Company }            from '../../../database/entities/profiles/entreprise-profile.entity';
import { DistributionActeurType } from '../../../database/entities/paiement/paiement-distribution.entity';

/* ============================================================
 * PLANS ENTREPRISE — multiplicateurs de commission
 * ============================================================ */

/**
 * Réduction de commission selon le plan de l'entreprise.
 * Multiplicateur appliqué au taux de base de la plateforme.
 *
 * CompanyPlan.STANDARD : pas de réduction (×1.00)
 * CompanyPlan.PRO      : réduction 25%   (×0.75)
 * CompanyPlan.PREMIUM  : réduction 50%   (×0.50)
 */
const PLAN_COMMISSION_MULTIPLIER: Record<string, number> = {
  standard: 1.00,
  pro:      0.75,
  premium:  0.50,
};

/** Taux de commission par défaut si PlatformSettings n'existe pas encore */
const DEFAULT_COMMISSION_RATE = 0.06;  // 6%

/* ============================================================
 * TYPES INTERNES
 * ============================================================ */

/**
 * Acteur bénéficiaire avec son montant.
 */
export interface ActeurPart {
  acteurType:   DistributionActeurType;
  acteurUserId: string;
  acteurNom:    string;
  montant:      number;
}

/**
 * Résultat complet du calcul de commission pour une commande.
 */
export interface CalculCommission {
  /** Taux de commission appliqué (ex: 0.045 pour 4.5%) */
  tauxEffectif:     number;

  /** Commission Shopi en GNF */
  commissionShopi:  number;

  /** Total distribué (doit égaler commande.total) */
  totalDistribue:   number;

  /**
   * Répartition par acteur.
   * Ordre : entreprise, livreur (opt.), correspondant (opt.),
   *         partenaire (opt.), plateforme.
   */
  parts:            ActeurPart[];
}

/**
 * Données d'entrée pour le calcul.
 */
export interface CommandeDataForCommission {
  id:                 string;
  companyId:          string;
  livreurId:          string | null;
  correspondantId:    string | null;
  partenaireId:       string | null;
  sousTotal:          number;
  fraisLivraison:     number;
  total:              number;
  commissionShopi:    number;   // Commission pré-calculée à la création
}

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class CommissionEngine {

  private readonly logger = new Logger(CommissionEngine.name);

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  /* ── Calcul principal ───────────────────────────────────── */

  /**
   * Calcule la répartition financière pour tous les acteurs
   * d'une commande.
   *
   * Les userIds des acteurs sont nécessaires pour les wallets.
   * On les récupère depuis les profils.
   */
  async calculer(
    commande:          CommandeDataForCommission,
    acteurs: {
      entrepriseUserId:     string;
      entrepriseNom:        string;
      livreurUserId?:       string;
      livreurNom?:          string;
      correspondantUserId?: string;
      correspondantNom?:    string;
      partenaireUserId?:    string;
      partenaireNom?:       string;
      plateformeUserId:     string;   // Compte Admin Shopi
    },
  ): Promise<CalculCommission> {

    /* ── 1. Taux effectif selon le plan de l'entreprise ──── */
    const tauxBase    = await this.getTauxBase();
    const multiplier  = await this.getPlanMultiplier(commande.companyId);
    const tauxEffectif = tauxBase * multiplier;

    this.logger.debug(
      `[Commission] Commande ${commande.id} — ` +
      `tauxBase: ${(tauxBase*100).toFixed(2)}% ` +
      `multiplicateur plan: ${multiplier} ` +
      `→ taux effectif: ${(tauxEffectif*100).toFixed(2)}%`,
    );

    /* ── 2. Recalcul de la commission ──────────────────────── */

    /*
     * On utilise commande.commissionShopi (pré-calculé à la création)
     * sauf si le taux a changé depuis — dans ce cas on recalcule.
     * Arrondi à l'entier inférieur (GNF = devise entière).
     */
    const commissionShopi = Math.floor(commande.sousTotal * tauxEffectif);

    if (commissionShopi !== commande.commissionShopi) {
      this.logger.warn(
        `[Commission] Commande ${commande.id} — commission recalculée: ` +
        `${commissionShopi} (ancienne: ${commande.commissionShopi})`,
      );
    }

    /* ── 3. Parts des acteurs ──────────────────────────────── */

    const parts: ActeurPart[] = [];

    /* Entreprise : sousTotal moins la commission Shopi */
    const partEntreprise = commande.sousTotal - commissionShopi;
    parts.push({
      acteurType:   DistributionActeurType.ENTREPRISE,
      acteurUserId: acteurs.entrepriseUserId,
      acteurNom:    acteurs.entrepriseNom,
      montant:      Math.max(0, partEntreprise),
    });

    /* Livreur : fraisLivraison en totalité */
    if (commande.livreurId && acteurs.livreurUserId) {
      const partLivreur = commande.fraisLivraison;
      parts.push({
        acteurType:   DistributionActeurType.LIVREUR,
        acteurUserId: acteurs.livreurUserId,
        acteurNom:    acteurs.livreurNom ?? 'Livreur',
        montant:      partLivreur,
      });
    }

    /* Correspondant */
    if (commande.correspondantId && acteurs.correspondantUserId) {
      /*
       * Pour l'instant : correspondant reçoit une part fixe de fraisLivraison
       * si livreur ET correspondant coexistent.
       * TODO : ajouter `fraisCorrespondant` dans Commande entity.
       */
      const partCorrespondant = commande.livreurId
        ? Math.floor(commande.fraisLivraison * 0.5)  // Partage 50/50 avec livreur
        : commande.fraisLivraison;                    // Tout si pas de livreur

      parts.push({
        acteurType:   DistributionActeurType.CORRESPONDANT,
        acteurUserId: acteurs.correspondantUserId,
        acteurNom:    acteurs.correspondantNom ?? 'Correspondant',
        montant:      partCorrespondant,
      });

      /* Ajuster la part livreur si les deux coexistent */
      if (commande.livreurId) {
        const livreurEntry = parts.find(p => p.acteurType === DistributionActeurType.LIVREUR);
        if (livreurEntry) {
          livreurEntry.montant = commande.fraisLivraison - partCorrespondant;
        }
      }
    }

    /* Partenaire (futur) */
    if (commande.partenaireId && acteurs.partenaireUserId) {
      parts.push({
        acteurType:   DistributionActeurType.PARTENAIRE,
        acteurUserId: acteurs.partenaireUserId,
        acteurNom:    acteurs.partenaireNom ?? 'Partenaire',
        montant:      0,  // TODO : définir la rémunération des partenaires
      });
    }

    /* ── 4. Part plateforme avec correction d'arrondi ──────── */

    const totalActeurs = parts.reduce((s, p) => s + p.montant, 0);

    /*
     * La part plateforme absorbe les écarts d'arrondi pour que
     * le total distribué soit EXACTEMENT égal au total payé.
     */
    const partPlateforme = commande.total - totalActeurs;

    parts.push({
      acteurType:   DistributionActeurType.PLATEFORME,
      acteurUserId: acteurs.plateformeUserId,
      acteurNom:    'Shopi Plateforme',
      montant:      Math.max(0, partPlateforme),
    });

    /* ── 5. Vérification d'intégrité ───────────────────────── */

    const totalDistribue = parts.reduce((s, p) => s + p.montant, 0);

    if (Math.abs(totalDistribue - commande.total) > 1) {
      this.logger.error(
        `[Commission] Erreur d'intégrité : totalDistribue=${totalDistribue} ≠ total=${commande.total}`,
      );
    }

    this.logger.log(
      `[Commission] Commande ${commande.id} — ` +
      `total: ${commande.total} GNF — ` +
      `commission: ${partPlateforme} GNF — ` +
      `entreprise: ${parts[0].montant} GNF`,
    );

    return {
      tauxEffectif,
      commissionShopi: partPlateforme,
      totalDistribue,
      parts,
    };
  }

  /* ── Helpers privés ─────────────────────────────────────── */

  /**
   * Récupère le taux de commission de base depuis PlatformSettings.
   * Retourne DEFAULT_COMMISSION_RATE si la table est vide.
   */
  private async getTauxBase(): Promise<number> {
    try {
      const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
      if (settings) {
        return Number(settings.platformCommission) / 100;
      }
    } catch (err) {
      this.logger.warn(`[Commission] Impossible de lire PlatformSettings: ${(err as Error).message}`);
    }
    return DEFAULT_COMMISSION_RATE;
  }

  /**
   * Récupère le multiplicateur de commission selon le plan de l'entreprise.
   * Retourne 1.0 (pas de réduction) si le plan est inconnu.
   */
  private async getPlanMultiplier(companyId: string): Promise<number> {
    try {
      const company = await this.companyRepo.findOne({
        where:  { id: companyId },
        select: ['plan'],
      });
      const plan = ((company as any)?.plan as string | undefined)?.toLowerCase() ?? 'standard';
      return PLAN_COMMISSION_MULTIPLIER[plan] ?? 1.0;
    } catch (err) {
      this.logger.warn(`[Commission] Impossible de lire le plan de l'entreprise ${companyId}: ${(err as Error).message}`);
      return 1.0;
    }
  }
}

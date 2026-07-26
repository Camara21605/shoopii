/* ============================================================
 * FICHIER : src/modules/commission/services/commission-history.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Interroge l'historique des distributions de commissions.
 *
 * Expose des méthodes de lecture pour :
 *   - Les distributions d'une commande spécifique
 *   - L'historique reçu par un acteur (entreprise, livreur…)
 *   - Les distributions par CommissionRule
 *   - Les totaux agrégés par période
 *
 * GARANTIES
 * ─────────────────────────────────────────────────────────────
 *  Ce service est READ-ONLY — aucune écriture en base.
 *  Compatible avec une réplique de lecture (si activée).
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *  Repository<PaiementDistribution>
 *  Repository<CommissionRule>
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import {
  PaiementDistribution,
  DistributionActeurType,
  DistributionStatus,
} from '../../../database/entities/paiement/paiement-distribution.entity';
import { CommissionRule } from '../../../database/entities/paiement/commission-rule.entity';

/* ─── DTOs de résultat ──────────────────────────────────────── */

export interface HistoriqueCommande {
  commandeId:     string;
  commandeNumero: string;
  distributions:  PaiementDistribution[];
  totalDistribue: number;
}

export interface HistoriqueActeur {
  acteurUserId:   string;
  distributions:  PaiementDistribution[];
  totalRecu:      number;
  totalEscrow:    number;
  totalLibere:    number;
}

export interface AggregatPeriode {
  debut:              Date;
  fin:                Date;
  nbCommandes:        number;
  totalCommissions:   number;
  repartition:        Record<DistributionActeurType, number>;
}

@Injectable()
export class CommissionHistoryService {

  private readonly logger = new Logger(CommissionHistoryService.name);

  constructor(
    @InjectRepository(PaiementDistribution)
    private readonly distributionRepo: Repository<PaiementDistribution>,

    @InjectRepository(CommissionRule)
    private readonly ruleRepo: Repository<CommissionRule>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * parCommande() — toutes les distributions d'une commande
   * ────────────────────────────────────────────────────────── */

  /**
   * Retourne toutes les distributions liées à une commande.
   *
   * @param commandeId UUID de la commande
   * @returns HistoriqueCommande avec totaux calculés
   */
  async parCommande(commandeId: string): Promise<HistoriqueCommande | null> {
    const distributions = await this.distributionRepo.find({
      where: { commandeId },
      order: { createdAt: 'ASC' },
    });

    if (!distributions.length) return null;

    const totalDistribue = distributions.reduce((s, d) => s + Number(d.montant), 0);

    return {
      commandeId,
      commandeNumero: distributions[0].commandeNumero,
      distributions,
      totalDistribue,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * parActeur() — historique d'un acteur
   * ────────────────────────────────────────────────────────── */

  /**
   * Retourne l'historique des commissions reçues par un acteur (userId).
   *
   * @param acteurUserId UUID du User (wallet owner)
   * @param statut Filtrer par statut (null = tous)
   * @param limit Pagination — nombre de résultats max
   * @param offset Pagination — offset
   */
  async parActeur(
    acteurUserId: string,
    statut:       DistributionStatus | null = null,
    limit         = 50,
    offset        = 0,
  ): Promise<HistoriqueActeur> {
    const where: Record<string, unknown> = { acteurUserId };
    if (statut) where['status'] = statut;

    const [distributions, totalEscrow, totalLibere] = await Promise.all([
      this.distributionRepo.find({
        where,
        order: { createdAt: 'DESC' },
        take:  limit,
        skip:  offset,
      }),
      /* Agrégats */
      this.distributionRepo.sum('montant', {
        acteurUserId,
        status: DistributionStatus.ESCROW,
      } as any),
      this.distributionRepo.sum('montant', {
        acteurUserId,
        status: DistributionStatus.RELEASED,
      } as any),
    ]);

    const totalRecu = (totalEscrow ?? 0) + (totalLibere ?? 0);

    return {
      acteurUserId,
      distributions,
      totalRecu,
      totalEscrow: totalEscrow ?? 0,
      totalLibere:  totalLibere  ?? 0,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * parRegle() — distributions appliquant une CommissionRule donnée
   * ────────────────────────────────────────────────────────── */

  /**
   * Retourne les distributions créées avec une CommissionRule précise.
   * Utile pour mesurer l'impact d'un changement de taux.
   *
   * @param ruleId UUID de la CommissionRule
   * @param limit Pagination
   */
  async parRegle(
    ruleId: string,
    limit   = 100,
  ): Promise<PaiementDistribution[]> {
    return this.distributionRepo.find({
      where: { commissionRuleId: ruleId } as any,
      order: { createdAt: 'DESC' },
      take:  limit,
    });
  }

  /* ──────────────────────────────────────────────────────────
   * aggregatPeriode() — totaux sur une fenêtre temporelle
   * ────────────────────────────────────────────────────────── */

  /**
   * Calcule les totaux de commissions sur une période.
   *
   * @param debut Date de début (incluse)
   * @param fin   Date de fin   (incluse)
   */
  async aggregatPeriode(debut: Date, fin: Date): Promise<AggregatPeriode> {
    const distributions = await this.distributionRepo.find({
      where: { createdAt: Between(debut, fin) } as any,
    });

    /* Agrégation par acteur type */
    const repartition = {} as Record<DistributionActeurType, number>;
    for (const type of Object.values(DistributionActeurType)) {
      repartition[type] = 0;
    }

    const commandeIds = new Set<string>();
    let totalCommissions = 0;

    for (const d of distributions) {
      commandeIds.add(d.commandeId);
      repartition[d.acteurType] = (repartition[d.acteurType] ?? 0) + Number(d.montant);
      totalCommissions += Number(d.montant);
    }

    this.logger.debug(
      `[History] Agrégat ${debut.toISOString().slice(0, 10)} → ${fin.toISOString().slice(0, 10)}: ` +
      `${commandeIds.size} commandes, ${totalCommissions} GNF`,
    );

    return {
      debut,
      fin,
      nbCommandes:      commandeIds.size,
      totalCommissions,
      repartition,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * historiqueRegles() — liste des règles avec nb de distributions
   * ────────────────────────────────────────────────────────── */

  /**
   * Retourne l'historique des CommissionRules enrichi du nombre
   * de distributions ayant utilisé chaque règle.
   *
   * Utile pour le dashboard admin — on peut voir l'impact de chaque version.
   */
  async historiqueRegles(): Promise<Array<CommissionRule & { nbDistributions: number }>> {
    const rules = await this.ruleRepo.find({ order: { version: 'DESC' } });

    const result = await Promise.all(
      rules.map(async rule => {
        const count = await this.distributionRepo.count({
          where: { commissionRuleId: rule.id } as any,
        });
        return Object.assign(Object.create(Object.getPrototypeOf(rule)), rule, {
          nbDistributions: count,
        }) as CommissionRule & { nbDistributions: number };
      }),
    );

    return result;
  }
}

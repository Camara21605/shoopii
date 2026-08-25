/* ============================================================
 * SERVICE : admin-commandes.service.ts
 *
 * Commandes de la zone et données financières mensuelles.
 *
 * Commandes : 100 dernières commandes des entreprises de la zone
 *             avec statistiques (taux de réussite, litiges...).
 *
 * Finances  : graphe mensuel sur 5 mois (volume M GNF + commissions)
 *             et 8 derniers flux financiers admin (distributions).
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository }   from 'typeorm';

import { AdminZoneService } from './admin-zone.service';
import { Commande, CommandeStatus }
  from '../../../../database/entities/commande/commande.entity';
import {
  PaiementDistribution,
  DistributionActeurType,
  DistributionStatus,
} from '../../../../database/entities/paiement/paiement-distribution.entity';

import { relTime } from '../helpers/admin.helpers';

/** Labels des mois en français pour l'axe X du graphe financier. */
const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

@Injectable()
export class AdminCommandesService {

  constructor(
    private readonly zoneService: AdminZoneService,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,
  ) {}

  // ── Helpers privés ───────────────────────────────────────────

  /**
   * Traduit le statut interne d'une commande en code court frontend.
   * PENDING + PAID → 'prep', IN_PROGRESS → 'ship', etc.
   */
  private toSt(s: CommandeStatus): string {
    if (s === CommandeStatus.PENDING || s === CommandeStatus.PAID)             return 'prep';
    if (s === CommandeStatus.IN_PROGRESS)                                       return 'ship';
    if (s === CommandeStatus.AWAITING_CLIENT)                                   return 'relay';
    if (s === CommandeStatus.DELIVERED || s === CommandeStatus.AUTO_DELIVERED)  return 'done';
    if (s === CommandeStatus.DISPUTED)                                          return 'dispute';
    return 'prep';
  }

  /**
   * Calcule le numéro d'étape de validation (1–4) d'une commande
   * pour l'indicateur de progression affiché dans le tableau.
   */
  private toProg(s: CommandeStatus): number {
    if (s === CommandeStatus.PENDING || s === CommandeStatus.PAID)             return 1;
    if (s === CommandeStatus.IN_PROGRESS)                                       return 2;
    if (s === CommandeStatus.AWAITING_CLIENT)                                   return 3;
    if (s === CommandeStatus.DELIVERED || s === CommandeStatus.AUTO_DELIVERED)  return 4;
    return 1;
  }

  // ════════════════════════════════════════════════════════════
  // COMMANDES
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne les commandes des entreprises de la zone, paginées et
   * triées par date de création décroissante.
   *
   * Inclut des statistiques agrégées calculées sur TOUTE la zone
   * (pas seulement la page courante — sinon "total"/"tauxRéussite"
   * varieraient selon la page affichée).
   */
  async getCommandes(userId: string, onglet?: 'toutes' | 'encours' | 'litiges', page = 1, limit = 20) {
    const admin = await this.zoneService.adminOf(userId);
    const cids  = await this.zoneService.companyIds(admin.id);

    // Retourne une réponse vide si l'admin n'a pas encore d'entreprises
    if (!cids.length) {
      return {
        list:  [],
        stats: { total: 0, reussies: 0, tauxReussite: 0, enCours: 0, litiges: 0 },
        page, limit, total: 0,
      };
    }

    const safeLimit = Math.min(limit, 100);

    // Select ciblé : jointure sur company pour le nom réel (au lieu
    // d'un UUID tronqué), sans charger le reste de l'entité company.
    const listQb = this.commandeRepo.createQueryBuilder('c')
      .leftJoin('c.company', 'comp')
      .addSelect(['comp.id', 'comp.companyName'])
      .where('c.companyId IN (:...cids)', { cids })
      .orderBy('c.createdAt', 'DESC');

    // Filtre d'onglet — appliqué à la liste ET à son compte total (pour
    // que la pagination reste cohérente avec ce qui est affiché). Les
    // stats globales (4 cartes en haut de page) restent, elles, sur
    // toute la zone quel que soit l'onglet sélectionné.
    if (onglet === 'litiges') {
      listQb.andWhere('c.status = :dispute', { dispute: CommandeStatus.DISPUTED });
    } else if (onglet === 'encours') {
      listQb.andWhere('c.status NOT IN (:...done)', {
        done: [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED, CommandeStatus.DISPUTED],
      });
    }

    const [commandes, listTotal, total, reussies, enCours, litiges] = await Promise.all([
      listQb.clone().skip((page - 1) * safeLimit).take(safeLimit).getMany(),
      listQb.clone().getCount(),
      this.commandeRepo.count({ where: { companyId: In(cids) } }),
      this.commandeRepo.count({ where: { companyId: In(cids), status: In([CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED]) } }),
      this.commandeRepo.count({ where: { companyId: In(cids), status: In([CommandeStatus.IN_PROGRESS, CommandeStatus.AWAITING_CLIENT]) } }),
      this.commandeRepo.count({ where: { companyId: In(cids), status: CommandeStatus.DISPUTED } }),
    ]);

    // Format d'affichage de la date : "15 janv. · 14:30"
    const fmt = (d: Date) =>
      new Date(d).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });

    const list = commandes.map(c => ({
      id:          c.numero ?? `#${c.id.slice(0, 8).toUpperCase()}`,
      quand:       fmt(c.createdAt),
      client:      c.prenomLivraison ?? 'Client',
      entreprise:  (c as any).company?.companyName ?? c.companyId.slice(0, 8),
      montant:     +c.total || 0,
      progression: this.toProg(c.status),
      statut:      this.toSt(c.status),
    }));

    return {
      list,
      stats: {
        total,
        reussies,
        tauxReussite: total > 0 ? Math.round((reussies / total) * 100) : 0,
        enCours,
        litiges,
      },
      // total ici = total filtré par l'onglet (pour la pagination de la
      // liste) ; les 4 cartes stats ci-dessus utilisent la variable
      // `total` zone-wide capturée dans stats.total.
      page, limit: safeLimit, total: listTotal,
    };
  }

  // ════════════════════════════════════════════════════════════
  // FINANCES
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne les données financières de la zone :
   *
   *  • chart  — volume (M GNF) et commissions admin (×0,1M)
   *             sur les 5 derniers mois, par mois calendaire
   *
   *  • flux   — 8 dernières distributions admin (produit + livraison)
   *             avec sens du flux (in / out / refund) et montant signé
   */
  async getFinances(userId: string) {
    const admin = await this.zoneService.adminOf(userId);
    const cids  = await this.zoneService.companyIds(admin.id);
    const now   = new Date();

    // ── Graphe mensuel (5 derniers mois) ──────────────────────
    // Optimisation : avant, 5 itérations séquentielles × 2 requêtes
    // (10 allers-retours DB) ; maintenant, 2 requêtes GROUP BY
    // DATE_TRUNC('month', ...) pour toute la période — même principe
    // que daySlice/weekSlice/quarterSlice dans admin-overview.service.ts.
    const from = new Date(now.getFullYear(), now.getMonth() - 4, 1);

    const [volRows, comRows] = await Promise.all([
      cids.length
        ? this.commandeRepo.createQueryBuilder('c')
            .select("DATE_TRUNC('month', c.createdAt)", 'period')
            .addSelect('COALESCE(SUM(CAST(c.total AS DECIMAL)), 0)', 'v')
            .where('c.companyId IN (:...cids)', { cids })
            .andWhere('c.status IN (:...ok)', {
              ok: [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED],
            })
            .andWhere('c.createdAt >= :from', { from })
            .groupBy("DATE_TRUNC('month', c.createdAt)")
            .getRawMany()
            .catch(() => [])
        : Promise.resolve([]),

      this.distRepo.createQueryBuilder('pd')
        .select("DATE_TRUNC('month', pd.createdAt)", 'period')
        .addSelect('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'v')
        .where('pd.acteurType IN (:...types)', {
          types: [DistributionActeurType.ADMIN_PRODUIT, DistributionActeurType.ADMIN_LIVRAISON],
        })
        .andWhere('pd.status = :distStatus', { distStatus: DistributionStatus.RELEASED })
        .andWhere('pd.adminUserId = :aid', { aid: userId })
        .andWhere('pd.createdAt >= :from', { from })
        .groupBy("DATE_TRUNC('month', pd.createdAt)")
        .getRawMany()
        .catch(() => []),
    ]);

    const toMonthMap = (rows: { period: Date | string; v: string }[]) =>
      new Map<string, number>(
        rows.map(r => [new Date(r.period).toISOString().slice(0, 7), +r.v] as [string, number]),
      );
    const volMap = toMonthMap(volRows);
    const comMap = toMonthMap(comRows);

    const chart: { x: string; a: number; c: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      chart.push({
        x: MONTHS_FR[d.getMonth()],
        a: Math.round((volMap.get(key) ?? 0) / 1_000_000),  // converti en M GNF
        c: Math.round((comMap.get(key) ?? 0) / 100_000),     // converti en ×0,1M GNF
      });
    }

    // ── Flux financiers récents ───────────────────────────────
    const recentDist = await this.distRepo.find({
      where: {
        acteurType:  In([DistributionActeurType.ADMIN_PRODUIT, DistributionActeurType.ADMIN_LIVRAISON]),
        adminUserId: userId,
      },
      order: { createdAt: 'DESC' },
      take: 8,
    });

    const flux = recentDist.map(d => ({
      id:  d.id,
      // RELEASED = entrée (in), CANCELLED = sortie (out), REFUNDED = remboursement
      sens: d.status === DistributionStatus.REFUNDED  ? 'refund'
          : d.status === DistributionStatus.CANCELLED ? 'out' : 'in',
      libelle: `Commission admin sur <b>${d.commandeNumero}</b>`,
      quand:   relTime(d.createdAt),
      // Montant négatif pour les flux sortants
      montant: (d.status === DistributionStatus.REFUNDED || d.status === DistributionStatus.CANCELLED)
             ? -d.montant : d.montant,
    }));

    return { chart, flux };
  }
}

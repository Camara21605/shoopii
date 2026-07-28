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
   * Retourne les 100 dernières commandes des entreprises de la zone,
   * triées par date de création décroissante.
   *
   * Inclut des statistiques agrégées : total, réussies, taux de réussite,
   * en cours et litiges ouverts.
   */
  async getCommandes(userId: string) {
    const admin = await this.zoneService.adminOf(userId);
    const cids  = await this.zoneService.companyIds(admin.id);

    // Retourne une réponse vide si l'admin n'a pas encore d'entreprises
    if (!cids.length) {
      return {
        list:  [],
        stats: { total: 0, reussies: 0, tauxReussite: 0, enCours: 0, litiges: 0 },
      };
    }

    const commandes = await this.commandeRepo.find({
      where: { companyId: In(cids) },
      order: { createdAt: 'DESC' },
      take:  100,
    });

    // Format d'affichage de la date : "15 janv. · 14:30"
    const fmt = (d: Date) =>
      new Date(d).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });

    const list = commandes.map(c => ({
      id:          c.numero ?? `#${c.id.slice(0, 8).toUpperCase()}`,
      quand:       fmt(c.createdAt),
      client:      c.prenomLivraison ?? 'Client',
      entreprise:  c.companyId.slice(0, 8), // ID court tant qu'il n'y a pas de relation chargée
      montant:     +c.total || 0,
      progression: this.toProg(c.status),
      statut:      this.toSt(c.status),
    }));

    const total    = commandes.length;
    const reussies = commandes.filter(c =>
      c.status === CommandeStatus.DELIVERED || c.status === CommandeStatus.AUTO_DELIVERED
    ).length;
    const enCours  = commandes.filter(c =>
      c.status === CommandeStatus.IN_PROGRESS || c.status === CommandeStatus.AWAITING_CLIENT
    ).length;
    const litiges  = commandes.filter(c => c.status === CommandeStatus.DISPUTED).length;

    return {
      list,
      stats: {
        total,
        reussies,
        tauxReussite: total > 0 ? Math.round((reussies / total) * 100) : 0,
        enCours,
        litiges,
      },
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
    const chart: { x: string; a: number; c: number }[] = [];

    for (let i = 4; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mS = new Date(d.getFullYear(), d.getMonth(), 1);               // début du mois
      const mE = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); // fin du mois

      const [volRow, comRow] = await Promise.all([
        // Volume total des commandes livrées dans ce mois
        cids.length
          ? this.commandeRepo.createQueryBuilder('c')
              .select('COALESCE(SUM(CAST(c.total AS DECIMAL)), 0)', 'v')
              .where('c.companyId IN (:...cids)', { cids })
              .andWhere('c.status IN (:...ok)', {
                ok: [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED],
              })
              .andWhere('c.createdAt BETWEEN :mS AND :mE', { mS, mE })
              .getRawOne()
              .catch(() => ({ v: 0 }))
          : Promise.resolve({ v: 0 }),

        // Commissions admin RELEASED dans ce mois (produit + livraison)
        this.distRepo.createQueryBuilder('pd')
          .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'v')
          .where('pd.acteurType IN (:...types)', {
            types: [DistributionActeurType.ADMIN_PRODUIT, DistributionActeurType.ADMIN_LIVRAISON],
          })
          .andWhere('pd.status = :distStatus', { distStatus: DistributionStatus.RELEASED })
          .andWhere('pd.adminUserId = :aid', { aid: userId })
          .andWhere('pd.createdAt BETWEEN :mS AND :mE', { mS, mE })
          .getRawOne()
          .catch(() => ({ v: 0 })),
      ]);

      chart.push({
        x: MONTHS_FR[mS.getMonth()],
        a: Math.round((+volRow?.v || 0) / 1_000_000),  // converti en M GNF
        c: Math.round((+comRow?.v || 0) / 100_000),     // converti en ×0,1M GNF
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

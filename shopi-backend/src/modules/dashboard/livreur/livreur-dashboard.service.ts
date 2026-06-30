/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/livreur-dashboard.service.ts
 *
 * RÔLE : Stats & données overview du dashboard livreur.
 *        getMissions() branché sur la table `commandes`.
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository }   from 'typeorm';

import { Delivery }  from 'src/database/entities/profiles/livreur-profile.entity';
import { Commande, CommandeStatus } from 'src/database/entities/commande/commande.entity';

/** Statuts d'une mission en cours */
const ACTIVE_STATUSES: CommandeStatus[] = [
  CommandeStatus.PAID,
  CommandeStatus.IN_PROGRESS,
  CommandeStatus.AWAITING_CLIENT,
];

/** Statuts d'une mission terminée (historique récent) */
const RECENT_STATUSES: CommandeStatus[] = [
  CommandeStatus.DELIVERED,
  CommandeStatus.AUTO_DELIVERED,
  CommandeStatus.CANCELLED,
  CommandeStatus.DISPUTED,
];

@Injectable()
export class LivreurDashboardService {

  constructor(
    @InjectRepository(Delivery)
    private readonly livreurRepo: Repository<Delivery>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET STATS — KPI du profil livreur
   * ────────────────────────────────────────────────────────── */
  async getStats(userId: string) {
    const livreur = await this.livreurRepo.findOne({
      where: { userId },
      select: [
        'id', 'totalDeliveries', 'totalEarnings',
        'averageRating', 'status', 'verificationStatus',
      ],
    });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');

    return {
      totalDeliveries:    livreur.totalDeliveries,
      totalEarnings:      livreur.totalEarnings,
      averageRating:      livreur.averageRating,
      status:             livreur.status,
      verificationStatus: livreur.verificationStatus,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * GET MISSIONS — actives + historique récent
   *
   * active  : commandes en cours (PAID / IN_PROGRESS / AWAITING_CLIENT)
   * recent  : 10 dernières missions terminées (DELIVERED / CANCELLED…)
   * ────────────────────────────────────────────────────────── */
  async getMissions(userId: string) {
    const livreur = await this.livreurRepo.findOne({
      where:  { userId },
      select: ['id'],
    });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');

    /* Les deux requêtes en parallèle pour éviter la séquentialité */
    const [activeMissions, recentMissions] = await Promise.all([
      this.commandeRepo.find({
        where: { livreurId: livreur.id, status: In(ACTIVE_STATUSES) },
        select: [
          'id', 'numero', 'status', 'modeLivraison',
          'total', 'fraisLivraison', 'villeLivraison', 'adresseLivraison',
          'datelivraisonEstimee', 'createdAt',
        ],
        order: { createdAt: 'DESC' },
      }),

      this.commandeRepo.find({
        where: { livreurId: livreur.id, status: In(RECENT_STATUSES) },
        select: [
          'id', 'numero', 'status', 'modeLivraison',
          'total', 'fraisLivraison', 'villeLivraison',
          'dateLivraisonEffective', 'createdAt',
        ],
        order:  { updatedAt: 'DESC' },
        take:   10,
      }),
    ]);

    return {
      active:    activeMissions.map(c => this.formatMission(c)),
      recent:    recentMissions.map(c => this.formatMission(c)),
      nbActives: activeMissions.length,
    };
  }

  /* ── Format compact d'une mission renvoyé au frontend ── */
  private formatMission(c: Commande) {
    return {
      id:            c.id,
      numero:        c.numero,
      status:        c.status,
      modeLivraison: c.modeLivraison,
      montant:       Number(c.fraisLivraison ?? 0),
      total:         Number(c.total ?? 0),
      destination:   [c.adresseLivraison, c.villeLivraison].filter(Boolean).join(', ') || 'Non précisée',
      dateEstimee:   c.datelivraisonEstimee ?? null,
      dateLivraison: c.dateLivraisonEffective ?? null,
      createdAt:     c.createdAt,
    };
  }
}

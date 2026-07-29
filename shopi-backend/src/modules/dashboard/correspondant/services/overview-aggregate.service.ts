/* ============================================================
 * FICHIER : services/overview-aggregate.service.ts
 * SECTION : Vue d'ensemble (réelle) du correspondant
 *
 * RÔLE : Compose les autres services de ce module pour bâtir
 * la page Overview — aucune agrégation dupliquée, tout est
 * dérivé des commandes réelles de ce correspondant.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';
import { Company } from '../../../../database/entities/profiles/entreprise-profile.entity';

import { ColisManagementService }      from './colis-management.service';
import { BoutiquesManagementService }  from './boutiques-management.service';
import { LivreursManagementService }   from './livreurs-management.service';
import { CorrespondantDashboardService } from '../correspondant-dashboard.service';

const TERMINAL_STATUSES = [
  CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED,
  CommandeStatus.CANCELLED, CommandeStatus.REFUNDED, CommandeStatus.DISPUTED,
];

const STATUS_LABEL: Record<CommandeStatus, string> = {
  [CommandeStatus.PENDING]:         'en attente de paiement',
  [CommandeStatus.PAID]:            'payée, en préparation',
  [CommandeStatus.IN_PROGRESS]:     'en cours de traitement',
  [CommandeStatus.AWAITING_CLIENT]: 'en attente de confirmation client',
  [CommandeStatus.DELIVERED]:       'livrée avec succès',
  [CommandeStatus.CANCELLED]:       'annulée',
  [CommandeStatus.REFUNDED]:        'remboursée',
  [CommandeStatus.DISPUTED]:        'en litige',
  [CommandeStatus.AUTO_DELIVERED]:  'livrée (validation automatique)',
};

@Injectable()
export class OverviewAggregateService {

  constructor(
    @InjectRepository(Correspondent)
    private readonly corRepo: Repository<Correspondent>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    private readonly colisService:      ColisManagementService,
    private readonly boutiquesService:  BoutiquesManagementService,
    private readonly livreursService:   LivreursManagementService,
    private readonly dashboardService:  CorrespondantDashboardService,
  ) {}

  async getOverview(userId: string) {
    const cor = await this.corRepo.findOne({ where: { userId } });
    if (!cor) return this.empty();

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const commandes = await this.commandeRepo.find({
      where: { correspondantId: cor.id },
      order: { createdAt: 'DESC' },
      take:  100,
    });

    const [colis, boutiques, livreurs, revenus] = await Promise.all([
      this.colisService.getColis(userId),
      this.boutiquesService.getBoutiques(userId),
      this.livreursService.getLivreurs(userId),
      this.dashboardService.getRevenus(userId),
    ]);

    const total          = commandes.length;
    const missionsCeMois = commandes.filter(c => c.createdAt >= monthStart).length;
    const closed         = commandes.filter(c => TERMINAL_STATUSES.includes(c.status));
    const isDelivered     = (c: Commande) =>
      c.status === CommandeStatus.DELIVERED || c.status === CommandeStatus.AUTO_DELIVERED;
    const delivered      = commandes.filter(isDelivered).length;
    const livresCeMois   = commandes.filter(c => isDelivered(c) && c.updatedAt >= monthStart).length;
    const tauxSucces     = closed.length > 0 ? Math.round((delivered / closed.length) * 100) : 100;

    // ── Activité récente : 5 dernières commandes → phrase humaine ──
    const recent = commandes.slice(0, 5);
    const companyIds = [...new Set(recent.map(c => c.companyId))];
    const companies  = companyIds.length
      ? await this.companyRepo.find({ where: { id: In(companyIds) } })
      : [];
    const companyMap = new Map(companies.map(c => [c.id, c.companyName]));

    const activite = recent.map(c => ({
      msg: `Colis <b>${c.numero}</b> — ${companyMap.get(c.companyId) ?? 'boutique'} — ${STATUS_LABEL[c.status]}`,
      t:   this.relTime(c.updatedAt),
    }));

    // ── Bandeau colis urgent (le plus ancien colis 'att' non scanné) ──
    // colis.items est trié par createdAt DESC → le dernier urgent = le plus ancien.
    const urgentItems = colis.items.filter(i => i.urgent);
    const urgentColis = urgentItems.length ? urgentItems[urgentItems.length - 1] : null;

    return {
      zoneNom: cor.zone || cor.depotVille || 'Zone',
      kpis: {
        missionsTotales:    total,
        revenusCeMois:      revenus.revenusThisMonth,
        tauxSucces,
        partenairesActifs:  boutiques.stats.total + livreurs.stats.total,
      },
      relayFlow: {
        sources:      boutiques.stats.total,
        destinations: livreurs.stats.total,
      },
      activite,
      colisUrgent: urgentColis,
      colisCounts: {
        att:   colis.counts.att,
        stock: colis.counts.stock,
        dep:   colis.counts.dep,
        ret:   colis.counts.ret,
      },
      livresCeMois: livresCeMois,
      objectifs: {
        missionsCeMois,
        revenusCeMois: revenus.revenusThisMonth,
        tauxSucces,
      },
    };
  }

  /**
   * Note moyenne + total missions — colonnes réelles de Correspondent,
   * mais actuellement jamais alimentées par un système d'avis (aucune
   * table review n'existe encore pour les correspondants).
   */
  async getEvaluation(userId: string) {
    const cor = await this.corRepo.findOne({ where: { userId } });
    return {
      averageRating: +(cor?.averageRating ?? 0),
      totalMissions: cor?.totalMissions ?? 0,
    };
  }

  private relTime(d: Date): string {
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (diffMin < 1)   return "À l'instant";
    if (diffMin < 60)  return `Il y a ${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    if (h < 24) return `Il y a ${h}h`;
    const days = Math.floor(h / 24);
    return `Il y a ${days}j`;
  }

  private empty() {
    return {
      zoneNom: 'Zone',
      kpis: { missionsTotales: 0, revenusCeMois: 0, tauxSucces: 100, partenairesActifs: 0 },
      relayFlow: { sources: 0, destinations: 0 },
      activite: [],
      colisUrgent: null,
      colisCounts: { att: 0, stock: 0, dep: 0, ret: 0 },
      livresCeMois: 0,
      objectifs: { missionsCeMois: 0, revenusCeMois: 0, tauxSucces: 100 },
    };
  }
}

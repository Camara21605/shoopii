/* ============================================================
 * SERVICE : admin-clients.service.ts
 *
 * Liste (lecture seule) des clients ayant commandé auprès d'une
 * entreprise de la zone de cet admin.
 *
 * Particularité : Client n'a pas de colonne adminId (contrairement
 * à Partner/Company/Delivery) — un client n'appartient à aucune
 * zone en propre. Le rattachement se fait donc via les commandes :
 *   admin → companyIds (zone) → Commande.companyId IN cids → clientId
 * Un même client peut apparaître dans plusieurs zones s'il commande
 * aussi auprès d'entreprises rattachées à d'autres admins — c'est
 * une vue "clients actifs dans cette zone", pas une propriété exclusive.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AdminZoneService } from './admin-zone.service';
import { Client, ClientStatus } from '../../../../database/entities/profiles/client-profile.entity';
import { Commande } from '../../../../database/entities/commande/commande.entity';
import { initials, fmtDate } from '../helpers/admin.helpers';

/** Traduit ClientStatus en code court cohérent avec les autres pages (act/pend/susp). */
function mapClientSt(status: ClientStatus): string {
  if (status === ClientStatus.ACTIVE) return 'act';
  if (status === ClientStatus.SUSPENDED || status === ClientStatus.BANNED) return 'susp';
  return 'pend';
}

@Injectable()
export class AdminClientsService {

  constructor(
    private readonly zoneService: AdminZoneService,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,
  ) {}

  /**
   * Liste les clients ayant au moins une commande auprès d'une
   * entreprise de la zone, avec leurs stats agrégées DANS la zone
   * (nb commandes, montant total, dernière commande) — pas leurs
   * stats globales (Client.totalOrders/totalSpent incluent aussi
   * les commandes hors zone).
   */
  async getClients(userId: string, search?: string, page = 1, limit = 20) {
    const admin = await this.zoneService.adminOf(userId);
    const cids  = await this.zoneService.companyIds(admin.id);

    if (!cids.length) {
      return { stats: { total: 0 }, list: [] };
    }

    // Agrégation par client, zone-scopée, plafonnée à 200 clients
    // (les plus actifs récemment — cohérent avec le plafond des
    // autres listes de ce module).
    const rows = await this.commandeRepo.createQueryBuilder('c')
      .select('c.clientId', 'clientId')
      .addSelect('COUNT(*)', 'nbCommandes')
      .addSelect('COALESCE(SUM(CAST(c.total AS DECIMAL)), 0)', 'montantTotal')
      .addSelect('MAX(c.createdAt)', 'derniereCommande')
      .where('c.companyId IN (:...cids)', { cids })
      .groupBy('c.clientId')
      .orderBy('MAX(c.createdAt)', 'DESC')
      .limit(200)
      .getRawMany();

    if (!rows.length) {
      return { stats: { total: 0 }, list: [] };
    }

    const clientIds = rows.map(r => r.clientId);
    const clients = await this.clientRepo.find({
      where: { id: In(clientIds) },
      relations: ['user'],
    });
    const clientMap = new Map(clients.map(c => [c.id, c]));

    let list = rows.map(r => {
      const cl   = clientMap.get(r.clientId);
      const nom  = cl?.fullName || (cl?.user ? `${cl.user.firstName ?? ''} ${cl.user.lastName ?? ''}`.trim() : '') || 'Client inconnu';
      return {
        id:               r.clientId,
        nom,
        avatar:           initials(nom),
        telephone:        cl?.user?.phone ?? '—',
        statut:           cl ? mapClientSt(cl.status) : 'pend',
        nbCommandes:      +r.nbCommandes,
        montantTotal:     Math.round(+r.montantTotal),
        derniereCommande: fmtDate(r.derniereCommande),
      };
    });

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        c.nom.toLowerCase().includes(q) || c.telephone.includes(q),
      );
    }

    const safeLimit = Math.min(limit, 100);
    const start = (page - 1) * safeLimit;
    const paged = list.slice(start, start + safeLimit);

    return {
      stats: { total: list.length },
      list: paged,
      page, limit: safeLimit, total: list.length,
    };
  }
}

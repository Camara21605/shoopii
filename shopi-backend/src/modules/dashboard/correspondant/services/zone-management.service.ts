/* ============================================================
 * FICHIER : services/zone-management.service.ts
 * SECTION : Zone de couverture (réelle) du correspondant
 *
 * RÔLE : Statistiques par commune, dérivées des commandes
 * réellement routées via ce correspondant (communeLivraison
 * est un champ réel de Commande, renseigné à la création).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';

export interface ICommuneStat {
  commune:  string;
  colis:    number;
  livreurs: number;
  succes:   string;
}

export interface IZoneResult {
  typeCorrespondant: string;
  zonesActives:      string[];
  communes:           ICommuneStat[];
  stats: {
    communesCouvertes: number;
    livreursActifs:    number;
    tauxCouverture:    string;
  };
}

@Injectable()
export class ZoneManagementService {

  constructor(
    @InjectRepository(Correspondent)
    private readonly corRepo: Repository<Correspondent>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,
  ) {}

  async getZone(userId: string): Promise<IZoneResult> {
    const cor = await this.corRepo.findOne({ where: { userId } });
    if (!cor) return this.empty();

    const commandes = await this.commandeRepo.find({
      where: { correspondantId: cor.id },
      select: ['id', 'communeLivraison', 'livreurId', 'status'],
    });

    const zonesActives = cor.zonesActives ?? [];

    if (!commandes.length) {
      return {
        typeCorrespondant: cor.typeCorrespondant,
        zonesActives,
        communes: [],
        stats: { communesCouvertes: zonesActives.length, livreursActifs: 0, tauxCouverture: '—' },
      };
    }

    const byCommune = new Map<string, Commande[]>();
    for (const c of commandes) {
      const key = c.communeLivraison ?? 'Non renseignée';
      if (!byCommune.has(key)) byCommune.set(key, []);
      byCommune.get(key)!.push(c);
    }

    const communes: ICommuneStat[] = [...byCommune.entries()].map(([commune, rows]) => {
      const livreurs   = new Set(rows.map(r => r.livreurId).filter(Boolean)).size;
      const delivered  = rows.filter(r =>
        r.status === CommandeStatus.DELIVERED || r.status === CommandeStatus.AUTO_DELIVERED,
      ).length;
      const closed     = rows.filter(r =>
        [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED, CommandeStatus.CANCELLED,
         CommandeStatus.REFUNDED, CommandeStatus.DISPUTED].includes(r.status),
      ).length;

      return {
        commune,
        colis:    rows.length,
        livreurs,
        succes:   closed > 0 ? `${Math.round((delivered / closed) * 100)}%` : '—',
      };
    }).sort((a, b) => b.colis - a.colis);

    const totalDelivered = commandes.filter(c =>
      c.status === CommandeStatus.DELIVERED || c.status === CommandeStatus.AUTO_DELIVERED,
    ).length;
    const totalClosed = commandes.filter(c =>
      [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED, CommandeStatus.CANCELLED,
       CommandeStatus.REFUNDED, CommandeStatus.DISPUTED].includes(c.status),
    ).length;
    const livreursActifs = new Set(commandes.map(c => c.livreurId).filter(Boolean)).size;

    return {
      typeCorrespondant: cor.typeCorrespondant,
      zonesActives,
      communes,
      stats: {
        communesCouvertes: zonesActives.length || byCommune.size,
        livreursActifs,
        tauxCouverture: totalClosed > 0 ? `${Math.round((totalDelivered / totalClosed) * 100)}%` : '—',
      },
    };
  }

  private empty(): IZoneResult {
    return {
      typeCorrespondant: 'regional',
      zonesActives: [],
      communes: [],
      stats: { communesCouvertes: 0, livreursActifs: 0, tauxCouverture: '—' },
    };
  }
}

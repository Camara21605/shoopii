/* ============================================================
 * FICHIER : services/boutiques-management.service.ts
 * SECTION : Boutiques partenaires (réelles) du livreur
 *
 * RÔLE : Liste les boutiques (Company) avec lesquelles CE livreur
 * a réellement effectué des livraisons — dérivé des commandes où
 * commande.livreurId = son id, jamais une liste statique de
 * "partenaires". Même principe que l'équivalent correspondant
 * (services/boutiques-management.service.ts du dashboard
 * correspondant), adapté au vocabulaire livreur (livraisons).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Delivery } from '../../../../database/entities/profiles/livreur-profile.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';
import { Company } from '../../../../database/entities/profiles/entreprise-profile.entity';

export interface IBoutiqueItem {
  id:      string;
  nm:      string;
  em:      string;
  logo:    string | null;
  cat:     string;
  rat:     number;
  delivs:  number;
  pending: number;
  since:   string;
}

export interface IBoutiquesResult {
  items:           IBoutiqueItem[];
  totalDeliveries: number;
}

const DELIVERED_STATUSES = [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED];
const ACTIVE_STATUSES    = [CommandeStatus.PAID, CommandeStatus.IN_PROGRESS, CommandeStatus.AWAITING_CLIENT];

@Injectable()
export class BoutiquesManagementService {

  constructor(
    @InjectRepository(Delivery)
    private readonly livreurRepo: Repository<Delivery>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async getBoutiques(userId: string): Promise<IBoutiquesResult> {
    const livreur = await this.livreurRepo.findOne({ where: { userId } });
    if (!livreur) return this.empty();

    const commandes = await this.commandeRepo.find({
      where: { livreurId: livreur.id },
      select: ['id', 'companyId', 'status', 'createdAt'],
    });
    if (!commandes.length) return this.empty();

    const companyIds = [...new Set(commandes.map(c => c.companyId))];
    const companies  = await this.companyRepo.find({
      where: { id: In(companyIds) },
      relations: ['categories'],
    });
    const companyMap = new Map(companies.map(c => [c.id, c]));

    const items: IBoutiqueItem[] = companyIds.map(id => {
      const company  = companyMap.get(id);
      const rows      = commandes.filter(c => c.companyId === id);
      const delivs    = rows.filter(c => DELIVERED_STATUSES.includes(c.status)).length;
      const pending   = rows.filter(c => ACTIVE_STATUSES.includes(c.status)).length;
      const firstRow  = rows.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
      const cat       = company?.categories?.[0];

      return {
        id:      id,
        nm:      company?.companyName ?? 'Boutique',
        em:      cat?.icone ?? '🏪',
        logo:    company?.logo ?? null,
        cat:     cat?.nom ?? 'Divers',
        rat:     +(company?.averageRating ?? 0),
        delivs,
        pending,
        since:   firstRow.createdAt.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      };
    });

    const totalDeliveries = items.reduce((s, b) => s + b.delivs, 0);

    return { items, totalDeliveries };
  }

  private empty(): IBoutiquesResult {
    return { items: [], totalDeliveries: 0 };
  }
}

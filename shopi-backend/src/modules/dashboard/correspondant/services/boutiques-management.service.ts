/* ============================================================
 * FICHIER : services/boutiques-management.service.ts
 * SECTION : Boutiques partenaires (réelles) du correspondant
 *
 * RÔLE : Liste les boutiques (Company) avec lesquelles CE
 * correspondant a réellement traité des colis — dérivé des
 * commandes où commande.correspondantId = son id, jamais une
 * liste statique de "partenaires".
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';
import { Company } from '../../../../database/entities/profiles/entreprise-profile.entity';

export interface IBoutiqueItem {
  nm:      string;
  em:      string;
  cat:     string;
  rat:     number;
  colis:   number;
  pending: number;
  since:   string;
}

export interface IBoutiquesResult {
  items: IBoutiqueItem[];
  stats: {
    total:       number;
    colisActifs: number;
    enAttente:   number;
    noteMoyenne: number;
  };
}

const TERMINAL_STATUSES = [
  CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED,
  CommandeStatus.CANCELLED, CommandeStatus.REFUNDED,
];

@Injectable()
export class BoutiquesManagementService {

  constructor(
    @InjectRepository(Correspondent)
    private readonly corRepo: Repository<Correspondent>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async getBoutiques(userId: string): Promise<IBoutiquesResult> {
    const cor = await this.corRepo.findOne({ where: { userId } });
    if (!cor) return this.empty();

    const commandes = await this.commandeRepo.find({
      where: { correspondantId: cor.id },
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
      const company = companyMap.get(id);
      const rows     = commandes.filter(c => c.companyId === id);
      const colis    = rows.filter(c => !TERMINAL_STATUSES.includes(c.status)).length;
      const pending  = rows.filter(c => c.status === CommandeStatus.PENDING || c.status === CommandeStatus.PAID).length;
      const firstRow = rows.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
      const cat      = company?.categories?.[0];

      return {
        nm:      company?.companyName ?? 'Boutique',
        em:      cat?.icone ?? '🏪',
        cat:     cat?.nom ?? 'Divers',
        rat:     +(company?.averageRating ?? 0),
        colis,
        pending,
        since:   firstRow.createdAt.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      };
    });

    const totalColis   = items.reduce((s, b) => s + b.colis, 0);
    const totalPending  = items.reduce((s, b) => s + b.pending, 0);
    const noteMoyenne   = items.length
      ? +(items.reduce((s, b) => s + b.rat, 0) / items.length).toFixed(2)
      : 0;

    return {
      items,
      stats: { total: items.length, colisActifs: totalColis, enAttente: totalPending, noteMoyenne },
    };
  }

  private empty(): IBoutiquesResult {
    return { items: [], stats: { total: 0, colisActifs: 0, enAttente: 0, noteMoyenne: 0 } };
  }
}

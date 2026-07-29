/* ============================================================
 * FICHIER : services/livreurs-management.service.ts
 * SECTION : Livreurs locaux (réels) du correspondant
 *
 * RÔLE : Liste les livreurs auxquels CE correspondant a
 * réellement remis des colis — dérivé des commandes où
 * commande.correspondantId = son id ET commande.livreurId
 * est renseigné (mode mixte correspondant + livreur).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';
import { Delivery } from '../../../../database/entities/profiles/livreur-profile.entity';
import { PresenceService } from '../../../messagerie/services/presence.service';

export interface ILivreurItem {
  nm:       string;
  em:       string;
  zone:     string;
  rat:      number;
  missions: number;
  online:   boolean;
  pending:  number;
}

export interface ILivreursResult {
  items: ILivreurItem[];
  stats: {
    total:          number;
    enLigne:        number;
    missionsCeMois: number;
  };
}

@Injectable()
export class LivreursManagementService {

  constructor(
    @InjectRepository(Correspondent)
    private readonly corRepo: Repository<Correspondent>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    private readonly presence: PresenceService,
  ) {}

  async getLivreurs(userId: string): Promise<ILivreursResult> {
    const cor = await this.corRepo.findOne({ where: { userId } });
    if (!cor) return this.empty();

    const commandes = await this.commandeRepo.find({
      where: { correspondantId: cor.id },
      select: ['id', 'livreurId', 'status', 'createdAt'],
    });

    const withLivreur = commandes.filter((c): c is Commande & { livreurId: string } => !!c.livreurId);
    if (!withLivreur.length) return this.empty();

    const livreurIds = [...new Set(withLivreur.map(c => c.livreurId))];
    const deliveries = await this.deliveryRepo.find({ where: { id: In(livreurIds) } });

    const presenceMap = await this.presence.getBulkPresence(deliveries.map(d => d.userId));

    const now      = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const items: ILivreurItem[] = deliveries.map(d => {
      const rows      = withLivreur.filter(c => c.livreurId === d.id);
      const missions  = rows.filter(c =>
        c.status === CommandeStatus.DELIVERED || c.status === CommandeStatus.AUTO_DELIVERED,
      ).length;
      const pending   = rows.filter(c =>
        c.status !== CommandeStatus.DELIVERED && c.status !== CommandeStatus.AUTO_DELIVERED
        && c.status !== CommandeStatus.CANCELLED && c.status !== CommandeStatus.REFUNDED,
      ).length;

      return {
        nm:       d.fullName,
        em:       d.deliveryEmoji,
        zone:     d.ville ?? 'Zone non renseignée',
        rat:      +(d.averageRating ?? 0),
        missions,
        online:   presenceMap.get(d.userId)?.online === true,
        pending,
      };
    });

    const missionsCeMois = withLivreur.filter(c =>
      c.createdAt >= monthStart
      && (c.status === CommandeStatus.DELIVERED || c.status === CommandeStatus.AUTO_DELIVERED),
    ).length;

    return {
      items,
      stats: {
        total:   items.length,
        enLigne: items.filter(i => i.online).length,
        missionsCeMois,
      },
    };
  }

  private empty(): ILivreursResult {
    return { items: [], stats: { total: 0, enLigne: 0, missionsCeMois: 0 } };
  }
}

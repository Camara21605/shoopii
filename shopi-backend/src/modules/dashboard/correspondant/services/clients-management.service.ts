/* ============================================================
 * FICHIER : services/clients-management.service.ts
 * SECTION : Clients (réels) servis via ce correspondant
 *
 * RÔLE : Liste les clients dont AU MOINS UNE commande est
 * passée par ce correspondant (commande.correspondantId = son id).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';
import { Client } from '../../../../database/entities/profiles/client-profile.entity';

export type ClientColisStatut = 'att' | 'retour' | 'ok';

export interface IClientItem {
  nm:      string;
  tel:     string;
  colis:   number;
  dernier: string;
  val:     number;
  status:  ClientColisStatut;
}

@Injectable()
export class ClientsManagementService {

  constructor(
    @InjectRepository(Correspondent)
    private readonly corRepo: Repository<Correspondent>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async getClients(userId: string): Promise<IClientItem[]> {
    const cor = await this.corRepo.findOne({ where: { userId } });
    if (!cor) return [];

    const commandes = await this.commandeRepo.find({
      where: { correspondantId: cor.id },
      order: { createdAt: 'DESC' },
    });
    if (!commandes.length) return [];

    const clientIds = [...new Set(commandes.map(c => c.clientId))];
    const clients   = await this.clientRepo.find({
      where: { id: In(clientIds) },
      relations: ['user'],
    });

    return clients.map(cl => {
      const rows   = commandes.filter(c => c.clientId === cl.id);
      const latest = rows[0]; // déjà trié DESC
      const u      = (cl as any).user;
      const name   = cl.fullName?.trim() || (u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '') || 'Client';

      return {
        nm:      name,
        tel:     u?.phone ?? '—',
        colis:   rows.length,
        dernier: this.formatDate(latest.createdAt),
        val:     rows.reduce((s, c) => s + +c.total, 0),
        status:  this.resolveStatus(latest),
      };
    });
  }

  private resolveStatus(latest: Commande): ClientColisStatut {
    if ([CommandeStatus.CANCELLED, CommandeStatus.REFUNDED, CommandeStatus.DISPUTED].includes(latest.status)) {
      return 'retour';
    }
    if ([CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED].includes(latest.status)) {
      return 'ok';
    }
    return 'att';
  }

  private formatDate(d: Date): string {
    const today      = new Date();
    const isToday     = d.toDateString() === today.toDateString();
    const yesterday   = new Date(today); yesterday.setDate(today.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday)     return 'Auj.';
    if (isYesterday) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '') + '.';
  }
}

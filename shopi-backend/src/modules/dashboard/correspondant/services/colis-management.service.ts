/* ============================================================
 * FICHIER : services/colis-management.service.ts
 * SECTION : Gestion des colis (commandes) du correspondant
 *
 * RÔLE : Liste les commandes dans lesquelles CE correspondant
 * est réellement impliqué (commande.correspondantId = son id),
 * avec un statut "colis" dérivé du statut de la commande +
 * du statut de son propre code de validation.
 *
 * ─── MAPPING STATUT COLIS ────────────────────────────────────
 *
 *  commande annulée / remboursée / litige     → 'ret'   (Retour)
 *  commande livrée (DELIVERED/AUTO_DELIVERED) → 'livr'  (Livré)
 *  code correspondant pas encore validé       → 'att'   (Arrivé — en attente de scan)
 *  code validé + livreur assigné (mode mixte) → 'dep'   (Dispatché vers le livreur)
 *  code validé + pas de livreur               → 'stock' (En stock, attend retrait client)
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';
import { CommandeCode, CodeActeurType, CodeCommandeStatus } from '../../../../database/entities/commande/commande-code.entity';
import { Company }  from '../../../../database/entities/profiles/entreprise-profile.entity';
import { Client }   from '../../../../database/entities/profiles/client-profile.entity';
import { Delivery } from '../../../../database/entities/profiles/livreur-profile.entity';

export type ColisStatus = 'att' | 'stock' | 'dep' | 'ret' | 'livr';

export interface IColisItem {
  id:       string;
  em:       string;
  nm:       string;
  boutique: string;
  client:   string;
  valeur:   number;
  date:     string;
  status:   ColisStatus;
  urgent:   boolean;
  /** Livreur auquel ce colis a été remis (mode mixte) — null sinon */
  livreur:  string | null;
  /** Motif du retour, uniquement quand status === 'ret' */
  motif:    string | null;
}

export interface IColisListResult {
  items:  IColisItem[];
  counts: Record<'all' | ColisStatus, number>;
}

@Injectable()
export class ColisManagementService {

  constructor(
    @InjectRepository(Correspondent)
    private readonly corRepo: Repository<Correspondent>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(CommandeCode)
    private readonly codeRepo: Repository<CommandeCode>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,
  ) {}

  /**
   * Retourne uniquement les commandes où ce correspondant est
   * le point relais désigné (commande.correspondantId = cor.id).
   * Aucun autre correspondant ne peut voir ces colis.
   */
  async getColis(userId: string): Promise<IColisListResult> {
    const cor = await this.corRepo.findOne({ where: { userId } });
    if (!cor) return { items: [], counts: this.emptyCounts() };

    const commandes = await this.commandeRepo.find({
      where:  { correspondantId: cor.id },
      relations: ['items'],
      order:  { createdAt: 'DESC' },
      take:   200,
    });

    if (!commandes.length) return { items: [], counts: this.emptyCounts() };

    const companyIds  = [...new Set(commandes.map(c => c.companyId))];
    const clientIds   = [...new Set(commandes.map(c => c.clientId))];
    const livreurIds  = [...new Set(commandes.map(c => c.livreurId).filter((id): id is string => !!id))];
    const commandeIds = commandes.map(c => c.id);

    const [companies, clients, deliveries, codes] = await Promise.all([
      this.companyRepo.find({ where: { id: In(companyIds) } }),
      this.clientRepo.find({ where: { id: In(clientIds) }, relations: ['user'] }),
      livreurIds.length ? this.deliveryRepo.find({ where: { id: In(livreurIds) } }) : Promise.resolve([]),
      this.codeRepo.find({
        where: { commandeId: In(commandeIds), acteurType: CodeActeurType.CORRESPONDANT },
      }),
    ]);

    const companyMap  = new Map(companies.map(c => [c.id, c.companyName]));
    const clientMap   = new Map(clients.map(c => {
      const u = (c as any).user;
      const name = c.fullName?.trim() || (u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '') || 'Client';
      return [c.id, name];
    }));
    const deliveryMap = new Map(deliveries.map(d => [d.id, d.fullName]));
    const codeMap     = new Map(codes.map(c => [c.commandeId, c]));

    const now = Date.now();
    const items: IColisItem[] = commandes.map(c => {
      const code   = codeMap.get(c.id) ?? null;
      const status = this.resolveStatus(c, code);
      const firstItem = c.items?.[0];
      const extra     = (c.items?.length ?? 0) > 1 ? ` +${c.items.length - 1}` : '';

      const urgent = status === 'att'
        && !!code
        && (now - code.createdAt.getTime()) / 86_400_000 > (cor.colisDelaiMax || 3);

      return {
        id:       c.numero,
        em:       '📦',
        nm:       (firstItem?.nomProduit ?? 'Colis') + extra,
        boutique: companyMap.get(c.companyId) ?? 'Boutique',
        client:   clientMap.get(c.clientId)   ?? 'Client',
        valeur:   +c.total,
        date:     this.formatDate(c.createdAt),
        status,
        urgent,
        livreur:  c.livreurId ? (deliveryMap.get(c.livreurId) ?? null) : null,
        motif:    status === 'ret' ? this.resolveMotif(c) : null,
      };
    });

    return { items, counts: this.buildCounts(items) };
  }

  // ── Helpers privés ────────────────────────────────────────

  private resolveStatus(c: Commande, code: CommandeCode | null): ColisStatus {
    if ([CommandeStatus.CANCELLED, CommandeStatus.REFUNDED, CommandeStatus.DISPUTED].includes(c.status)) {
      return 'ret';
    }
    if ([CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED].includes(c.status)) {
      return 'livr';
    }
    if (!code || code.status === CodeCommandeStatus.PENDING) {
      return 'att';
    }
    if (code.status === CodeCommandeStatus.VALIDATED) {
      return c.livreurId ? 'dep' : 'stock';
    }
    // EXPIRED / CANCELLED — traité comme un retour à gérer
    return 'ret';
  }

  private resolveMotif(c: Commande): string {
    switch (c.status) {
      case CommandeStatus.CANCELLED: return 'Commande annulée';
      case CommandeStatus.REFUNDED:  return 'Remboursement effectué';
      case CommandeStatus.DISPUTED:  return 'Litige ouvert';
      default:                       return 'Code expiré / non traité';
    }
  }

  private formatDate(d: Date): string {
    const today     = new Date();
    const isToday    = d.toDateString() === today.toDateString();
    const yesterday  = new Date(today); yesterday.setDate(today.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday)     return `Auj. ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    if (isYesterday) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '') + '.';
  }

  private emptyCounts(): Record<'all' | ColisStatus, number> {
    return { all: 0, att: 0, stock: 0, dep: 0, ret: 0, livr: 0 };
  }

  private buildCounts(items: IColisItem[]): Record<'all' | ColisStatus, number> {
    const counts = this.emptyCounts();
    counts.all = items.length;
    for (const it of items) counts[it.status]++;
    return counts;
  }
}

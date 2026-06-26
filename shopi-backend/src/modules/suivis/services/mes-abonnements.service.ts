/* ============================================================
 * FICHIER : src/modules/suivis/services/mes-abonnements.service.ts
 *
 * RÔLE : Récupérer TOUS les abonnements actifs d'un client,
 *        groupés par type (entreprises / livreurs / correspondants),
 *        enrichis avec les infos publiques de chaque entité suivie.
 *
 * DIFFÉRENCE avec les autres services suivis :
 *   - Les SuivisXxxService listent TOUTES les cibles + isSuivi
 *   - CE service liste UNIQUEMENT les cibles réellement suivies
 *     par le client (isSubscribed = true), pour la page profil.
 *
 * RÉUTILISE : la table `follows` directement (followerType=client).
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }              from '@nestjs/typeorm';
import { In, Repository }                from 'typeorm';

import {
  Follow, FollowerActorType, FollowStatus, TargetActorType,
} from '../../../database/entities/follow/follow.entity';
import { Client }        from '../../../database/entities/profiles/client-profile.entity';
import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';

/* ── Forme d'un abonnement renvoyé au frontend ── */
export interface AbonnementItem {
  id:        string;                 // id de l'entité suivie
  nom:       string;
  categorie: string;                 // ex. "Kaloum · Dixinn" ou "Électronique"
  emoji:     string;                 // emoji par défaut selon le type
  abonnes:   number;                 // nombre de followers de la cible
  note:      number;                 // note moyenne
  type:      'boutiques' | 'livreurs' | 'correspondants';
  suivi:     boolean;                // toujours true ici (ce sont des abonnements)
}

export interface MesAbonnementsResponse {
  boutiques:      AbonnementItem[];
  livreurs:       AbonnementItem[];
  correspondants: AbonnementItem[];
}

@Injectable()
export class MesAbonnementsService {

  constructor(
    @InjectRepository(Follow)        private readonly followRepo:  Repository<Follow>,
    @InjectRepository(Client)        private readonly clientRepo:  Repository<Client>,
    @InjectRepository(Company)       private readonly companyRepo: Repository<Company>,
    @InjectRepository(Delivery)      private readonly delivRepo:   Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly corrRepo:    Repository<Correspondent>,
  ) {}

  /**
   * Récupère les abonnements du client connecté, groupés par type.
   * @param userId  ID du user (JWT)
   */
  async getMesAbonnements(userId: string): Promise<MesAbonnementsResponse> {

    /* 1. Trouver le profil client (followerId) à partir du userId */
    const client = await this.clientRepo.findOne({ where: { userId }, select: ['id'] });
    if (!client) throw new NotFoundException('Profil client introuvable.');
    const followerId = client.id;

    /* 2. Charger TOUTES les lignes follows actives de ce client, tous types */
    const follows = await this.followRepo.find({
      where: {
        followerType: FollowerActorType.CLIENT,
        followerId,
        isSubscribed: true,
        status:       FollowStatus.ACTIVE,
      },
      select: ['targetType', 'targetId'],
    });

    /* 3. Séparer les IDs par type de cible */
    const companyIds = follows.filter(f => f.targetType === TargetActorType.COMPANY).map(f => f.targetId);
    const delivIds   = follows.filter(f => f.targetType === TargetActorType.DELIVERY).map(f => f.targetId);
    const corrIds    = follows.filter(f => f.targetType === TargetActorType.CORRESPONDENT).map(f => f.targetId);

    /* 4. Charger les infos de chaque type en parallèle + compter leurs followers */
    const [boutiques, livreurs, correspondants] = await Promise.all([
      this.loadCompanies(companyIds),
      this.loadDeliveries(delivIds),
      this.loadCorrespondents(corrIds),
    ]);

    return { boutiques, livreurs, correspondants };
  }

  /* ── Charger les entreprises suivies ── */
  private async loadCompanies(ids: string[]): Promise<AbonnementItem[]> {
    if (ids.length === 0) return [];

    const companies = await this.companyRepo.find({
      where:  { id: In(ids) },
      select: ['id', 'companyName', 'description', 'commune', 'ville'] as any,
    });

    /* Compter les abonnés de chaque entreprise en une requête groupée */
    const counts = await this.countFollowers(TargetActorType.COMPANY, ids);

    return companies.map(co => ({
      id:        co.id,
      nom:       (co as any).companyName ?? 'Entreprise',
      categorie: (co as any).description
                   ? String((co as any).description).slice(0, 40)
                   : [(co as any).commune, (co as any).ville].filter(Boolean).join(', ') || 'Boutique',
      emoji:     '🏪',
      abonnes:   counts[co.id] ?? 0,
      note:      0,                         // pas de note entreprise pour l'instant
      type:      'boutiques' as const,
      suivi:     true,
    }));
  }

  /* ── Charger les livreurs suivis ── */
  private async loadDeliveries(ids: string[]): Promise<AbonnementItem[]> {
    if (ids.length === 0) return [];

    const livreurs = await this.delivRepo.find({
      where:  { id: In(ids) },
      select: ['id', 'fullName', 'zone', 'averageRating'] as any,
    });

    const counts = await this.countFollowers(TargetActorType.DELIVERY, ids);

    return livreurs.map(d => ({
      id:        d.id,
      nom:       (d as any).fullName ?? 'Livreur',
      categorie: (d as any).zone ?? 'Conakry',
      emoji:     '🛵',
      abonnes:   counts[d.id] ?? 0,
      note:      Number((d as any).averageRating ?? 0),
      type:      'livreurs' as const,
      suivi:     true,
    }));
  }

  /* ── Charger les correspondants suivis ── */
  private async loadCorrespondents(ids: string[]): Promise<AbonnementItem[]> {
    if (ids.length === 0) return [];

    const corrs = await this.corrRepo.find({
      where:  { id: In(ids) },
      select: ['id', 'fullName', 'depotCommune', 'depotVille', 'averageRating'] as any,
    });

    const counts = await this.countFollowers(TargetActorType.CORRESPONDENT, ids);

    return corrs.map(c => ({
      id:        c.id,
      nom:       (c as any).fullName ?? 'Correspondant',
      categorie: [(c as any).depotCommune, (c as any).depotVille].filter(Boolean).join(', ') || 'Conakry',
      emoji:     '🤝',
      abonnes:   counts[c.id] ?? 0,
      note:      Number((c as any).averageRating ?? 0),
      type:      'correspondants' as const,
      suivi:     true,
    }));
  }

  /* ── Compter les followers de plusieurs cibles en une requête ──
   * Renvoie un objet { targetId: nombre } */
  private async countFollowers(
    targetType: TargetActorType,
    targetIds:  string[],
  ): Promise<Record<string, number>> {
    if (targetIds.length === 0) return {};

    const rows = await this.followRepo
      .createQueryBuilder('f')
      .select('f.targetId', 'targetId')
      .addSelect('COUNT(*)', 'count')
      .where('f.targetType = :targetType', { targetType })
      .andWhere('f.targetId IN (:...ids)', { ids: targetIds })
      .andWhere('f.isSubscribed = :sub', { sub: true })
      .andWhere('f.status = :st', { st: FollowStatus.ACTIVE })
      .groupBy('f.targetId')
      .getRawMany();

    const result: Record<string, number> = {};
    for (const r of rows) result[r.targetId] = parseInt(r.count, 10);
    return result;
  }
}
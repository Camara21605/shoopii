/* ============================================================
 * FICHIER : src/modules/suivis/services/suivis-entreprise.service.ts
 *
 * Service spécialisé pour suivre/désabonner des ENTREPRISES.
 * targetType = COMPANY
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue }      from '@nestjs/bullmq';
import { InjectRedis }      from '@nestjs-modules/ioredis';
import { Repository }       from 'typeorm';
import { Queue }            from 'bullmq';
import { Redis }            from 'ioredis';

import { Follow, FollowStatus, TargetActorType } from '../../../database/entities/follow/follow.entity';
import { FollowBlock }       from '../../../database/entities/follow/follow-block.entity';
import { User }              from '../../../database/entities/user.entity';
import { Client }            from '../../../database/entities/profiles/client-profile.entity';
import { Company }           from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }          from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent }     from '../../../database/entities/profiles/correspondant-profile.entity';

import { SuivisBaseService } from './suivis-base.service';
import { SuivisGateway }     from '../gateways/suivis.gateway';
import { SUIVIS_QUEUE }      from '../suivis.queue';
import { UserRole }          from '../../../common/enums/user-role.enum';

@Injectable()
export class SuivisEntrepriseService extends SuivisBaseService {

  /** Ce service gère les suivis dont la CIBLE est une ENTREPRISE */
  protected readonly targetType = TargetActorType.COMPANY;

  constructor(
    @InjectRepository(Follow)        followRepo:        Repository<Follow>,
    @InjectRepository(FollowBlock)   blockRepo:         Repository<FollowBlock>,
    @InjectRepository(User)          userRepo:          Repository<User>,
    @InjectRepository(Client)        clientRepo:        Repository<Client>,
    @InjectRepository(Company)       companyRepo:       Repository<Company>,
    @InjectRepository(Delivery)      deliveryRepo:      Repository<Delivery>,
    @InjectRepository(Correspondent) correspondantRepo: Repository<Correspondent>,
    @InjectQueue(SUIVIS_QUEUE)       followQueue:       Queue,
    @InjectRedis()                   redis:             Redis,
    gateway:                         SuivisGateway,
  ) {
    super(
      followRepo, blockRepo, userRepo,
      clientRepo, companyRepo, deliveryRepo, correspondantRepo,
      followQueue, redis, gateway,
    );
  }

  // ─── Implémentation des méthodes abstraites ────────────────

  /** Récupère le nom affiché de l'entreprise */
  protected async getTargetDisplayName(companyId: string): Promise<string> {
    const company = await this.companyRepo.findOne({
      where:  { id: companyId },
      select: ['companyName'],
    });
    return (company as any)?.companyName ?? 'Entreprise';
  }

  /** Récupère le userId de l'entreprise pour le WebSocket */
  protected async getTargetUserId(companyId: string): Promise<string> {
    const company = await this.companyRepo.findOne({
      where:  { id: companyId },
      select: ['userId'],
    });
    return (company as any)?.userId ?? '';
  }

  // ─── Méthodes spécifiques aux entreprises ─────────────────

  /**
   * Retourne la liste des entreprises avec le statut `isSuivi`.
   * Inclut les informations publiques de chaque boutique.
   */
  async getEntreprisesWithSuiviStatus(
    userId:  string,
    role:    UserRole,
    filters?: {
      commune?:  string;
      type?:     string;
      category?: string;
    },
  ) {
    const suiviIds = await this.getMyFollowedIds(userId, role);

    const qb = this.companyRepo
      .createQueryBuilder('co')
      .innerJoin('co.user', 'user')
      .select([
        'co.id',
        'co.companyName',
        'co.description',
        'co.logo',
        'co.commune',
        'co.ville',
        'co.status',
        'user.lastLoginAt',
      ])
      .where('co.status = :status', { status: 'active' });

    if (filters?.commune)  qb.andWhere('co.commune = :commune',   { commune: filters.commune });
    if (filters?.category) qb.andWhere('co.companyTypeId = :cat', { cat: filters.category });

    const companies = await qb.getMany();
    const now       = Date.now();
    const threshold  = 15 * 60 * 1000;

    return companies.map(co => ({
      id:            co.id,
      companyName:   (co as any).companyName,
      logo:          (co as any).logo ?? null,
      description:   (co as any).description ?? null,
      region:        [(co as any).commune, (co as any).ville].filter(Boolean).join(', '),
      online:        (co as any).user?.lastLoginAt
                       ? (now - new Date((co as any).user.lastLoginAt).getTime()) < threshold
                       : false,
      /* ← Clé : isSuivi calculé depuis la BDD, pas hardcodé */
      isSuivi:       suiviIds.includes(co.id),
    }));
  }
}
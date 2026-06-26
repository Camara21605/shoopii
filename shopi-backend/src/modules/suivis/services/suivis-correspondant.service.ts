/* ============================================================
 * src/modules/suivis/services/suivis-correspondant.service.ts
 *
 * CORRECTION :
 *   userId === 'anonymous' → isSuivi = false sans appel BDD
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue }      from '@nestjs/bullmq';
import { InjectRedis }      from '@nestjs-modules/ioredis';
import { Repository }       from 'typeorm';
import { Queue }            from 'bullmq';
import { Redis }            from 'ioredis';

import { Follow, TargetActorType } from '../../../database/entities/follow/follow.entity';
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

/* Rôles sans profil follower */
const SKIP_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

@Injectable()
export class SuivisCorrespondantService extends SuivisBaseService {

  protected readonly targetType = TargetActorType.CORRESPONDENT;

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

  protected async getTargetDisplayName(id: string): Promise<string> {
    const c = await this.correspondantRepo.findOne({ where: { id }, select: ['fullName'] });
    return c?.fullName ?? 'Correspondant';
  }

  protected async getTargetUserId(id: string): Promise<string> {
    const c = await this.correspondantRepo.findOne({ where: { id }, select: ['userId'] });
    return c?.userId ?? '';
  }

  async getCorrespondantsWithSuiviStatus(
    userId: string,
    role:   UserRole,
    filters?: {
      commune?: string; ville?: string;
      type?: 'regional' | 'zonal' | 'national'; online?: boolean;
    },
  ) {
    /*
     * ✅ Pas d'appel BDD si :
     *   - utilisateur non connecté (userId = 'anonymous')
     *   - rôle admin/super_admin (pas de profil follower)
     * → isSuivi = false pour tous
     */
    const skipSuivi = userId === 'anonymous' || SKIP_ROLES.includes(role);
    const suiviIds: string[] = skipSuivi
      ? []
      : await this.getMyFollowedIds(userId, role);

    const qb = this.correspondantRepo
      .createQueryBuilder('cor')
      /* leftJoinAndSelect → cor.user hydraté directement par TypeORM */
      .leftJoinAndSelect('cor.user', 'user')
      /* Inclure pending pour le dev (statut par défaut à la création) */
      .where('cor.status IN (:...statuses)', { statuses: ['active', 'pending'] });

    if (filters?.commune) qb.andWhere('cor.depotCommune = :commune', { commune: filters.commune });
    if (filters?.ville)   qb.andWhere('cor.depotVille = :ville',     { ville:   filters.ville   });
    if (filters?.type)    qb.andWhere('cor.typeCorrespondant = :type', { type:   filters.type    });

    const correspondants  = await qb.getMany();
    const now             = Date.now();
    const ONLINE_DELAY_MS = 15 * 60 * 1000;

    return correspondants.map(cor => {
      const lastLogin = cor.user?.lastLoginAt;
      const isOnline  = lastLogin
        ? (now - new Date(lastLogin).getTime()) < ONLINE_DELAY_MS
        : false;

      if (filters?.online !== undefined && isOnline !== filters.online) return null;

      /* ✅ Expérience = années depuis la création du compte */
      const anneesExp = cor.createdAt
        ? Math.max(1, Math.floor((Date.now() - new Date(cor.createdAt).getTime()) / (365 * 24 * 3600 * 1000)))
        : 1;

      return {
        id:                cor.id,
        fullName:          cor.fullName        || 'Sans nom',
        profilePicture:    cor.user?.profilePicture ?? null,
        region:            [cor.depotCommune, cor.depotVille].filter(Boolean).join(', ') || 'Conakry',
        commune:           (cor.depotCommune ?? '').toLowerCase(),   /* ✅ ajout */
        typeCorrespondant: cor.typeCorrespondant,
        bio:               cor.bio ?? null,
        totalMissions:     cor.totalMissions   ?? 0,
        averageRating:     Number(cor.averageRating ?? 0),
        nbAvis:            0,                                          /* ✅ TODO : table avis */
        fiabilite:         cor.totalMissions > 0 ? 98 : 0,            /* ✅ placeholder simple */
        experience:        `${anneesExp} an${anneesExp > 1 ? 's' : ''}`, /* ✅ ajout */
        online:            isOnline,
        isSuivi:           suiviIds.includes(cor.id),
      };
    }).filter(Boolean);
  }
}
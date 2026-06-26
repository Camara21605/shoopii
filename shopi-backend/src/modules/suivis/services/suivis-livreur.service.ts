/* ============================================================
 * src/modules/suivis/services/suivis-livreur.service.ts
 *
 * CORRECTIONS (aligné avec suivis-correspondant.service.ts) :
 *   1. userId === 'anonymous' → isSuivi = false
 *   2. SKIP_ROLES (admin, super_admin) → isSuivi = false
 *   3. leftJoinAndSelect au lieu de innerJoin + select
 *   4. status IN ('active','pending') au lieu de = 'active'
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
export class SuivisLivreurService extends SuivisBaseService {

  protected readonly targetType = TargetActorType.DELIVERY;

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

  protected async getTargetDisplayName(livreurId: string): Promise<string> {
    const d = await this.deliveryRepo.findOne({ where: { id: livreurId }, select: ['fullName'] });
    return d?.fullName ?? 'Livreur';
  }

  protected async getTargetUserId(livreurId: string): Promise<string> {
    const d = await this.deliveryRepo.findOne({ where: { id: livreurId }, select: ['userId'] });
    return d?.userId ?? '';
  }

  async getLivreursWithSuiviStatus(
    userId:  string,
    role:    UserRole,
    filters?: {
      commune?: string; vehicule?: string; online?: boolean;
    },
  ) {
    /*
     * ✅ Pas d'appel BDD si :
     *   - utilisateur non connecté (userId = 'anonymous')
     *   - rôle admin/super_admin (pas de profil follower)
     */
    const skipSuivi = userId === 'anonymous' || SKIP_ROLES.includes(role);
    const suiviIds: string[] = skipSuivi
      ? []
      : await this.getMyFollowedIds(userId, role);

    const qb = this.deliveryRepo
      .createQueryBuilder('del')
      /* ✅ leftJoinAndSelect → del.user hydraté directement */
      .leftJoinAndSelect('del.user', 'user')
      /* ✅ Inclure pending pour le dev */
      .where('del.status IN (:...statuses)', { statuses: ['active', 'pending'] });

    if (filters?.vehicule) {
      qb.andWhere('del.vehiculeType = :vehicule', { vehicule: filters.vehicule });
    }

    const livreurs  = await qb.getMany();
    const now       = Date.now();
    const threshold = 15 * 60 * 1000;

    return livreurs
      .map(del => {
        const lastLogin = del.user?.lastLoginAt;
        const isOnline  = lastLogin
          ? (now - new Date(lastLogin).getTime()) < threshold
          : false;

        if (filters?.online !== undefined && isOnline !== filters.online) return null;

        return {
          id:             del.id,
          fullName:       del.fullName        || 'Sans nom',
          profilePicture: del.user?.profilePicture ?? null,
          zone:           del.zone            ?? 'Conakry',
          vehicule:       del.VehicleType    ?? null,
          bio:            del.bio             ?? null,
          totalLivraisons: del.totalDeliveries ?? 0,
          averageRating:  Number(del.averageRating ?? 0),
          disponible:     isOnline,
          /* false si non connecté ou admin, sinon depuis la BDD */
          isSuivi:        suiviIds.includes(del.id),
        };
      })
      .filter(Boolean);
  }
}
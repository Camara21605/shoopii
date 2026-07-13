/* ============================================================
 * src/modules/suivis/services/suivis-base.service.ts
 *
 * CORRECTIONS :
 *   ✅ getMyFollowedIds → ajoute isSubscribed: true
 *      (cohérence avec le toggle qui met à jour ce champ)
 *
 *   ✅ getFollowersCount → utilise isSubscribed: true
 *      au lieu de status: ACTIVE uniquement
 *      (les deux champs doivent être vrais)
 *
 *   Le reste du code (toggleSuivi, Redis, BullMQ, WebSocket)
 *   est inchangé — il était déjà correct.
 * ============================================================ */

import {
  BadRequestException, ForbiddenException,
  Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue }      from '@nestjs/bullmq';
import { InjectRedis }      from '@nestjs-modules/ioredis';
import { Repository }       from 'typeorm';
import { Queue }            from 'bullmq';
import { Redis }            from 'ioredis';

import {
  Follow, FollowerActorType, FollowStatus, TargetActorType,
} from '../../../database/entities/follow/follow.entity';
import { FollowBlock }     from '../../../database/entities/follow/follow-block.entity';
import { User }            from '../../../database/entities/user.entity';
import { Client }          from '../../../database/entities/profiles/client-profile.entity';
import { Company }         from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }        from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent }   from '../../../database/entities/profiles/correspondant-profile.entity';
import { SuivisGateway }   from '../gateways/suivis.gateway';
import { SUIVIS_QUEUE, SUIVIS_JOBS, type FollowJobPayload } from '../suivis.queue';
import { UserRole }        from '../../../common/enums/user-role.enum';
import type { FollowResponse } from '../dto/suivis.dto';

const ROLE_TO_FOLLOWER_TYPE: Partial<Record<UserRole, FollowerActorType>> = {
  [UserRole.CLIENT]:        FollowerActorType.CLIENT,
  [UserRole.COMPANY]:       FollowerActorType.COMPANY,
  [UserRole.DELIVERY]:      FollowerActorType.DELIVERY,
  [UserRole.CORRESPONDENT]: FollowerActorType.CORRESPONDENT,
};

@Injectable()
export abstract class SuivisBaseService {

  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    @InjectRepository(Follow)        protected readonly followRepo:        Repository<Follow>,
    @InjectRepository(FollowBlock)   protected readonly blockRepo:         Repository<FollowBlock>,
    @InjectRepository(User)          protected readonly userRepo:          Repository<User>,
    @InjectRepository(Client)        protected readonly clientRepo:        Repository<Client>,
    @InjectRepository(Company)       protected readonly companyRepo:       Repository<Company>,
    @InjectRepository(Delivery)      protected readonly deliveryRepo:      Repository<Delivery>,
    @InjectRepository(Correspondent) protected readonly correspondantRepo: Repository<Correspondent>,
    @InjectQueue(SUIVIS_QUEUE)       protected readonly followQueue:       Queue,
    @InjectRedis()                   protected readonly redis:             Redis,
    protected readonly gateway:      SuivisGateway,
  ) {}

  protected abstract readonly targetType: TargetActorType;
  protected abstract getTargetDisplayName(targetId: string): Promise<string>;
  protected abstract getTargetUserId(targetId: string): Promise<string>;

  /* ══════════════════════════════════════════════════════════
   * TOGGLE SUIVI — UPDATE isSubscribed (pas de DELETE)
   *   - Ligne inexistante → INSERT avec isSubscribed = true
   *   - Ligne existante   → toggle isSubscribed + unfollowedAt
   ══════════════════════════════════════════════════════════ */
  async toggleSuivi(userId: string, role: UserRole, targetId: string): Promise<FollowResponse> {

    const followerType = this.resolveFollowerType(role);
    const [followerId, followerName] = await Promise.all([
      this.getFollowerProfileId(userId, followerType),
      this.getFollowerDisplayName(userId),
    ]);

    if (this.targetType as unknown as FollowerActorType === followerType && targetId === followerId) {
      throw new BadRequestException('Vous ne pouvez pas vous suivre vous-même.');
    }

    await this.checkNotBlocked(followerId, followerType, targetId, this.targetType);

    const existing = await this.followRepo.findOne({
      where: { followerType, followerId, targetType: this.targetType, targetId },
    });

    let isSuivi: boolean;
    let followId: string;

    if (existing) {
      isSuivi               = !existing.isSubscribed;
      existing.isSubscribed = isSuivi;
      existing.status       = isSuivi ? FollowStatus.ACTIVE : FollowStatus.INACTIVE;
      existing.followedAt   = isSuivi ? new Date() : existing.followedAt;
      existing.unfollowedAt = isSuivi ? null : new Date();
      await this.followRepo.save(existing);
      followId = existing.id;
      this.logger.log(`[TOGGLE] ${followerType}:${followerId} → ${this.targetType}:${targetId} = ${isSuivi}`);
    } else {
      const newFollow = this.followRepo.create({
        followerType, followerId,
        targetType:           this.targetType,
        targetId,
        isSubscribed:         true,
        status:               FollowStatus.ACTIVE,
        notificationsEnabled: true,
        followedAt:           new Date(),
      });
      const saved = await this.followRepo.save(newFollow);
      isSuivi  = true;
      followId = saved.id;
      this.logger.log(`[NEW] ${followerType}:${followerId} → ${this.targetType}:${targetId}`);
    }

    if (isSuivi) await this.incrementFollowersCache(targetId);
    else         await this.decrementFollowersCache(targetId);

    const followersCount = await this.getFollowersCount(targetId);

    const [targetName, targetUserId] = await Promise.all([
      this.getTargetDisplayName(targetId),
      this.getTargetUserId(targetId),
    ]);

    if (isSuivi) {
      this.gateway.notifyNewFollower(targetUserId, {
        event:'new-follower', followerId, followerType,
        followerName, followerPhoto:null, followersCount,
        timestamp:new Date().toISOString(),
      });
    } else {
      this.gateway.notifyUnfollowed(targetUserId, {
        event:'unfollowed', followerId, followerType,
        followerName, followersCount, timestamp:new Date().toISOString(),
      });
    }

    this.gateway.broadcastFollowersCount(this.targetType, targetId, followersCount);

    const jobPayload: FollowJobPayload = {
      followerId, followerType, followerName,
      targetId, targetType:this.targetType, targetUserId, targetName,
      followId, timestamp:new Date().toISOString(),
    };

    const queueAdds = isSuivi
      ? [
          this.followQueue.add(SUIVIS_JOBS.NOTIFY_FOLLOWED,     jobPayload, { delay:500, attempts:3, backoff:{type:'exponential',delay:2000} }),
          this.followQueue.add(SUIVIS_JOBS.UPDATE_FEED,         jobPayload, { attempts:3 }),
          this.followQueue.add(SUIVIS_JOBS.UPDATE_FOLLOW_COUNT, jobPayload, { attempts:3 }),
        ]
      : [
          this.followQueue.add(SUIVIS_JOBS.NOTIFY_UNFOLLOWED,   jobPayload, { attempts:2 }),
          this.followQueue.add(SUIVIS_JOBS.UPDATE_FOLLOW_COUNT, jobPayload, { attempts:3 }),
        ];
    Promise.all(queueAdds).catch(err => this.logger.error('Queue add failed', err));

    return {
      isSuivi,
      followersCount,
      message: isSuivi
        ? `Vous suivez maintenant ${targetName}`
        : `Vous ne suivez plus ${targetName}`,
    };
  }

  /* ══════════════════════════════════════════════════════════
   * GET MY FOLLOWED IDS
   * ✅ FIX : filtre sur isSubscribed: true ET status: ACTIVE
   *    Les deux doivent être vrais (cohérence avec le toggle)
   ══════════════════════════════════════════════════════════ */
  async getMyFollowedIds(userId: string, role: UserRole): Promise<string[]> {
    const followerType = this.resolveFollowerType(role);
    const followerId   = await this.getFollowerProfileId(userId, followerType);

    const follows = await this.followRepo.find({
      where: {
        followerType,
        followerId,
        targetType:   this.targetType,
        isSubscribed: true,      /* ✅ ajout — source de vérité */
        status:       FollowStatus.ACTIVE,
      },
      select: ['targetId'],
    });

    return follows.map(f => f.targetId);
  }

  /* ══════════════════════════════════════════════════════════
   * GET FOLLOWERS COUNT
   * ✅ FIX : filtre sur isSubscribed: true ET status: ACTIVE
   ══════════════════════════════════════════════════════════ */
  async getFollowersCount(targetId: string): Promise<number> {
    try {
      const cacheKey = `followers:${this.targetType}:${targetId}`;
      const cached   = await this.redis.get(cacheKey);
      if (cached !== null) return parseInt(cached, 10);

      const count = await this.followRepo.count({
        where: {
          targetType:   this.targetType,
          targetId,
          isSubscribed: true,
          status:       FollowStatus.ACTIVE,
        },
      });
      await this.redis.setex(cacheKey, 3600, String(count)).catch(() => {});
      return count;
    } catch {
      /* Redis indisponible → fallback DB direct */
      return this.followRepo.count({
        where: {
          targetType:   this.targetType,
          targetId,
          isSubscribed: true,
          status:       FollowStatus.ACTIVE,
        },
      });
    }
  }

  /* ══════════════════════════════════════════════════════════
   * IS SUIVI
   * ✅ Inchangé — déjà filtre sur isSubscribed: true
   ══════════════════════════════════════════════════════════ */
  async isSuivi(userId: string, role: UserRole, targetId: string): Promise<boolean> {
    const followerType = this.resolveFollowerType(role);
    const followerId   = await this.getFollowerProfileId(userId, followerType);

    const follow = await this.followRepo.findOne({
      where: {
        followerType, followerId,
        targetType:   this.targetType,
        targetId,
        isSubscribed: true,
        status:       FollowStatus.ACTIVE,
      },
      select: ['id'],
    });
    return !!follow;
  }

  /* ── Helpers privés (inchangés) ── */

  private resolveFollowerType(role: UserRole): FollowerActorType {
    const type = ROLE_TO_FOLLOWER_TYPE[role];
    if (!type) throw new BadRequestException(`Le rôle "${role}" n'est pas autorisé à suivre.`);
    return type;
  }

  private async getFollowerProfileId(userId: string, followerType: FollowerActorType): Promise<string> {
    let profileId: string | null = null;
    switch (followerType) {
      case FollowerActorType.CLIENT:
        profileId = (await this.clientRepo.findOne({ where:{userId}, select:['id'] }))?.id ?? null; break;
      case FollowerActorType.COMPANY:
        profileId = (await this.companyRepo.findOne({ where:{userId}, select:['id'] }))?.id ?? null; break;
      case FollowerActorType.DELIVERY:
        profileId = (await this.deliveryRepo.findOne({ where:{userId}, select:['id'] }))?.id ?? null; break;
      case FollowerActorType.CORRESPONDENT:
        profileId = (await this.correspondantRepo.findOne({ where:{userId}, select:['id'] }))?.id ?? null; break;
    }
    if (!profileId) throw new NotFoundException(`Profil introuvable pour userId=${userId}`);
    return profileId;
  }

  private async getFollowerDisplayName(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({ where:{id:userId}, select:['firstName','lastName'] });
    return `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Utilisateur';
  }

  private async checkNotBlocked(
    followerId: string, followerType: FollowerActorType,
    targetId: string,  targetType: TargetActorType,
  ): Promise<void> {
    // La cible (targetType/targetId) a-t-elle bloqué le follower (followerType/followerId) ?
    const blocked = await this.blockRepo.findOne({
      where: {
        blockerType: targetType as unknown as FollowerActorType,
        blockerId:   targetId,
        blockedType: followerType as unknown as TargetActorType,
        blockedId:   followerId,
      },
      select: ['id'],
    });
    if (blocked) throw new ForbiddenException('Vous ne pouvez pas suivre cet acteur.');
  }

  private async incrementFollowersCache(targetId: string): Promise<void> {
    try {
      const key = `followers:${this.targetType}:${targetId}`;
      await this.redis.incr(key);
      await this.redis.expire(key, 3600);
    } catch (e) {
      this.logger.warn(`[Cache] incr followers failed (Redis indisponible): ${(e as Error).message}`);
    }
  }

  private async decrementFollowersCache(targetId: string): Promise<void> {
    try {
      const key   = `followers:${this.targetType}:${targetId}`;
      const value = await this.redis.get(key);
      if (value !== null && parseInt(value) > 0) {
        await this.redis.decr(key);
        await this.redis.expire(key, 3600);
      }
    } catch (e) {
      this.logger.warn(`[Cache] decr followers failed (Redis indisponible): ${(e as Error).message}`);
    }
  }
}
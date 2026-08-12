/* ============================================================
 * FICHIER : correspondent-delivery.evaluator.ts
 *
 * RÈGLE : Un correspondant peut contacter un livreur si :
 *   1. Le livreur est celui auquel il est rattaché (hiérarchie)
 *   2. OU une commande commune existe (point relais + livreur)
 *   3. OU une relation de follow existe entre les deux
 *
 * Contrepartie symétrique de DeliveryCorrespondentEvaluator — mêmes
 * conditions, rôles source/cible inversés.
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import type { PermissionEvaluator }                from '../interfaces/permission-evaluator.interface';
import type { PermissionContext, PermissionResult } from '../interfaces/permission-context.interface';
import { ConversationActorType }                   from 'src/database/entities/messaging/conversation.entity';
import { Commande }                                from 'src/database/entities/commande/commande.entity';
import { Correspondent }                           from 'src/database/entities/profiles/correspondant-profile.entity';
import { Follow, FollowerActorType, TargetActorType } from 'src/database/entities/follow/follow.entity';

@Injectable()
export class CorrespondentDeliveryEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.CORRESPONDENT;
  readonly targetType = ConversationActorType.DELIVERY;
  readonly name       = 'CorrespondentDeliveryEvaluator';

  constructor(
    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Correspondent)
    private readonly corrRepo: Repository<Correspondent>,

    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
  ) {}

  async evaluate(ctx: PermissionContext): Promise<PermissionResult> {
    try {
      /* ── 1. Hiérarchie : je suis rattaché à ce livreur ───── */
      const isSupervised = await this.corrRepo.exists({
        where: { id: ctx.requestorId, deliveryId: ctx.targetId },
      });

      if (isSupervised) {
        return {
          granted:   true,
          reason:    'Rattaché à ce livreur.',
          evaluator: this.name,
        };
      }

      /* ── 2. Commande commune ─────────────────────────────── */
      const sharedOrder = await this.commandeRepo.exists({
        where: { correspondantId: ctx.requestorId, livreurId: ctx.targetId },
      });

      if (sharedOrder) {
        return {
          granted:   true,
          reason:    'Commande commune avec ce livreur.',
          evaluator: this.name,
        };
      }

      /* ── 3. Relation de follow ───────────────────────────── */
      const followExists = await this.followRepo.exists({
        where: [
          {
            followerType: FollowerActorType.CORRESPONDENT,
            followerId:   ctx.requestorId,
            targetType:   TargetActorType.DELIVERY,
            targetId:     ctx.targetId,
            isSubscribed: true,
          },
          {
            followerType: FollowerActorType.DELIVERY,
            followerId:   ctx.targetId,
            targetType:   TargetActorType.CORRESPONDENT,
            targetId:     ctx.requestorId,
            isSubscribed: true,
          },
        ],
      });

      if (followExists) {
        return {
          granted:   true,
          reason:    'Relation de suivi existante avec ce livreur.',
          evaluator: this.name,
        };
      }

      return {
        granted:   false,
        reason:    'Aucune relation (hiérarchie, commande ou suivi) avec ce livreur.',
        evaluator: this.name,
      };

    } catch (err) {
      return {
        granted:   false,
        reason:    `Erreur d'évaluation : ${(err as Error).message}`,
        evaluator: this.name,
      };
    }
  }
}

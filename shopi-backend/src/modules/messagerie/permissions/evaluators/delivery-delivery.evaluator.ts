/* ============================================================
 * FICHIER : delivery-delivery.evaluator.ts
 *
 * RÈGLE : Deux livreurs peuvent se contacter si l'un suit l'autre.
 *
 * JUSTIFICATION MÉTIER :
 *   Les livreurs forment un réseau professionnel. Ils peuvent
 *   s'entraider sur les zones, échanger des informations de
 *   livraison. La relation de suivi garantit un consentement
 *   minimal avant la communication.
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import type { PermissionEvaluator }                from '../interfaces/permission-evaluator.interface';
import type { PermissionContext, PermissionResult } from '../interfaces/permission-context.interface';
import { ConversationActorType }                   from 'src/database/entities/messaging/conversation.entity';
import { Follow, FollowerActorType, TargetActorType } from 'src/database/entities/follow/follow.entity';

@Injectable()
export class DeliveryDeliveryEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.DELIVERY;
  readonly targetType = ConversationActorType.DELIVERY;
  readonly name       = 'DeliveryDeliveryEvaluator';

  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
  ) {}

  async evaluate(ctx: PermissionContext): Promise<PermissionResult> {
    try {
      const followExists = await this.followRepo.exists({
        where: [
          {
            followerType: FollowerActorType.DELIVERY,
            followerId:   ctx.requestorId,
            targetType:   TargetActorType.DELIVERY,
            targetId:     ctx.targetId,
            isSubscribed: true,
          },
          {
            followerType: FollowerActorType.DELIVERY,
            followerId:   ctx.targetId,
            targetType:   TargetActorType.DELIVERY,
            targetId:     ctx.requestorId,
            isSubscribed: true,
          },
        ],
      });

      if (followExists) {
        return {
          granted:   true,
          reason:    'Relation de suivi entre livreurs.',
          evaluator: this.name,
        };
      }

      return {
        granted:   false,
        reason:    'Les deux livreurs ne se suivent pas mutuellement.',
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

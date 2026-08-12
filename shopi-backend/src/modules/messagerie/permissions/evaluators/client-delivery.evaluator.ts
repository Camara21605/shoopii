/* ============================================================
 * FICHIER : client-delivery.evaluator.ts
 *
 * RÈGLE : Un client peut contacter un livreur si :
 *   1. Une commande commune existe (livreur affecté à sa commande)
 *   2. OU une relation de follow existe entre les deux
 *
 * Contrepartie symétrique de DeliveryClientEvaluator — mêmes
 * conditions, rôles source/cible inversés.
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import type { PermissionEvaluator }                from '../interfaces/permission-evaluator.interface';
import type { PermissionContext, PermissionResult } from '../interfaces/permission-context.interface';
import { ConversationActorType }                   from 'src/database/entities/messaging/conversation.entity';
import { Commande }                                from 'src/database/entities/commande/commande.entity';
import { Follow, FollowerActorType, TargetActorType } from 'src/database/entities/follow/follow.entity';

@Injectable()
export class ClientDeliveryEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.CLIENT;
  readonly targetType = ConversationActorType.DELIVERY;
  readonly name       = 'ClientDeliveryEvaluator';

  constructor(
    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
  ) {}

  async evaluate(ctx: PermissionContext): Promise<PermissionResult> {
    try {
      /* ── 1. Commande commune ─────────────────────────────── */
      const sharedOrder = await this.commandeRepo.exists({
        where: { clientId: ctx.requestorId, livreurId: ctx.targetId },
      });

      if (sharedOrder) {
        return {
          granted:   true,
          reason:    'Commande commune avec ce livreur.',
          evaluator: this.name,
        };
      }

      /* ── 2. Relation de follow ───────────────────────────── */
      const followExists = await this.followRepo.exists({
        where: [
          {
            followerType: FollowerActorType.CLIENT,
            followerId:   ctx.requestorId,
            targetType:   TargetActorType.DELIVERY,
            targetId:     ctx.targetId,
            isSubscribed: true,
          },
          {
            followerType: FollowerActorType.DELIVERY,
            followerId:   ctx.targetId,
            targetType:   TargetActorType.CLIENT,
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
        reason:    'Aucune commande commune ni relation de suivi avec ce livreur.',
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

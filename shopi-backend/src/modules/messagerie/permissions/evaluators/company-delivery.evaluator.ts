/* ============================================================
 * FICHIER : company-delivery.evaluator.ts
 *
 * RÈGLE : Une entreprise peut contacter un livreur si :
 *   1. Le livreur est affecté à une commande de cette entreprise
 *   2. OU le livreur suit l'entreprise (relation établie)
 *
 * Cette règle est symétrique : delivery-company utilise le même
 * évaluateur avec les rôles inversés (voir partner.evaluator.ts
 * pour le pattern d'inversion).
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
export class CompanyDeliveryEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.COMPANY;
  readonly targetType = ConversationActorType.DELIVERY;
  readonly name       = 'CompanyDeliveryEvaluator';

  constructor(
    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
  ) {}

  async evaluate(ctx: PermissionContext): Promise<PermissionResult> {
    try {
      /* ── 1. Livreur affecté à une commande de cette entreprise ─ */
      const sharedOrder = await this.commandeRepo.exists({
        where: {
          companyId:  ctx.requestorId,
          livreurId:  ctx.targetId,
        },
      });

      if (sharedOrder) {
        return {
          granted:   true,
          reason:    'Livreur affecté à une commande de cette entreprise.',
          evaluator: this.name,
        };
      }

      /* ── 2. Relation de follow ───────────────────────────── */
      const followExists = await this.followRepo.exists({
        where: [
          {
            followerType: FollowerActorType.DELIVERY,
            followerId:   ctx.targetId,
            targetType:   TargetActorType.COMPANY,
            targetId:     ctx.requestorId,
            isSubscribed: true,
          },
          {
            followerType: FollowerActorType.COMPANY,
            followerId:   ctx.requestorId,
            targetType:   TargetActorType.DELIVERY,
            targetId:     ctx.targetId,
            isSubscribed: true,
          },
        ],
      });

      if (followExists) {
        return {
          granted:   true,
          reason:    'Relation de partenariat (follow) existante.',
          evaluator: this.name,
        };
      }

      return {
        granted:   false,
        reason:    'Aucune commande commune ni relation de partenariat avec ce livreur.',
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

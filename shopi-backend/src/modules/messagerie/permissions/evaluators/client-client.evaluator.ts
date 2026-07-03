/* ============================================================
 * FICHIER : client-client.evaluator.ts
 *
 * RÈGLE : Un client peut contacter un autre client si :
 *   1. L'un suit l'autre (relation asymétrique) → GRANTED
 *   2. OU ils se suivent mutuellement → GRANTED (surcouche bonus)
 *   3. OU ils sont tous deux présents dans les contacts
 *      importés de l'autre (contact mutuel) → GRANTED
 *
 * JUSTIFICATION MÉTIER :
 *   Sur Shopi, les clients interagissent au sein d'une communauté
 *   (avis, recommandations). La politique suit/suivi reflète une
 *   intention de communication mutuellement acceptée.
 *
 *   WhatsApp exige un numéro de téléphone mutuel.
 *   Shopi utilise le système de follows comme équivalent.
 *
 * ÉVOLUTION :
 *   Pour passer à "contacts mutuels uniquement", supprimer
 *   la règle follow et activer seulement la règle UserContact.
 *   Zéro modification du moteur.
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import type { PermissionEvaluator }                from '../interfaces/permission-evaluator.interface';
import type { PermissionContext, PermissionResult } from '../interfaces/permission-context.interface';
import { ConversationActorType }                   from 'src/database/entities/messaging/conversation.entity';
import { Follow, FollowerActorType, TargetActorType } from 'src/database/entities/follow/follow.entity';
import { UserContact }                             from 'src/database/entities/contacts/user-contact.entity';

@Injectable()
export class ClientClientEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.CLIENT;
  readonly targetType = ConversationActorType.CLIENT;
  readonly name       = 'ClientClientEvaluator';

  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,

    @InjectRepository(UserContact)
    private readonly contactRepo: Repository<UserContact>,
  ) {}

  async evaluate(ctx: PermissionContext): Promise<PermissionResult> {
    try {
      /* ── 1. L'un suit l'autre (dans n'importe quel sens) ─ */
      const followExists = await this.followRepo.exists({
        where: [
          {
            followerType: FollowerActorType.CLIENT,
            followerId:   ctx.requestorId,
            targetType:   TargetActorType.CLIENT,
            targetId:     ctx.targetId,
            isSubscribed: true,
          },
          {
            followerType: FollowerActorType.CLIENT,
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
          reason:    'Relation de suivi existante entre les deux clients.',
          evaluator: this.name,
        };
      }

      /* ── 2. Contact mutuel (importé depuis le téléphone) ─ */
      if (ctx.requestorUserId && ctx.targetUserId) {
        const mutualContact = await this.contactRepo.exists({
          where: [
            { ownerUserId: ctx.requestorUserId, matchedUserId: ctx.targetUserId, isBlocked: false },
            { ownerUserId: ctx.targetUserId,    matchedUserId: ctx.requestorUserId, isBlocked: false },
          ],
        });

        if (mutualContact) {
          return {
            granted:   true,
            reason:    'Contact mutuel importé depuis le téléphone.',
            evaluator: this.name,
          };
        }
      }

      return {
        granted:   false,
        reason:    'Aucune relation (ni follow ni contact mutuel) entre ces deux clients.',
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

/* ============================================================
 * FICHIER : client-client.evaluator.ts
 *
 * RÈGLE : Un client peut contacter un autre client si :
 *   1. L'un suit l'autre (relation asymétrique) → GRANTED
 *   2. OU L'UN DES DEUX a l'autre dans ses contacts téléphoniques
 *      synchronisés (à sens unique, PAS besoin d'être réciproque)
 *      → GRANTED
 *
 * JUSTIFICATION MÉTIER (décision produit du 2026-08-26) :
 *   Si un client a le numéro de quelqu'un dans son répertoire et
 *   que cette personne est sur Shoneya, il peut lui écrire — comme
 *   un SMS classique. Pas besoin que l'autre ait aussi son numéro
 *   enregistré. (Alternative envisagée : exiger un contact mutuel
 *   comme WhatsApp — écartée, jugée trop restrictive pour l'usage
 *   voulu ici.)
 *
 * IMPLÉMENTATION : la requête ci-dessous utilise un `where` TypeORM
 * sous forme de tableau ([condA, condB]), ce qui génère un OR SQL —
 * PAS un AND. Elle est donc déjà à sens unique par construction ;
 * ne pas la renommer/modifier en pensant "corriger" vers du mutuel.
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

      /* ── 2. L'un des deux a l'autre en contact synchronisé ─
       * OR (pas AND) : suffit qu'UN SEUL côté ait importé le
       * numéro de l'autre — voir décision produit en tête de
       * fichier. */
      if (ctx.requestorUserId && ctx.targetUserId) {
        const oneWayContact = await this.contactRepo.exists({
          where: [
            { ownerUserId: ctx.requestorUserId, matchedUserId: ctx.targetUserId, isBlocked: false },
            { ownerUserId: ctx.targetUserId,    matchedUserId: ctx.requestorUserId, isBlocked: false },
          ],
        });

        if (oneWayContact) {
          return {
            granted:   true,
            reason:    'Contact téléphonique partagé (numéro importé par l\'un des deux).',
            evaluator: this.name,
          };
        }
      }

      return {
        granted:   false,
        reason:    'Aucune relation (ni follow ni contact téléphonique partagé) entre ces deux clients.',
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

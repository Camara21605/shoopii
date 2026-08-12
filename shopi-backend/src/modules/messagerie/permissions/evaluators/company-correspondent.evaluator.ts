/* ============================================================
 * FICHIER : company-correspondent.evaluator.ts
 *
 * RÈGLE : Une entreprise peut contacter un correspondant si :
 *   1. Le correspondant est rattaché à cette entreprise (hiérarchie)
 *   2. OU une commande commune existe
 *   3. OU une relation de follow existe entre les deux
 *
 * Contrepartie symétrique de CorrespondentCompanyEvaluator — mêmes
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
export class CompanyCorrespondentEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.COMPANY;
  readonly targetType = ConversationActorType.CORRESPONDENT;
  readonly name       = 'CompanyCorrespondentEvaluator';

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
      /* ── 1. Hiérarchie : le correspondant est rattaché à cette entreprise ── */
      const isSupervised = await this.corrRepo.exists({
        where: { id: ctx.targetId, companyId: ctx.requestorId },
      });

      if (isSupervised) {
        return {
          granted:   true,
          reason:    'Correspondant rattaché à cette entreprise.',
          evaluator: this.name,
        };
      }

      /* ── 2. Commande commune ─────────────────────────────── */
      const sharedOrder = await this.commandeRepo.exists({
        where: { companyId: ctx.requestorId, correspondantId: ctx.targetId },
      });

      if (sharedOrder) {
        return {
          granted:   true,
          reason:    'Commande commune avec ce correspondant.',
          evaluator: this.name,
        };
      }

      /* ── 3. Relation de follow ───────────────────────────── */
      const followExists = await this.followRepo.exists({
        where: [
          {
            followerType: FollowerActorType.COMPANY,
            followerId:   ctx.requestorId,
            targetType:   TargetActorType.CORRESPONDENT,
            targetId:     ctx.targetId,
            isSubscribed: true,
          },
          {
            followerType: FollowerActorType.CORRESPONDENT,
            followerId:   ctx.targetId,
            targetType:   TargetActorType.COMPANY,
            targetId:     ctx.requestorId,
            isSubscribed: true,
          },
        ],
      });

      if (followExists) {
        return {
          granted:   true,
          reason:    'Relation de suivi existante avec ce correspondant.',
          evaluator: this.name,
        };
      }

      return {
        granted:   false,
        reason:    'Aucune relation (hiérarchie, commande ou suivi) avec ce correspondant.',
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

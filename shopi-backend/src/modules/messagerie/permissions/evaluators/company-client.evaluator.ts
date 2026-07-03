/* ============================================================
 * FICHIER : company-client.evaluator.ts
 *
 * RÈGLE : Une entreprise peut contacter un client SEULEMENT si
 *         une relation commerciale existe (commande, abonnement,
 *         ou le client suit la boutique).
 *
 * JUSTIFICATION MÉTIER :
 *   Une boutique ne doit pas pouvoir spammer n'importe quel client.
 *   Cela reproduit les règles de WhatsApp Business (la boutique
 *   ne peut initier un message que dans le cadre d'une relation).
 *
 * RÈGLES (par ordre de priorité) :
 *   1. Client a passé ≥ 1 commande à cette entreprise → GRANTED
 *   2. Client suit l'entreprise (isSubscribed = true) → GRANTED
 *   3. Sinon → DENIED
 *
 * PERFORMANCE :
 *   Requête sur commandes en premier (plus probable en prod).
 *   Index sur (companyId, clientId) dans la table commandes.
 * ============================================================ */

import { Injectable }          from '@nestjs/common';
import { InjectRepository }    from '@nestjs/typeorm';
import { Repository }          from 'typeorm';
import type { PermissionEvaluator }           from '../interfaces/permission-evaluator.interface';
import type { PermissionContext, PermissionResult } from '../interfaces/permission-context.interface';
import { ConversationActorType }              from 'src/database/entities/messaging/conversation.entity';
import { Commande }                           from 'src/database/entities/commande/commande.entity';
import { Follow, FollowerActorType, TargetActorType } from 'src/database/entities/follow/follow.entity';

@Injectable()
export class CompanyClientEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.COMPANY;
  readonly targetType = ConversationActorType.CLIENT;
  readonly name       = 'CompanyClientEvaluator';

  constructor(
    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
  ) {}

  async evaluate(ctx: PermissionContext): Promise<PermissionResult> {
    try {
      /* ── 1. Commande existante ─────────────────────────── */
      const hasOrder = await this.commandeRepo.exists({
        where: {
          companyId: ctx.requestorId,
          clientId:  ctx.targetId,
        },
      });

      if (hasOrder) {
        return {
          granted:   true,
          reason:    'Relation commerciale existante (commande).',
          evaluator: this.name,
        };
      }

      /* ── 2. Client suit l'entreprise ───────────────────── */
      const isFollower = await this.followRepo.exists({
        where: {
          followerType:  FollowerActorType.CLIENT,
          followerId:    ctx.targetId,       // le client
          targetType:    TargetActorType.COMPANY,
          targetId:      ctx.requestorId,    // l'entreprise
          isSubscribed:  true,
        },
      });

      if (isFollower) {
        return {
          granted:   true,
          reason:    'Le client suit cette boutique.',
          evaluator: this.name,
        };
      }

      return {
        granted:   false,
        reason:    'Aucune relation commerciale avec ce client.',
        evaluator: this.name,
      };

    } catch (err) {
      /* Erreur DB → deny par sécurité, jamais d'exception non catchée */
      return {
        granted:   false,
        reason:    `Erreur d'évaluation : ${(err as Error).message}`,
        evaluator: this.name,
      };
    }
  }
}

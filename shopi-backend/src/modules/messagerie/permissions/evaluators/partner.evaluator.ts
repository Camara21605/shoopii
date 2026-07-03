/* ============================================================
 * FICHIER : partner.evaluator.ts
 *
 * RÈGLE : Un partenaire peut TOUJOURS contacter n'importe qui.
 *         N'importe qui peut TOUJOURS contacter un partenaire.
 *
 * JUSTIFICATION MÉTIER :
 *   Les partenaires Shopi sont des entités de confiance (banques,
 *   opérateurs, fournisseurs officiels). Leur communication doit
 *   être totalement fluide avec tous les acteurs du réseau.
 *
 * PATTERN :
 *   Cet évaluateur gère DEUX directions :
 *   - PARTNER → * (n'importe quel target)
 *   - * → PARTNER (n'importe quel source)
 *
 *   Le moteur le déclare deux fois avec sourceType et targetType
 *   swappés. Voir messaging-permission.engine.ts.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import type { PermissionEvaluator }                from '../interfaces/permission-evaluator.interface';
import type { PermissionContext, PermissionResult } from '../interfaces/permission-context.interface';
import { ConversationActorType }                   from 'src/database/entities/messaging/conversation.entity';

/**
 * PARTNER → n'importe qui
 */
@Injectable()
export class PartnerAsSourceEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.PARTNER;
  readonly targetType = ConversationActorType.CLIENT;   // sera remplacé dynamiquement
  readonly name       = 'PartnerAsSourceEvaluator';

  async evaluate(_ctx: PermissionContext): Promise<PermissionResult> {
    return {
      granted:   true,
      reason:    'Les partenaires Shopi ont un accès de communication complet.',
      evaluator: this.name,
    };
  }
}

/**
 * N'importe qui → PARTNER
 * (identique mais sourceType/targetType inversés dans le moteur)
 */
@Injectable()
export class PartnerAsTargetEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.CLIENT;   // sera remplacé dynamiquement
  readonly targetType = ConversationActorType.PARTNER;
  readonly name       = 'PartnerAsTargetEvaluator';

  async evaluate(_ctx: PermissionContext): Promise<PermissionResult> {
    return {
      granted:   true,
      reason:    'Communication libre avec un partenaire Shopi autorisée.',
      evaluator: this.name,
    };
  }
}

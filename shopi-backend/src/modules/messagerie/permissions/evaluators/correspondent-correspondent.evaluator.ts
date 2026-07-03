/* ============================================================
 * FICHIER : correspondent-correspondent.evaluator.ts
 *
 * RÈGLE : Deux correspondants peuvent TOUJOURS se contacter.
 *
 * JUSTIFICATION MÉTIER :
 *   Les correspondants forment le réseau de points de dépôt/
 *   retrait de Shopi. Ils doivent pouvoir coordonner librement
 *   pour les transferts, les stocks, les retards.
 *   Restreindre leur communication impacterait directement
 *   les opérations logistiques.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import type { PermissionEvaluator }                from '../interfaces/permission-evaluator.interface';
import type { PermissionContext, PermissionResult } from '../interfaces/permission-context.interface';
import { ConversationActorType }                   from 'src/database/entities/messaging/conversation.entity';

@Injectable()
export class CorrespondentCorrespondentEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.CORRESPONDENT;
  readonly targetType = ConversationActorType.CORRESPONDENT;
  readonly name       = 'CorrespondentCorrespondentEvaluator';

  async evaluate(_ctx: PermissionContext): Promise<PermissionResult> {
    return {
      granted:   true,
      reason:    'Les correspondants peuvent toujours communiquer entre eux.',
      evaluator: this.name,
    };
  }
}

/* ============================================================
 * FICHIER : client-company.evaluator.ts
 *
 * RÈGLE : Un client peut TOUJOURS écrire à une entreprise.
 *
 * JUSTIFICATION MÉTIER :
 *   Dans un marché e-commerce, le client doit pouvoir contacter
 *   librement les boutiques pour poser des questions sur les
 *   produits, négocier, demander un devis.
 *   Restreindre ce canal tuerait les ventes.
 *
 *   WhatsApp Business / Instagram / Messenger : même approche.
 *   Le consommateur contacte librement le marchand.
 *
 * ANTI-SPAM :
 *   Le rate limiting global (ThrottlerGuard) empêche le flood.
 *   Cette règle ne fait donc aucun DB hit → O(1).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import type { PermissionEvaluator } from '../interfaces/permission-evaluator.interface';
import type { PermissionContext, PermissionResult } from '../interfaces/permission-context.interface';
import { ConversationActorType } from 'src/database/entities/messaging/conversation.entity';

@Injectable()
export class ClientCompanyEvaluator implements PermissionEvaluator {
  readonly sourceType = ConversationActorType.CLIENT;
  readonly targetType = ConversationActorType.COMPANY;
  readonly name       = 'ClientCompanyEvaluator';

  async evaluate(_ctx: PermissionContext): Promise<PermissionResult> {
    return {
      granted:   true,
      reason:    'Un client peut toujours contacter une boutique Shopi.',
      evaluator: this.name,
    };
  }
}

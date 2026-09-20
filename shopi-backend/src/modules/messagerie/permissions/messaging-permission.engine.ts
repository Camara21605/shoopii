/* ============================================================
 * FICHIER : messaging-permission.engine.ts
 *
 * RÔLE : Moteur central de permissions de la messagerie ET des appels
 *        (CallService.assertCanCall passe par ici).
 *
 * RÈGLE (décision produit) — MESSAGERIE OUVERTE À TOUS :
 *   Tout utilisateur peut écrire ou appeler tout autre utilisateur, quels
 *   que soient leurs rôles et même sans aucune relation (ni commande, ni
 *   abonnement, ni contact téléphonique) :
 *     client ↔ client, client → entreprise / livreur / correspondant,
 *     entreprise ↔ entreprise, livreur ↔ livreur, correspondant ↔ correspondant,
 *     et toutes les autres combinaisons.
 *   Seules exceptions :
 *     1. on ne peut pas s'écrire à soi-même ;
 *     2. un BLOCAGE (BlockedUser, dans un sens ou dans l'autre) interdit de
 *        (re)contacter — protection contre le harcèlement, indispensable
 *        maintenant que n'importe qui peut écrire à n'importe qui.
 *
 *   Un client qui écrit à une entreprise / un livreur / un correspondant
 *   qu'il ne suit PAS n'est pas bloqué : l'interface l'avertit et lui propose
 *   de s'abonner (voir FollowSuggestion.tsx côté frontend).
 *
 * HISTORIQUE : les évaluateurs par paire de rôles (evaluators/*.ts,
 * commande / abonnement / contact requis) ne sont PLUS consultés ; ils
 * restent dans le dépôt pour pouvoir restreindre à nouveau la messagerie
 * si le produit le décide.
 *
 * PERFORMANCE : 1 requête indexée (blocage) ; pas de cache — un blocage
 * doit prendre effet immédiatement.
 * ============================================================ */

import {
  Injectable, Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import type { PermissionContext, PermissionResult } from './interfaces/permission-context.interface';
import { BlockedUser }              from 'src/database/entities/messaging/blocked-user.entity';
import { MessagingAuditService }    from './messaging-audit.service';

@Injectable()
export class MessagingPermissionEngine {
  private readonly logger = new Logger(MessagingPermissionEngine.name);

  constructor(
    private readonly audit: MessagingAuditService,

    @InjectRepository(BlockedUser)
    private readonly blockedRepo: Repository<BlockedUser>,
  ) {}

  // ── Point d'entrée principal ────────────────────────────────

  /**
   * Évalue si la conversation peut être créée.
   *
   * @throws ForbiddenException si la permission est refusée
   */
  async assertCanCreateConversation(ctx: PermissionContext): Promise<void> {
    const start  = Date.now();
    const result = await this.evaluate(ctx);
    result.durationMs = Date.now() - start;

    /* Log asynchrone — ne bloque pas */
    void this.audit.log(ctx, result);

    if (!result.granted) {
      this.logger.warn(
        `[Engine] DENIED ${ctx.requestorType}:${ctx.requestorId} → ` +
        `${ctx.targetType}:${ctx.targetId} | ${result.reason}`,
      );
      throw new ForbiddenException(result.reason);
    }

    this.logger.debug(
      `[Engine] GRANTED ${ctx.requestorType}:${ctx.requestorId} → ` +
      `${ctx.targetType}:${ctx.targetId} | ${result.evaluator}`,
    );
  }

  // ── Évaluation ──────────────────────────────────────────────

  private async evaluate(ctx: PermissionContext): Promise<PermissionResult> {
    const { requestorType, requestorId, targetType, targetId } = ctx;

    /* ── 1. Auto-conversation (soi-même) ─────────────────── */
    if (requestorType === targetType && requestorId === targetId) {
      return { granted: false, reason: 'Impossible d\'écrire à soi-même.', evaluator: 'SelfConversationGuard' };
    }

    /* ── 2. Blocage, dans un sens ou dans l'autre ────────── */
    if (ctx.requestorUserId && ctx.targetUserId) {
      const blocked = await this.blockedRepo.exists({
        where: [
          { blockerUserId: ctx.requestorUserId, blockedUserId: ctx.targetUserId },
          { blockerUserId: ctx.targetUserId,    blockedUserId: ctx.requestorUserId },
        ],
      });
      if (blocked) {
        return {
          granted:   false,
          reason:    'Vous ne pouvez pas contacter cet utilisateur (un blocage existe entre vous).',
          evaluator: 'BlockGuard',
        };
      }
    }

    /* ── 3. Tout le reste : autorisé ─────────────────────── */
    return {
      granted:   true,
      reason:    'Messagerie ouverte à tous les utilisateurs.',
      evaluator: 'OpenMessaging',
    };
  }

  // ── Exposition publique (appels, tests) ──────────────────────

  /** Vérifie sans lancer d'exception (pour vérification soft) */
  async check(ctx: PermissionContext): Promise<PermissionResult> {
    return this.evaluate(ctx);
  }
}

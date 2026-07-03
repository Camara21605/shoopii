/* ============================================================
 * FICHIER : messaging-permission.engine.ts
 *
 * RÔLE : Moteur central de permissions de la messagerie.
 *        Orchestre l'évaluation de chaque demande de conversation.
 *
 * PATTERNS UTILISÉS :
 *   - Strategy    : chaque évaluateur est une stratégie indépendante
 *   - Registry    : les évaluateurs sont enregistrés dans une Map
 *   - Chain       : fallback vers un évaluateur générique si pas de
 *                   règle spécifique
 *   - Open/Closed : ajouter un évaluateur = zéro modification ici
 *
 * FLOW D'EXÉCUTION :
 *   1. Vérifie le cache Redis (< 1ms si hit)
 *   2. Résout l'évaluateur correspondant à la paire (type, type)
 *   3. Si PARTNER impliqué → évaluateur ALWAYS
 *   4. Sinon → évaluateur spécifique OU fallback DENIED
 *   5. Stocke le résultat en cache
 *   6. Log en audit (async, jamais bloquant)
 *
 * PERFORMANCES :
 *   Cache HIT  → O(1) Redis GET
 *   Cache MISS → 1-3 requêtes SQL optimisées par index
 *   Objectif   : < 5ms p99 avec cache chaud
 * ============================================================ */

import {
  Injectable, Logger,
  ForbiddenException, Inject,
} from '@nestjs/common';
import type { PermissionEvaluator } from './interfaces/permission-evaluator.interface';
import { PERMISSION_EVALUATORS }    from './interfaces/permission-evaluator.interface';
import type { PermissionContext, PermissionResult } from './interfaces/permission-context.interface';
import { ConversationActorType }    from 'src/database/entities/messaging/conversation.entity';
import { PermissionCacheService }   from './permission-cache.service';
import { MessagingAuditService }    from './messaging-audit.service';

@Injectable()
export class MessagingPermissionEngine {
  private readonly logger   = new Logger(MessagingPermissionEngine.name);

  /**
   * Registre des évaluateurs : clé = "sourceType:targetType"
   * Construit une seule fois à l'init depuis le tableau injecté.
   */
  private readonly registry = new Map<string, PermissionEvaluator>();

  constructor(
    @Inject(PERMISSION_EVALUATORS)
    evaluators: PermissionEvaluator[],

    private readonly cache: PermissionCacheService,
    private readonly audit: MessagingAuditService,
  ) {
    this.buildRegistry(evaluators);
  }

  // ── Initialisation ──────────────────────────────────────────

  private buildRegistry(evaluators: PermissionEvaluator[]): void {
    for (const ev of evaluators) {
      this.registry.set(this.registryKey(ev.sourceType, ev.targetType), ev);
    }
    this.logger.log(`[Engine] ${this.registry.size} évaluateurs enregistrés`);
  }

  private registryKey(source: string, target: string): string {
    return `${source}:${target}`;
  }

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
      `${ctx.targetType}:${ctx.targetId} | ${result.evaluator} | cached=${result.cached ?? false}`,
    );
  }

  // ── Évaluation interne ──────────────────────────────────────

  private async evaluate(ctx: PermissionContext): Promise<PermissionResult> {
    const { requestorType, requestorId, targetType, targetId } = ctx;

    /* ── 1. Cache Redis ──────────────────────────────────── */
    const cached = await this.cache.get(requestorType, requestorId, targetType, targetId);
    if (cached) return cached;

    /* ── 2. Auto-conversation (soi-même) ─────────────────── */
    if (requestorType === targetType && requestorId === targetId) {
      return { granted: false, reason: 'Impossible d\'écrire à soi-même.', evaluator: 'SelfConversationGuard' };
    }

    /* ── 3. Partenaire → n'importe qui ───────────────────── */
    if (requestorType === ConversationActorType.PARTNER) {
      const result: PermissionResult = {
        granted: true, reason: 'Accès partenaire complet.', evaluator: 'PartnerShortCircuit',
      };
      await this.setCache(requestorType, requestorId, targetType, targetId, result, 3600);
      return result;
    }

    /* ── 4. N'importe qui → Partenaire ───────────────────── */
    if (targetType === ConversationActorType.PARTNER) {
      const result: PermissionResult = {
        granted: true, reason: 'Communication libre avec un partenaire.', evaluator: 'PartnerShortCircuit',
      };
      await this.setCache(requestorType, requestorId, targetType, targetId, result, 3600);
      return result;
    }

    /* ── 5. Évaluateur spécifique ────────────────────────── */
    const evaluator = this.registry.get(
      this.registryKey(requestorType, targetType),
    );

    if (evaluator) {
      const result = await evaluator.evaluate(ctx);
      const ttl    = PermissionCacheService.ttlFor(evaluator.name);
      await this.setCache(requestorType, requestorId, targetType, targetId, result, ttl);
      return result;
    }

    /* ── 6. Fallback : aucune règle définie → DENY ───────── */
    const fallback: PermissionResult = {
      granted:   false,
      reason:    `Aucune règle de permission définie pour ${requestorType} → ${targetType}.`,
      evaluator: 'FallbackDeny',
    };
    this.logger.warn(
      `[Engine] Aucun évaluateur pour ${requestorType}→${targetType}. ` +
      'Ajoutez un PermissionEvaluator pour cette paire.',
    );
    return fallback;
  }

  // ── Cache helper ─────────────────────────────────────────────

  private async setCache(
    sourceType: string, sourceId: string,
    targetType: string, targetId: string,
    result: PermissionResult,
    ttl: number,
  ): Promise<void> {
    /* On cache uniquement les GRANTED pour éviter de bloquer
       un utilisateur qui vient d'acquérir le droit (ex: nouvelle commande) */
    if (result.granted) {
      await this.cache.set(sourceType, sourceId, targetType, targetId, result, ttl);
    }
  }

  // ── Exposition publique pour les cas de test ─────────────────

  /** Vérifie sans lancer d'exception (pour vérification soft) */
  async check(ctx: PermissionContext): Promise<PermissionResult> {
    return this.evaluate(ctx);
  }
}

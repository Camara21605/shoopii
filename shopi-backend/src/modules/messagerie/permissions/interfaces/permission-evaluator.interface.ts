/* ============================================================
 * FICHIER : permission-evaluator.interface.ts
 *
 * RÔLE : Contrat que chaque évaluateur doit respecter.
 *
 * PATTERN : Strategy + Open/Closed Principle
 *   - Ajouter un nouveau couple de rôles = créer une nouvelle
 *     classe qui implements PermissionEvaluator.
 *   - Zéro modification du MessagingPermissionEngine.
 *   - Zéro if imbriqué dans le moteur.
 *
 * INSCRIPTION :
 *   Chaque évaluateur est enregistré dans le moteur via
 *   le token d'injection PERMISSION_EVALUATORS (tableau).
 * ============================================================ */

import type { PermissionContext, PermissionResult } from './permission-context.interface';
import type { ConversationActorType } from 'src/database/entities/messaging/conversation.entity';

export interface PermissionEvaluator {
  /** Types de l'initiateur que cet évaluateur gère */
  readonly sourceType: ConversationActorType;

  /** Types de la cible que cet évaluateur gère */
  readonly targetType: ConversationActorType;

  /** Nom lisible de l'évaluateur (pour les logs et l'audit) */
  readonly name: string;

  /**
   * Évalue si la conversation peut être créée.
   * Ne doit JAMAIS lancer d'exception — retourner { granted: false } à la place.
   */
  evaluate(ctx: PermissionContext): Promise<PermissionResult>;
}

/* Token d'injection pour le tableau d'évaluateurs */
export const PERMISSION_EVALUATORS = 'PERMISSION_EVALUATORS';

/* ============================================================
 * FICHIER : permission-context.interface.ts
 *
 * RÔLE : Objet de contexte passé à chaque évaluateur.
 *        Contient TOUTES les informations disponibles au moment
 *        de la demande, sans que chaque évaluateur ne refasse
 *        ses propres requêtes.
 *
 * DESIGN :
 *   Le MessagingPermissionEngine construit ce contexte une seule
 *   fois, puis le passe à l'évaluateur correspondant.
 *   L'évaluateur NE FAIT PAS de requêtes DB lui-même —
 *   il utilise les données du contexte ou des méthodes de lookup
 *   injectées.
 * ============================================================ */

import { ConversationActorType } from 'src/database/entities/messaging/conversation.entity';

export interface PermissionContext {
  /* Qui initie la demande */
  requestorType: ConversationActorType;
  requestorId:   string;   // profile UUID (clients.id, companies.id…)
  requestorUserId: string; // users.id (JWT sub)

  /* Vers qui */
  targetType: ConversationActorType;
  targetId:   string;   // profile UUID
  targetUserId?: string; // users.id (résolu par le moteur)

  /* Métadonnées de la requête HTTP */
  ipAddress?:   string;
  userAgent?:   string;
  requestedAt:  Date;
}

/* Résultat d'évaluation retourné par chaque évaluateur */
export interface PermissionResult {
  granted:   boolean;
  reason:    string;           // Message lisible
  evaluator: string;           // Nom de la classe qui a décidé
  cached?:   boolean;          // true = lu depuis Redis
  durationMs?: number;         // Perf tracking
}

/* ============================================================
 * FICHIER      : src/modules/event-orchestration/event-orchestration.engine.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Façade publique du moteur d'orchestration d'événements
 * RESPONSABILITES :
 *   - Exposer une API unifiée : publish(), subscribe(), getMetrics(), getDlq()
 *   - Orchestrer EventBusService + EventPublisherService + DlqService
 *   - Permettre le rejeu des entrées DLQ (replayDlqEntry)
 *   - Exposer les métriques d'observabilité pour le dashboard Super Admin
 *   - Aucun module ne dépend des services internes — ils passent par cet engine
 * SECURITE :
 *   - Aucune stack trace exposée au client
 *   - Toutes les opérations admin (clear DLQ, replay) doivent être appelées
 *     via un guard de rôle (Super Admin uniquement)
 * DEPENDANCES  :
 *   EventBusService, EventPublisherService, EventAuditService, DlqService
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';

import { EventBusService }       from './services/event-bus.service';
import { EventPublisherService } from './services/event-publisher.service';
import { EventAuditService }     from './services/event-audit.service';
import { DlqService }            from './services/dlq.service';

import {
  ShopiEvent,
  EventSource,
  EventName,
  PublishResult,
  DlqEntry,
  EventMetrics,
} from './types/events.types';

/* ============================================================
 * ENGINE
 * ============================================================ */

@Injectable()
export class EventOrchestrationEngine {

  private readonly logger = new Logger(EventOrchestrationEngine.name);

  constructor(
    private readonly bus:       EventBusService,
    private readonly publisher: EventPublisherService,
    private readonly audit:     EventAuditService,
    private readonly dlq:       DlqService,
  ) {}

  /* ==========================================================
   * PUBLICATION
   * ========================================================== */

  /**
   * Publie un événement de façon fire-and-forget via setImmediate().
   *
   * Déduplication automatique par eventId (TTL 5 min).
   * Point d'entrée principal pour tous les modules producteurs.
   *
   * @example
   * engine.publish('order.created', payload, EventSource.COMMANDE, { correlationId });
   */
  publish<T>(
    eventName:  EventName | string,
    payload:    T,
    source:     EventSource,
    options?: {
      correlationId?: string;
      causationId?:   string;
      eventId?:       string;
    },
  ): PublishResult {
    return this.publisher.publish(eventName, payload, source, options);
  }

  /**
   * Publie un événement de façon synchrone.
   * À réserver aux tests ou aux flux où la confirmation d'émission est requise.
   */
  publishSync<T>(
    eventName: EventName | string,
    payload:   T,
    source:    EventSource,
  ): PublishResult {
    return this.publisher.publishSync(eventName, payload, source);
  }

  /* ==========================================================
   * ABONNEMENTS
   * ========================================================== */

  /**
   * Abonne un handler à un événement.
   * Les subscribers internes l'utilisent via onModuleInit().
   * Les modules externes peuvent s'y abonner pour des comportements additionnels.
   *
   * IMPORTANT : toujours passer une fonction fléchée ou utiliser .bind(this)
   * pour conserver le contexte du handler.
   */
  subscribe<T>(
    eventName: EventName | string,
    handler:   (event: ShopiEvent<T>) => void | Promise<void>,
  ): void {
    this.bus.onEvent<T>(eventName, handler);
    this.logger.debug(`Abonnement ajouté : ${eventName}`);
  }

  /**
   * Abonnement one-shot : le handler est désabonné après la première invocation.
   */
  subscribeOnce<T>(
    eventName: EventName | string,
    handler:   (event: ShopiEvent<T>) => void | Promise<void>,
  ): void {
    this.bus.onceEvent<T>(eventName, handler);
  }

  /**
   * Désabonne un handler d'un événement.
   * Appelé par onModuleDestroy() des subscribers pour éviter les fuites mémoire.
   */
  unsubscribe<T>(
    eventName: EventName | string,
    handler:   (event: ShopiEvent<T>) => void | Promise<void>,
  ): void {
    this.bus.offEvent<T>(eventName, handler);
  }

  /* ==========================================================
   * OBSERVABILITÉ
   * ========================================================== */

  /**
   * Retourne un snapshot complet des métriques d'événements.
   * Exposé via un endpoint admin pour le dashboard Super Admin.
   *
   * Contient : totaux publiés/consommés/échoués, DLQ, taux d'échec,
   * temps de traitement moyen, uptime, top événements.
   */
  getMetrics(): EventMetrics & { failureRate: number; topEvents: Array<{ eventName: string; count: number }> } {
    return {
      ...this.audit.getMetrics(),
      failureRate: this.audit.failureRate(),
      topEvents:   this.audit.topEvents(10),
    };
  }

  /**
   * Nombre d'abonnés actifs pour un événement donné.
   */
  subscriberCount(eventName: EventName | string): number {
    return this.bus.subscriberCount(eventName);
  }

  /**
   * Liste tous les noms d'événements ayant au moins un abonné.
   */
  activeEventNames(): string[] {
    return this.bus.activeEventNames();
  }

  /**
   * Nombre total d'événements émis depuis le démarrage.
   */
  get totalEmitted(): number {
    return this.bus.emittedCount;
  }

  /**
   * Uptime du bus en millisecondes.
   */
  get uptimeMs(): number {
    return this.bus.uptimeMs;
  }

  /* ==========================================================
   * DEAD LETTER QUEUE
   * ========================================================== */

  /**
   * Retourne la liste paginée des entrées DLQ.
   * Réservé aux Super Admins via le controller d'administration.
   */
  getDlq(page = 1, limit = 50): { items: DlqEntry[]; total: number; pages: number } {
    return this.dlq.list(page, limit);
  }

  /**
   * Taille actuelle de la DLQ.
   */
  get dlqSize(): number {
    return this.dlq.size;
  }

  /**
   * Rejoue un événement depuis la DLQ.
   *
   * Le processus :
   *   1. Récupère l'entrée DLQ par ID
   *   2. Republics l'événement original via publish() (nouveau UUID généré)
   *   3. Supprime l'entrée de la DLQ si la republication a réussi
   *
   * En cas d'échec du rejeu, l'entrée DLQ reste présente.
   *
   * @param dlqId  ID de l'entrée DLQ à rejouer
   * @returns true si rejoué et retiré de la DLQ, false sinon
   */
  replayDlqEntry(dlqId: string): boolean {
    const entry = this.dlq.findById(dlqId);

    if (!entry) {
      this.logger.warn(`replayDlqEntry — entrée introuvable : ${dlqId}`);
      return false;
    }

    const { event } = entry;

    try {
      /* Republication avec nouveau UUID pour éviter la déduplication */
      this.publisher.publish(
        event.eventName,
        event.payload,
        event.source,
        {
          correlationId: event.correlationId,
          causationId:   event.id,
        },
      );

      this.dlq.markResolved(dlqId);

      this.logger.log(
        `replayDlqEntry — rejoué : ${event.eventName} (dlqId=${dlqId}, ` +
        `originalId=${event.id})`,
      );

      return true;

    } catch (err) {
      this.logger.error(
        `replayDlqEntry — échec du rejeu (dlqId=${dlqId}) : ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * Vide la DLQ entière.
   * Opération réservée au Super Admin — à appeler uniquement après audit.
   */
  clearDlq(): void {
    this.logger.warn(`clearDlq — vidage de la DLQ par un administrateur`);
    this.dlq.clear();
  }

  /* ==========================================================
   * RESET (TESTS / MAINTENANCE)
   * ========================================================== */

  /**
   * Réinitialise les compteurs de métriques.
   * Usage : tests unitaires ou redémarrage mensuel automatique (via scheduler).
   */
  resetMetrics(): void {
    this.audit.reset();
    this.logger.log('resetMetrics — compteurs réinitialisés');
  }
}

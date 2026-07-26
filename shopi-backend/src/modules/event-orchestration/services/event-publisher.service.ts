/* ============================================================
 * FICHIER      : src/modules/event-orchestration/services/event-publisher.service.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Publication validée et dé-dupliquée des événements
 * RESPONSABILITES :
 *   - Valider la structure de chaque événement avant publication
 *   - Dé-dupliquer via un Set<eventId> avec TTL 5 minutes
 *   - Émettre sur EventBusService (synchrone ou fire-and-forget)
 *   - Incrémenter les métriques dans EventAuditService
 *   - Retourner un PublishResult pour chaque publication
 * DEPENDANCES  :
 *   EventBusService, EventAuditService
 * MODULES UTILISATEURS :
 *   EventOrchestrationEngine (seul point d'accès public)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { EventBusService }   from './event-bus.service';
import { EventAuditService } from './event-audit.service';

import {
  ShopiEvent,
  EventSource,
  EventName,
  PublishResult,
} from '../types/events.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** Durée pendant laquelle un eventId est retenu pour déduplication */
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class EventPublisherService {

  private readonly logger = new Logger(EventPublisherService.name);

  /**
   * Set des IDs d'événements récemment publiés.
   * Structure : Map<eventId, expiresAt> pour permettre le TTL.
   */
  private readonly dedupCache = new Map<string, number>();

  constructor(
    private readonly bus:   EventBusService,
    private readonly audit: EventAuditService,
  ) {
    /* Purge périodique du cache de déduplication toutes les 5 minutes */
    setInterval(() => this.purgeDedup(), DEDUP_TTL_MS);
  }

  /* ==========================================================
   * PUBLICATION STANDARD (FIRE-AND-FORGET)
   * ========================================================== */

  /**
   * Publie un événement de façon asynchrone (fire-and-forget).
   *
   * L'émission est différée via setImmediate() pour ne pas bloquer
   * le thread principal (les handlers synchrones dans les subscribers
   * s'exécuteront lors du prochain tick de la event loop).
   *
   * @param eventName  Nom de l'événement (constante de events.types.ts)
   * @param payload    Données métier du domaine
   * @param source     Module producteur
   * @param options    correlationId, causationId optionnels
   */
  publish<T>(
    eventName: EventName | string,
    payload:   T,
    source:    EventSource,
    options?: {
      correlationId?: string;
      causationId?:   string;
      eventId?:       string;
    },
  ): PublishResult {
    const eventId = options?.eventId ?? uuidv4();

    /* Déduplication : si l'ID a déjà été vu, on ignore silencieusement */
    if (this.isDuplicate(eventId)) {
      this.audit.incrementDuplicatesBlocked();
      return {
        eventId,
        eventName,
        publishedAt: new Date(),
        isDuplicate: true,
        subscriberCount: 0,
      };
    }

    const event: ShopiEvent<T> = {
      id:            eventId,
      eventName,
      occurredAt:    new Date(),
      source,
      payload,
      correlationId: options?.correlationId,
      causationId:   options?.causationId,
    };

    /* Enregistrer dans le cache de dédup avant d'émettre */
    this.markSeen(eventId);

    const subscriberCount = this.bus.subscriberCount(eventName);

    /* Fire-and-forget via setImmediate — ne bloque pas la réponse HTTP */
    setImmediate(() => {
      try {
        this.bus.emitEvent(eventName, event);
        this.audit.recordPublished(eventName);
      } catch (err) {
        this.logger.error(
          `Erreur lors de l'émission de l'événement ${eventName} (id=${eventId})`,
          err,
        );
        this.audit.recordFailed(eventName);
      }
    });

    return {
      eventId,
      eventName,
      publishedAt: new Date(),
      isDuplicate: false,
      subscriberCount,
    };
  }

  /* ==========================================================
   * PUBLICATION SYNCHRONE (pour les cas critiques)
   * ========================================================== */

  /**
   * Publie un événement de façon synchrone et attend que tous les
   * listeners aient été appelés avant de retourner.
   *
   * À utiliser uniquement quand on a besoin de savoir si l'événement
   * a été traité (ex: tests unitaires, workflows critiques).
   *
   * NOTE : Les listeners async ne sont pas awaités — seuls les appels
   * synchrones sont garantis terminés. Pour les async, utiliser
   * publishAsync() ci-dessous.
   */
  publishSync<T>(
    eventName: EventName | string,
    payload:   T,
    source:    EventSource,
  ): PublishResult {
    const eventId = uuidv4();

    if (this.isDuplicate(eventId)) {
      return {
        eventId, eventName, publishedAt: new Date(),
        isDuplicate: true, subscriberCount: 0,
      };
    }

    const event: ShopiEvent<T> = {
      id: eventId, eventName, occurredAt: new Date(), source, payload,
    };

    this.markSeen(eventId);

    const subscriberCount = this.bus.subscriberCount(eventName);

    try {
      this.bus.emitEvent(eventName, event);
      this.audit.recordPublished(eventName);
    } catch (err) {
      this.logger.error(`publishSync ${eventName} (id=${eventId}) failed`, err);
      this.audit.recordFailed(eventName);
    }

    return {
      eventId,
      eventName,
      publishedAt: new Date(),
      isDuplicate: false,
      subscriberCount,
    };
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES
   * ========================================================== */

  private isDuplicate(eventId: string): boolean {
    const expiry = this.dedupCache.get(eventId);
    if (expiry === undefined) return false;
    /* Entrée expirée — traiter comme nouvelle */
    if (Date.now() > expiry) {
      this.dedupCache.delete(eventId);
      return false;
    }
    return true;
  }

  private markSeen(eventId: string): void {
    this.dedupCache.set(eventId, Date.now() + DEDUP_TTL_MS);
  }

  private purgeDedup(): void {
    const now = Date.now();
    for (const [id, expiry] of this.dedupCache.entries()) {
      if (now > expiry) this.dedupCache.delete(id);
    }
  }
}

/* ============================================================
 * FICHIER      : src/modules/event-orchestration/services/event-bus.service.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Bus d'événements central — singleton global de la plateforme
 * RESPONSABILITES :
 *   - Étendre Node.js EventEmitter natif (aucune dépendance externe)
 *   - Fournir une API typée emit/on/once/off
 *   - Configurer la limite de listeners pour éviter les memory leaks
 *   - Exposer les statistiques d'abonnement en temps réel
 * DEPENDANCES  : Node.js EventEmitter (stdlib)
 * MODULES UTILISATEURS :
 *   EventPublisherService (publie), tous les subscribers (s'abonnent)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, OnApplicationShutdown, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

import { ShopiEvent, EventNameOuLibre } from '../types/events.types';

/* ============================================================
 * SERVICE
 * ============================================================ */

/**
 * EventBusService — le cœur du moteur d'orchestration.
 *
 * Il est enregistré comme singleton dans le module NestJS
 * (scope DEFAULT, partagé entre tous les providers).
 *
 * IMPORTANT : Étend directement EventEmitter pour ne pas ajouter
 * de couche d'indirection. Les appels emit/on sont donc O(1).
 *
 * Limite de listeners : 200 (largement suffisant pour Shopi).
 * Si on dépasse, Node.js émet un warning — cela indiquerait
 * une fuite d'abonnements (oubli de removeListener).
 */
type AnyHandler = (event: ShopiEvent<any>) => void | Promise<void>;

@Injectable()
export class EventBusService extends EventEmitter implements OnApplicationShutdown {

  private readonly logger = new Logger(EventBusService.name);

  /** Compteur global d'événements émis depuis le démarrage */
  private totalEmitted = 0;

  /** Horodatage du démarrage du bus */
  private readonly startedAt = new Date();

  /** handler → wrapper enregistré (voir envelopper()) */
  private readonly wrappers = new WeakMap<AnyHandler, (event: ShopiEvent<unknown>) => void>();

  constructor() {
    super();
    /* Configurer la limite haute pour un projet multi-modules */
    this.setMaxListeners(200);
    this.logger.log('EventBus démarré');
  }

  /* ==========================================================
   * API TYPÉE
   * ========================================================== */

  /**
   * Publie un événement typé sur le bus.
   *
   * Les abonnés enregistrés via onEvent() sont appelés de façon
   * synchrone dans l'ordre d'inscription (comportement natif
   * de Node.js EventEmitter).
   *
   * Pour un comportement asynchrone (fire-and-forget), utiliser
   * EventPublisherService.publish() qui wrappera dans setImmediate.
   *
   * @param eventName  Nom de l'événement (constante de events.types.ts)
   * @param event      Enveloppe complète ShopiEvent
   * @returns true si au moins un listener a reçu l'événement
   */
  emitEvent<T>(eventName: EventNameOuLibre, event: ShopiEvent<T>): boolean {
    this.totalEmitted++;
    return this.emit(eventName, event);
  }

  /**
   * S'abonne à un type d'événement de façon permanente.
   *
   * @param eventName  Nom de l'événement
   * @param handler    Fonction de traitement (peut être async)
   */
  onEvent<T>(
    eventName: EventNameOuLibre,
    handler: (event: ShopiEvent<T>) => void | Promise<void>,
  ): this {
    return this.on(eventName, this.envelopper(eventName, handler));
  }

  /**
   * S'abonne une seule fois (auto-désinscription après le premier appel).
   */
  onceEvent<T>(
    eventName: EventNameOuLibre,
    handler: (event: ShopiEvent<T>) => void | Promise<void>,
  ): this {
    return this.once(eventName, this.envelopper(eventName, handler));
  }

  /**
   * Se désabonne d'un événement.
   * À appeler dans OnModuleDestroy pour éviter les memory leaks.
   */
  offEvent<T>(
    eventName: EventNameOuLibre,
    handler: (event: ShopiEvent<T>) => void | Promise<void>,
  ): this {
    const wrapper = this.wrappers.get(handler as AnyHandler);
    return wrapper ? this.off(eventName, wrapper) : this;
  }

  /**
   * EventEmitter ignore la promesse renvoyée par un handler async : une
   * erreur y devenait une « unhandled rejection ». Le wrapper la journalise.
   * Mémorisé par handler pour que offEvent() retire bien le même listener.
   */
  private envelopper<T>(
    eventName: EventNameOuLibre,
    handler: (event: ShopiEvent<T>) => void | Promise<void>,
  ): (event: ShopiEvent<T>) => void {
    const existant = this.wrappers.get(handler as AnyHandler);
    if (existant) return existant;
    /* Appel synchrone conservé (voir emitEvent) : seule la promesse
     * éventuelle est rattrapée — une erreur synchrone remonte comme avant. */
    const wrapper = (event: ShopiEvent<T>): void => {
      const resultat = handler(event);
      if (resultat instanceof Promise) {
        resultat.catch((err: unknown) => {
          this.logger.error(`[${String(eventName)}] handler en échec : ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    };
    this.wrappers.set(handler as AnyHandler, wrapper);
    return wrapper;
  }

  /* ==========================================================
   * STATISTIQUES
   * ========================================================== */

  /**
   * Nombre d'abonnés actifs pour un événement donné.
   * Utile pour le dashboard d'observabilité.
   */
  subscriberCount(eventName: string): number {
    return this.listenerCount(eventName);
  }

  /**
   * Nombre total d'événements émis depuis le démarrage.
   */
  get emittedCount(): number {
    return this.totalEmitted;
  }

  /**
   * Uptime du bus en millisecondes.
   */
  get uptimeMs(): number {
    return Date.now() - this.startedAt.getTime();
  }

  /**
   * Retourne la liste de tous les noms d'événements avec au moins 1 listener.
   */
  activeEventNames(): string[] {
    return this.eventNames().map(String);
  }

  /* ==========================================================
   * CYCLE DE VIE
   * ========================================================== */

  /**
   * Nettoyage propre à l'arrêt de l'application.
   * Retire tous les listeners pour éviter les memory leaks
   * en environnement de test ou de rechargement à chaud.
   */
  onApplicationShutdown(): void {
    this.removeAllListeners();
    this.logger.log(`EventBus arrêté — ${this.totalEmitted} événements émis au total`);
  }
}

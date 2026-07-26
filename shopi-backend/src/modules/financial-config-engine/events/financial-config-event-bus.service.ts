/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/events/financial-config-event-bus.service.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Bus d'événements interne du FinancialConfigEngine.
 *                Étend Node.js EventEmitter natif — pas de dépendance
 *                à @nestjs/event-emitter conformément à la Charte.
 * RESPONSABILITES :
 *   - Fournir un singleton EventEmitter partagé entre les services
 *   - Exposer les méthodes emit/on typées
 * DEPENDANCES  : EventEmitter (Node.js natif)
 * UTILISE PAR  :
 *   FinancialConfigWriterService → émet les événements
 *   Modules consommateurs        → s'abonnent aux événements
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class FinancialConfigEventBus extends EventEmitter {
  constructor() {
    super();
    /**
     * Augmente la limite par défaut (10) pour éviter les warnings
     * lorsque plusieurs modules s'abonnent aux mêmes événements.
     */
    this.setMaxListeners(30);
  }
}

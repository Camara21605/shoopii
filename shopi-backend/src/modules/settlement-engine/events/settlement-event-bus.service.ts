/* ============================================================
 * FICHIER : src/modules/settlement-engine/events/settlement-event-bus.service.ts
 *
 * RÔLE    : Bus d'événements interne du Settlement Engine.
 *           Étend Node.js EventEmitter (pas @nestjs/event-emitter).
 *           Autres modules s'abonnent en injectant ce service.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class SettlementEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }
}

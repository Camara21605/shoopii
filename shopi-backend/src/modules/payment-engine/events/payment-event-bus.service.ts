/* ============================================================
 * FICHIER : src/modules/payment-engine/events/payment-event-bus.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Bus d'événements interne du Payment Engine.
 * Étend EventEmitter Node.js (pas @nestjs/event-emitter).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class PaymentEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }
}

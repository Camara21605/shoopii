/* ============================================================
 * FICHIER : src/modules/escrow-engine/events/escrow-event-bus.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Bus d'événements interne pour l'EscrowEngine.
 * Basé sur Node.js EventEmitter (pas @nestjs/event-emitter).
 * Les événements sont fire-and-forget — jamais bloquants.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class EscrowEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }
}

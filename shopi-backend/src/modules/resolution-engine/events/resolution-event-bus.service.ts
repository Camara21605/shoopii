/* ============================================================
 * FICHIER : src/modules/resolution-engine/events/resolution-event-bus.service.ts
 *
 * RÔLE    : Bus d'événements interne du Resolution Engine.
 *           Utilise Node.js EventEmitter natif (pas @nestjs/event-emitter).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class ResolutionEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }
}

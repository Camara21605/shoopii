/* ============================================================
 * CommissionEventBus — bus d'événements léger pour le module Commission
 *
 * Wrapping du Node.js EventEmitter natif.
 * Évite la dépendance @nestjs/event-emitter non installée.
 * Compatible avec un remplacement futur par EventEmitter2.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class CommissionEventBus extends EventEmitter {

  constructor() {
    super();
    /* Augmenter le nombre maximum d'écouteurs pour éviter les warnings */
    this.setMaxListeners(50);
  }
}

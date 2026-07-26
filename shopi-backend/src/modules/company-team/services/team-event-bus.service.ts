/*
 * FICHIER : src/modules/company-team/services/team-event-bus.service.ts
 * ROLE    : Bus d'événements interne au module Company Team.
 *
 * Encapsule le EventEmitter natif de Node.js dans un service NestJS injectable
 * pour éviter une dépendance sur @nestjs/event-emitter qui n'est pas installé.
 * L'API (emit / on / off) est strictement identique à EventEmitter2 de base.
 *
 * AUTEUR  : Shopi03
 * DATE    : 2026-07-18
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class TeamEventBusService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }
}

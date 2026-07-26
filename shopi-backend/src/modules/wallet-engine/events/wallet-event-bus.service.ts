/* ============================================================
 * FICHIER : src/modules/wallet-engine/events/wallet-event-bus.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Bus d'événements interne du Wallet Engine.
 * Étend Node.js EventEmitter natif (pas de @nestjs/event-emitter
 * requis — non installé dans ce projet).
 *
 * Usage :
 *   eventBus.emit(WALLET_EVENTS.OPERATION_SUCCESS, event);
 *   eventBus.on(WALLET_EVENTS.OPERATION_SUCCESS, handler);
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class WalletEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }
}

/* ============================================================
 * NOMS D'ÉVÉNEMENTS (constants centralisées)
 * ============================================================ */

export const WALLET_EVENTS = {
  /** Opération réussie (crédit, débit, blocage, etc.). */
  OPERATION_SUCCESS:   'wallet.operation.success',

  /** Opération échouée (validation, concurrence, etc.). */
  OPERATION_FAILED:    'wallet.operation.failed',

  /** Wallet gelé par admin. */
  WALLET_FROZEN:       'wallet.frozen',

  /** Wallet dégelé par admin. */
  WALLET_UNFROZEN:     'wallet.unfrozen',

  /** Séquestre crédité (commande payée). */
  ESCROW_CREDITED:     'wallet.escrow.credited',

  /** Séquestre libéré (livraison confirmée). */
  ESCROW_RELEASED:     'wallet.escrow.released',

  /** Séquestre annulé (remboursement). */
  ESCROW_CANCELLED:    'wallet.escrow.cancelled',

  /** Retrait initié vers provider externe. */
  WITHDRAWAL_INITIATED:'wallet.withdrawal.initiated',

  /** Retrait confirmé par provider. */
  WITHDRAWAL_CONFIRMED:'wallet.withdrawal.confirmed',

  /** Retrait échoué — fonds retournés au wallet. */
  WITHDRAWAL_FAILED:   'wallet.withdrawal.failed',
} as const;

/* ============================================================
 * FICHIER      : src/modules/event-orchestration/types/events.types.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Contrat complet de tous les événements métier Shopi
 * RESPONSABILITES :
 *   - Définir le type de base ShopiEvent (enveloppe commune)
 *   - Déclarer les constantes de noms d'événements par domaine
 *   - Définir les payloads typés pour chaque événement
 *   - Servir de source unique de vérité pour le pub/sub
 * DEPENDANCES  : Aucune (types purs)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

/* ============================================================
 * ENVELOPPE DE BASE — TOUS LES ÉVÉNEMENTS L'IMPLÉMENTENT
 * ============================================================ */

/**
 * Interface socle de tout événement Shopi.
 * id → UUID v4 pour déduplication, source → module producteur.
 */
export interface ShopiEvent<T = unknown> {
  id:             string;
  eventName:      string;
  occurredAt:     Date;
  source:         EventSource;
  payload:        T;
  correlationId?: string;
  causationId?:   string;
}

/**
 * Modules producteurs d'événements — identifie la source d'un événement.
 */
export enum EventSource {
  AUTH           = 'auth',
  COMMANDE       = 'commande',
  PAIEMENT       = 'paiement',
  WALLET         = 'wallet',
  ESCROW         = 'escrow',
  COMMISSION     = 'commission',
  DELIVERY       = 'delivery',
  CORRESPONDENT  = 'correspondent',
  MESSAGERIE     = 'messagerie',
  CALL           = 'call',
  DISPUTE        = 'dispute',
  WITHDRAWAL     = 'withdrawal',
  REPORTING      = 'reporting',
  SYSTEM         = 'system',
  SCHEDULER      = 'scheduler',
}

/* ============================================================
 * CONSTANTES — NOMS D'ÉVÉNEMENTS PAR DOMAINE
 * Notation pointée : {domaine}.{action}
 * ============================================================ */

export const USER_EVENTS = {
  CREATED:          'user.created',
  UPDATED:          'user.updated',
  VERIFIED:         'user.verified',
  BLOCKED:          'user.blocked',
  UNBLOCKED:        'user.unblocked',
  PASSWORD_CHANGED: 'user.password_changed',
  PROFILE_COMPLETE: 'user.profile_complete',
} as const;

export const ORDER_EVENTS = {
  CREATED:         'order.created',
  PAID:            'order.paid',
  CONFIRMED:       'order.confirmed',
  IN_PROGRESS:     'order.in_progress',
  AWAITING_CLIENT: 'order.awaiting_client',
  DELIVERED:       'order.delivered',
  AUTO_DELIVERED:  'order.auto_delivered',
  CANCELLED:       'order.cancelled',
  DISPUTE_OPENED:  'order.dispute_opened',
  COMPLETED:       'order.completed',
} as const;

export const PAYMENT_EVENTS = {
  INITIATED:           'payment.initiated',
  CONFIRMED:           'payment.confirmed',
  FAILED:              'payment.failed',
  EXPIRED:             'payment.expired',
  REFUNDED:            'payment.refunded',
  PARTIALLY_REFUNDED:  'payment.partially_refunded',
  WEBHOOK_RECEIVED:    'payment.webhook_received',
  DOUBLE_BLOCKED:      'payment.double_payment_blocked',
} as const;

export const ESCROW_EVENTS = {
  FUNDS_HELD:     'escrow.funds_held',
  FUNDS_RELEASED: 'escrow.funds_released',
  FUNDS_REFUNDED: 'escrow.funds_refunded',
  AUTO_RELEASED:  'escrow.auto_released',
  EXPIRED:        'escrow.expired',
  CANCELLED:      'escrow.cancelled',
} as const;

export const WALLET_EVENTS = {
  CREATED:          'wallet.created',
  CREDITED:         'wallet.credited',
  DEBITED:          'wallet.debited',
  FROZEN:           'wallet.frozen',
  UNFROZEN:         'wallet.unfrozen',
  BALANCE_LOW:      'wallet.balance_low',
  BALANCE_NEGATIVE: 'wallet.balance_negative',
} as const;

export const COMMISSION_EVENTS = {
  CALCULATED:         'commission.calculated',
  DISTRIBUTED:        'commission.distributed',
  RULE_CHANGED:       'commission.rule_changed',
  DISTRIBUTION_FAILED:'commission.distribution_failed',
} as const;

export const DELIVERY_EVENTS = {
  ASSIGNED:      'delivery.assigned',
  STARTED:       'delivery.started',
  CODE_VALIDATED:'delivery.code_validated',
  COMPLETED:     'delivery.completed',
  CANCELLED:     'delivery.cancelled',
  DELAYED:       'delivery.delayed',
} as const;

export const CORRESPONDENT_EVENTS = {
  ASSIGNED:      'correspondent.assigned',
  CODE_VALIDATED:'correspondent.code_validated',
  COMPLETED:     'correspondent.completed',
  CANCELLED:     'correspondent.cancelled',
} as const;

export const MESSAGERIE_EVENTS = {
  CONVERSATION_CREATED: 'message.conversation_created',
  MESSAGE_SENT:         'message.sent',
  MESSAGE_READ:         'message.read',
  GROUP_EXPIRED:        'message.group_expired',
  CALL_STARTED:         'message.call_started',
  CALL_ACCEPTED:        'message.call_accepted',
  CALL_REJECTED:        'message.call_rejected',
  CALL_ENDED:           'message.call_ended',
  CALL_MISSED:          'message.call_missed',
} as const;

export const DISPUTE_EVENTS = {
  OPENED:           'dispute.opened',
  ESCALATED:        'dispute.escalated',
  UNDER_REVIEW:     'dispute.under_review',
  EVIDENCE_REQUESTED:'dispute.evidence_requested',
  DECISION_MADE:    'dispute.decision_made',
  RESOLVED:         'dispute.resolved',
  AUTO_CLOSED:      'dispute.auto_closed',
  CLOSED:           'dispute.closed',
  EXPIRED:          'dispute.expired',
} as const;

export const WITHDRAWAL_EVENTS = {
  REQUESTED:  'withdrawal.requested',
  PROCESSING: 'withdrawal.processing',
  COMPLETED:  'withdrawal.completed',
  FAILED:     'withdrawal.failed',
  CANCELLED:  'withdrawal.cancelled',
  STUCK:      'withdrawal.stuck',
} as const;

export const SYSTEM_EVENTS = {
  ALERT:               'system.alert',
  ERROR:               'system.error',
  MAINTENANCE_START:   'system.maintenance_start',
  MAINTENANCE_END:     'system.maintenance_end',
  RATE_LIMIT_EXCEEDED: 'system.rate_limit_exceeded',
  AUDIT_CRITICAL:      'system.audit_critical',
  ESCROW_AUTO_RELEASE: 'system.escrow_auto_release',
  SESSION_CLEANUP:     'system.session_cleanup',
  REPORT_SCHEDULED:    'system.report_scheduled',
} as const;

/** Union de toutes les constantes d'événements */
export const ALL_EVENTS = {
  ...USER_EVENTS,
  ...ORDER_EVENTS,
  ...PAYMENT_EVENTS,
  ...ESCROW_EVENTS,
  ...WALLET_EVENTS,
  ...COMMISSION_EVENTS,
  ...DELIVERY_EVENTS,
  ...CORRESPONDENT_EVENTS,
  ...MESSAGERIE_EVENTS,
  ...DISPUTE_EVENTS,
  ...WITHDRAWAL_EVENTS,
  ...SYSTEM_EVENTS,
} as const;

export type EventName = typeof ALL_EVENTS[keyof typeof ALL_EVENTS];

/* ============================================================
 * PAYLOADS — DONNÉES MÉTIER PAR ÉVÉNEMENT
 * ============================================================ */

/* --- UTILISATEURS ------------------------------------------ */

export interface UserCreatedPayload {
  userId:    string;
  email:     string;
  role:      string;
  createdAt: Date;
}

export interface UserVerifiedPayload {
  userId:     string;
  verifiedBy: string;
  method:     'email' | 'phone' | 'admin';
}

export interface UserBlockedPayload {
  userId:    string;
  blockedBy: string;
  reason:    string;
  until?:    Date;
}

/* --- COMMANDES --------------------------------------------- */

export interface OrderCreatedPayload {
  commandeId:       string;
  commandeRef:      string;
  clientId:         string;
  clientName:       string;
  companyId:        string;
  companyName:      string;
  livreurId?:       string;
  livreurName?:     string;
  correspondantId?: string;
  montantTotal:     number;
  devise:           string;
  items:            Array<{ productId: string; nom: string; quantite: number; prix: number }>;
}

export interface OrderPaidPayload {
  commandeId:  string;
  commandeRef: string;
  sessionId:   string;
  montant:     number;
  devise:      string;
  provider:    string;
  clientId:    string;
  companyId:   string;
}

export interface OrderStatusChangedPayload {
  commandeId:       string;
  commandeRef:      string;
  oldStatus:        string;
  newStatus:        string;
  changedBy:        string;
  changedAt:        Date;
  clientId:         string;
  companyId:        string;
  livreurId?:       string;
  correspondantId?: string;
}

export interface OrderCancelledPayload {
  commandeId:  string;
  commandeRef: string;
  reason:      string;
  cancelledBy: string;
  clientId:    string;
  companyId:   string;
  montant:     number;
}

/* --- PAIEMENTS --------------------------------------------- */

export interface PaymentInitiatedPayload {
  sessionId:   string;
  commandeId:  string;
  clientId:    string;
  montant:     number;
  devise:      string;
  provider:    string;
  methode:     string;
}

export interface PaymentConfirmedPayload {
  sessionId:       string;
  commandeId:      string;
  commandeRef:     string;
  clientId:        string;
  companyId:       string;
  livreurId?:      string;
  montant:         number;
  devise:          string;
  provider:        string;
  providerTxnId?:  string;
  confirmedAt:     Date;
}

export interface PaymentFailedPayload {
  sessionId:   string;
  commandeId:  string;
  commandeRef: string;
  clientId:    string;
  montant:     number;
  devise:      string;
  provider:    string;
  reason:      string;
  attempt:     number;
}

export interface PaymentRefundedPayload {
  sessionId:        string;
  commandeId:       string;
  clientId:         string;
  montantRembourse: number;
  raison:           string;
  refundedAt:       Date;
}

/* --- ESCROW ------------------------------------------------- */

export interface EscrowPayload {
  escrowId:    string;
  commandeId:  string;
  commandeRef: string;
  clientId:    string;
  companyId:   string;
  walletId:    string;
  montant:     number;
  devise:      string;
}

/* --- WALLET ------------------------------------------------- */

export interface WalletCreditedPayload {
  walletId:      string;
  actorId:       string;
  actorType:     string;
  montant:       number;
  devise:        string;
  operationType: string;
  newBalance:    number;
  commandeId?:   string;
  reference?:    string;
}

export interface WalletFrozenPayload {
  walletId:   string;
  actorId:    string;
  actorType:  string;
  reason:     string;
  frozenBy:   string;
  frozenAt:   Date;
}

/* --- COMMISSIONS ------------------------------------------- */

export interface CommissionDistributedPayload {
  commandeId:          string;
  commandeRef:         string;
  devise:              string;
  totalDistribue:      number;
  shopiTotal:          number;
  livreurId?:          string;
  livreurAmount?:      number;
  correspondantId?:    string;
  correspondantAmount?: number;
  detailParActeur:     Array<{
    acteurType: string;
    acteurId:   string;
    montant:    number;
    taux:       number;
  }>;
}

/* --- LIVRAISON --------------------------------------------- */

export interface DeliveryAssignedPayload {
  commandeId:  string;
  commandeRef: string;
  livreurId:   string;
  livreurName: string;
  clientId:    string;
  adresse:     string;
}

export interface DeliveryCompletedPayload {
  commandeId:  string;
  commandeRef: string;
  livreurId:   string;
  completedAt: Date;
  duration?:   number;
}

/* --- MESSAGERIE & APPELS ----------------------------------- */

export interface MessageSentPayload {
  messageId:      string;
  conversationId: string;
  senderId:       string;
  senderType:     string;
  senderName:     string;
  recipientId:    string;
  recipientType:  string;
  preview:        string;
  isCall:         boolean;
}

export interface CallEventPayload {
  callId:         string;
  conversationId: string;
  callerId:       string;
  callerType:     string;
  callerName:     string;
  calleeId:       string;
  calleeType:     string;
  callType:       'audio' | 'video';
  duration?:      number;
  endedAt?:       Date;
}

/* --- LITIGES ----------------------------------------------- */

export interface DisputeOpenedPayload {
  disputeId:       string;
  disputeRef:      string;
  commandeId:      string;
  commandeRef:     string;
  clientId:        string;
  companyId:       string;
  reason:          string;
  montantConteste: number;
  openedAt:        Date;
  deadlineAt:      Date;
  adminId?:        string;
}

export interface DisputeResolvedPayload {
  disputeId:        string;
  disputeRef:       string;
  commandeId:       string;
  commandeRef:      string;
  clientId:         string;
  companyId:        string;
  decision:         string;
  montantRembourse: number;
  resolvedBy:       string;
  resolvedAt:       Date;
  adminNote?:       string;
}

/* --- RETRAITS ---------------------------------------------- */

export interface WithdrawalRequestedPayload {
  retraitId:   string;
  actorId:     string;
  actorType:   string;
  walletId:    string;
  montant:     number;
  devise:      string;
  frais:       number;
  montantNet:  number;
  methode:     string;
  reference:   string;
  requestedAt: Date;
}

export interface WithdrawalCompletedPayload {
  retraitId:      string;
  actorId:        string;
  actorType:      string;
  montant:        number;
  montantNet:     number;
  devise:         string;
  methode:        string;
  momoProvider:   string;
  transactionRef: string;
  completedAt:    Date;
}

export interface WithdrawalFailedPayload {
  retraitId:  string;
  actorId:    string;
  actorType:  string;
  montant:    number;
  devise:     string;
  reason:     string;
  attempt:    number;
}

/* --- SYSTÈME ----------------------------------------------- */

export interface SystemAlertPayload {
  alertType:      string;
  severity:       'CRITICAL' | 'HIGH' | 'NORMAL' | 'INFO';
  message:        string;
  metadata?:      Record<string, unknown>;
  targetAdminId?: string;
}

/* ============================================================
 * RÉSULTAT D'UNE PUBLICATION
 * ============================================================ */

export interface PublishResult {
  eventId:         string;
  eventName:       string;
  publishedAt:     Date;
  isDuplicate:     boolean;
  subscriberCount: number;
}

/* ============================================================
 * ENTRÉE DLQ (Dead Letter Queue)
 * ============================================================ */

export interface DlqEntry {
  id:           string;
  event:        ShopiEvent;
  subscriber:   string;
  error:        string;
  attempts:     number;
  firstFailAt:  Date;
  lastFailAt:   Date;
  nextRetryAt?: Date;
}

/* ============================================================
 * MÉTRIQUES D'OBSERVABILITÉ
 * ============================================================ */

export interface EventMetrics {
  totalPublished:    number;
  totalConsumed:     number;
  totalFailed:       number;
  totalRetried:      number;
  totalDlq:          number;
  duplicatesBlocked: number;
  byEventName:       Record<string, { published: number; consumed: number; failed: number }>;
  avgProcessingMs:   number;
  uptimeMs:          number;
}

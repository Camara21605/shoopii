/* =========================================================
 * FICHIER : src/shared/services/walletApi.ts
 *
 * RÔLE : Appels API du Portefeuille (Wallet) — communs à
 *        tous les dashboards (chaque utilisateur possède
 *        un wallet unique).
 * ========================================================= */

import { apiFetch } from './apiFetch';

/* ── Types ── */

export type WalletPaymentMethodType = 'orange_money' | 'mtn_money' | 'card' | 'bank' | 'cash';

export interface WalletPaymentMethod {
  id: string;
  type: WalletPaymentMethodType;
  label: string;
  number: string;
  isDefault: boolean;
}

export interface WalletSummary {
  balance: number;
  pendingBalance: number;
  currency: string;
  status: string;
  totalCredited: number;
  totalDebited: number;
  thisMonthIn: number;
  thisMonthOut: number;
  totalCommission: number;
  dailyWithdrawLimit: number;
  todayWithdrawAmount: number;
  paymentMethods: WalletPaymentMethod[];
  autoTransferEnabled: boolean;
  autoTransferMethodId: string | null;
}

export type WalletTxType = 'credit' | 'debit' | 'refund' | 'transfer';
export type WalletTxStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface WalletTransaction {
  id: string;
  type: WalletTxType;
  status: WalletTxStatus;
  amount: number;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface WalletTransactionsResponse {
  data: WalletTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface WalletChartPoint {
  label: string;
  value: number;
}

export type WalletChartPeriod = 'semaine' | 'mois' | 'annee';
export type WalletTxFilter = 'all' | 'in' | 'out';

export interface WalletOperationInput {
  amount: number;
  methodId?: string;
  note?: string;
}

export interface WalletOperationResult {
  balance: number;
  transaction: {
    id: string;
    type: WalletTxType;
    status: WalletTxStatus;
    amount: number;
    description: string | null;
    createdAt: string;
  };
}

/* ── Endpoints ── */

export const fetchWalletSummary = () =>
  apiFetch<WalletSummary>('/wallet');

export const fetchWalletTransactions = (filter: WalletTxFilter = 'all', page = 1, limit = 10) =>
  apiFetch<WalletTransactionsResponse>('/wallet/transactions', { params: { type: filter, page, limit } });

export const fetchWalletChart = (period: WalletChartPeriod = 'mois') =>
  apiFetch<WalletChartPoint[]>('/wallet/chart', { params: { period } });

export const depositWallet = (dto: WalletOperationInput) =>
  apiFetch<WalletOperationResult>('/wallet/deposit', { method: 'POST', body: dto });

export const withdrawWallet = (dto: WalletOperationInput) =>
  apiFetch<WalletOperationResult>('/wallet/withdraw', { method: 'POST', body: dto });

export const transferWallet = (dto: WalletOperationInput) =>
  apiFetch<WalletOperationResult>('/wallet/transfer', { method: 'POST', body: dto });

export const addWalletPaymentMethod = (dto: { type: WalletPaymentMethodType; label: string; number: string }) =>
  apiFetch<WalletPaymentMethod[]>('/wallet/payment-methods', { method: 'POST', body: dto });

export const setDefaultWalletPaymentMethod = (id: string) =>
  apiFetch<WalletPaymentMethod[]>(`/wallet/payment-methods/${id}/default`, { method: 'PATCH' });

export const removeWalletPaymentMethod = (id: string) =>
  apiFetch<WalletPaymentMethod[]>(`/wallet/payment-methods/${id}`, { method: 'DELETE' });

export const setWalletAutoTransfer = (dto: { enabled: boolean; methodId?: string }) =>
  apiFetch<{ autoTransferEnabled: boolean; autoTransferMethodId: string | null }>('/wallet/auto-transfer', { method: 'PATCH', body: dto });

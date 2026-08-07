/* =========================================================
 * FICHIER : src/shared/services/walletApi.ts
 *
 * RÔLE : Appels API du Portefeuille (Wallet) — communs à
 *        tous les dashboards (chaque utilisateur possède
 *        un wallet unique).
 * ========================================================= */

import type { TFunction } from 'i18next';
import { apiFetch } from './apiFetch';

/* ── Types ── */

export type WalletPaymentMethodType = 'orange_money' | 'mtn_money' | 'kulu' | 'paycard' | 'card' | 'bank' | 'cash';

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

/* ── Métadonnées d'affichage des moyens de paiement (partagées entre
   le widget compact et la page portefeuille complète, pour que l'étape
   "choisir un moyen de paiement" du dépôt/retrait reste cohérente) ── */
export function getWalletMethodMeta(t: TFunction): Record<WalletPaymentMethodType, { label: string; badge: string | null; icon: string | null; color: string }> {
  return {
    orange_money: { label: t('wallet.methodMeta.orangeMoney'), badge: 'OM', icon: null,                    color: '#FF7900' },
    mtn_money:    { label: t('wallet.methodMeta.mtnMoney'),    badge: 'MM', icon: null,                    color: '#FFCC08' },
    kulu:         { label: t('wallet.methodMeta.kulu'),        badge: 'KU', icon: null,                    color: '#7C3AED' },
    paycard:      { label: t('wallet.methodMeta.paycard'),     badge: null, icon: 'fa-money-check-dollar', color: '#0EA5E9' },
    card:         { label: t('wallet.methodMeta.card'),        badge: null, icon: 'fa-credit-card',        color: '#1A4FC4' },
    bank:         { label: t('wallet.methodMeta.bank'),        badge: null, icon: 'fa-building-columns',   color: '#0B1F3A' },
    cash:         { label: t('wallet.methodMeta.cash'),        badge: null, icon: 'fa-money-bill-wave',    color: '#16A34A' },
  };
}

/** Moyens de paiement électroniques éligibles au dépôt/retrait à distance
 *  (le cash est exclu : il ne peut pas servir à un transfert électronique). */
export const WALLET_ELECTRONIC_METHOD_TYPES: WalletPaymentMethodType[] = ['orange_money', 'mtn_money', 'kulu', 'paycard', 'card', 'bank'];

/* ── Formulaires d'ajout — chaque système de paiement a sa propre façon de
   « lier un compte » (un numéro de téléphone pour le mobile money, un
   numéro de carte + titulaire + expiration pour une carte, un RIB/IBAN +
   titulaire pour un virement…) : pas un simple couple libellé/numéro
   générique pour tous. Partagé entre le widget compact et la page
   portefeuille complète pour que les deux formulaires restent identiques. ── */
export interface WalletMethodFormField {
  key: string;
  label: string;
  placeholder: string;
  /** Préfixe fixe affiché devant le champ (ex : indicatif téléphonique). */
  prefix?: string;
  inputMode?: 'numeric' | 'text';
  maxLength?: number;
}

/** Clés de champs par type — indépendantes de la langue, utilisées pour la validation. */
const WALLET_METHOD_FIELD_KEYS: Record<WalletPaymentMethodType, string[]> = {
  orange_money: ['phone'],
  mtn_money:    ['phone'],
  kulu:         ['phone'],
  paycard:      ['cardNumber', 'holder'],
  card:         ['cardNumber', 'holder', 'expiry'],
  bank:         ['bankName', 'holder', 'iban'],
  cash:         [],
};

export function getWalletMethodFormFields(t: TFunction): Record<WalletPaymentMethodType, WalletMethodFormField[]> {
  const ex = t('wallet.formFields.exPrefix');
  const nomComplet = t('wallet.formFields.nomCompletPlaceholder');
  return {
    orange_money: [
      { key: 'phone', label: t('wallet.formFields.orangeMoneyLabel'), placeholder: '622 00 00 00', prefix: '+224', inputMode: 'numeric' },
    ],
    mtn_money: [
      { key: 'phone', label: t('wallet.formFields.mtnMoneyLabel'), placeholder: '660 00 00 00', prefix: '+224', inputMode: 'numeric' },
    ],
    kulu: [
      { key: 'phone', label: t('wallet.formFields.kuluLabel'), placeholder: '622 00 00 00', prefix: '+224', inputMode: 'numeric' },
    ],
    paycard: [
      { key: 'cardNumber', label: t('wallet.formFields.paycardNumberLabel'), placeholder: '0000 0000 0000', inputMode: 'numeric', maxLength: 19 },
      { key: 'holder',     label: t('wallet.formFields.titulaireLabel'),     placeholder: nomComplet },
    ],
    card: [
      { key: 'cardNumber', label: t('wallet.formFields.cardNumberLabel'),    placeholder: '0000 0000 0000 0000', inputMode: 'numeric', maxLength: 19 },
      { key: 'holder',     label: t('wallet.formFields.nomSurCarteLabel'),   placeholder: `${ex} Mamadou Diallo` },
      { key: 'expiry',     label: t('wallet.formFields.dateExpirationLabel'), placeholder: 'MM/AA', maxLength: 5 },
    ],
    bank: [
      { key: 'bankName', label: t('wallet.formFields.nomBanqueLabel'),        placeholder: `${ex} Ecobank Guinée` },
      { key: 'holder',   label: t('wallet.formFields.titulaireCompteLabel'),  placeholder: nomComplet },
      { key: 'iban',     label: t('wallet.formFields.numeroCompteIbanLabel'), placeholder: 'GN00 0000 0000 0000 0000' },
    ],
    cash: [],
  };
}

/** true si tous les champs requis pour ce type sont remplis. */
export function isWalletMethodFormValid(type: WalletPaymentMethodType, values: Record<string, string>): boolean {
  return WALLET_METHOD_FIELD_KEYS[type].every(key => (values[key] ?? '').trim().length > 0);
}

/** Traduit les champs du formulaire spécifique au type en le couple
 *  {label, number} attendu par l'API — jamais le CVV : on ne stocke que
 *  ce qui sert à identifier/afficher le moyen de paiement, jamais un
 *  secret de paiement. */
export function composeWalletMethodPayload(type: WalletPaymentMethodType, values: Record<string, string>, t: TFunction): { label: string; number: string } {
  const meta = getWalletMethodMeta(t)[type];
  switch (type) {
    case 'orange_money':
    case 'mtn_money':
    case 'kulu': {
      const phone = (values.phone ?? '').trim();
      return { label: meta.label, number: phone ? `+224 ${phone}` : '' };
    }
    case 'paycard': {
      const digits = (values.cardNumber ?? '').replace(/\D/g, '');
      const holder = (values.holder ?? '').trim();
      const last4 = digits.slice(-4);
      return { label: holder || meta.label, number: last4 ? `•••• ${last4}` : (values.cardNumber ?? '').trim() };
    }
    case 'card': {
      const digits = (values.cardNumber ?? '').replace(/\D/g, '');
      const holder = (values.holder ?? '').trim();
      const expiry = (values.expiry ?? '').trim();
      const last4 = digits.slice(-4);
      const masked = last4 ? `•••• •••• •••• ${last4}` : '';
      return { label: holder || meta.label, number: [masked, expiry && `Exp ${expiry}`].filter(Boolean).join(' · ') };
    }
    case 'bank': {
      const bankName = (values.bankName ?? '').trim();
      const holder = (values.holder ?? '').trim();
      const iban = (values.iban ?? '').trim();
      return { label: bankName || meta.label, number: [iban, holder].filter(Boolean).join(' · ') };
    }
    default:
      return { label: meta.label, number: '' };
  }
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

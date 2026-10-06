/**
 * Portefeuille Shoneya — commun à tous les espaces (chaque compte a son propre
 * portefeuille). Mêmes routes que le site (shared/services/walletApi.ts) :
 *   GET    /wallet                               résumé (solde, retirable, KPI, méthodes, virement auto)
 *   GET    /wallet/transactions?type&page&limit  type = all | in | out
 *   GET    /wallet/chart?period                  semaine | mois | annee
 *   POST   /wallet/deposit                       indisponible (aucun moyen de paiement réel branché)
 *   POST   /wallet/withdraw  { amount, methodId }
 *   POST   /wallet/transfer  { amount, methodId }
 *   POST   /wallet/payment-methods  { type, label, number }   → liste à jour
 *   PATCH  /wallet/payment-methods/:id/default                 → liste à jour
 *   DELETE /wallet/payment-methods/:id                         → liste à jour
 *   PATCH  /wallet/auto-transfer  { enabled, methodId? }
 * Le serveur applique les plafonds (minimum de retrait, plafond par opération,
 * limite journalière, délai de règlement) et renvoie des messages en français.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);

export type MethodType = 'orange_money' | 'mtn_money' | 'kulu' | 'paycard' | 'card' | 'bank' | 'cash';

const methodSchema = z.object({
  id: z.string(),
  type: z.enum(['orange_money', 'mtn_money', 'kulu', 'paycard', 'card', 'bank', 'cash']).catch('cash'),
  label: z.string().catch(''),
  number: z.string().catch(''),
  isDefault: z.boolean().catch(false),
});
export type PaymentMethod = z.infer<typeof methodSchema>;
const methodsSchema = z.array(methodSchema).catch([]);

const summarySchema = z
  .object({
    balance: num,
    pendingBalance: num,
    currency: z.string().catch('GNF'),
    totalCredited: num,
    totalDebited: num,
    thisMonthIn: num,
    thisMonthOut: num,
    totalCommission: num,
    dailyWithdrawLimit: num,
    todayWithdrawAmount: num,
    withdrawableBalance: z.coerce.number().optional().catch(undefined),
    settlementLocked: num,
    paymentMethods: methodsSchema,
    autoTransferEnabled: z.boolean().catch(false),
    autoTransferMethodId: z.string().nullable().optional().catch(null),
  })
  .passthrough();
export type WalletSummary = z.infer<typeof summarySchema>;
export const fetchWallet = () => apiFetch('/wallet', { schema: summarySchema });

export type TxFilter = 'all' | 'in' | 'out';
const txSchema = z
  .object({
    id: z.string(),
    type: z.string().catch('credit'),
    status: z.string().catch('completed'),
    amount: num,
    description: z.string().nullable().optional().catch(null),
    referenceType: z.string().nullable().optional().catch(null),
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type WalletTx = z.infer<typeof txSchema>;
export const TX_PAGE = 15;
export const fetchTransactions = (type: TxFilter, page: number, limit = TX_PAGE) =>
  apiFetch('/wallet/transactions', { query: { type, page, limit }, schema: z.object({ data: z.array(txSchema).catch([]), total: num, page: num, limit: num }) });

export type ChartPeriod = 'semaine' | 'mois' | 'annee';
export const fetchChart = (period: ChartPeriod) => apiFetch('/wallet/chart', { query: { period }, schema: z.array(z.object({ label: z.string().catch(''), value: num })).catch([]) });

export const withdraw = (amount: number, methodId: string) => apiFetch('/wallet/withdraw', { method: 'POST', body: { amount, methodId } });
export const transfer = (amount: number, methodId: string) => apiFetch('/wallet/transfer', { method: 'POST', body: { amount, methodId } });
export const addMethod = (body: { type: MethodType; label: string; number: string }) => apiFetch('/wallet/payment-methods', { method: 'POST', body, schema: methodsSchema });
export const setDefaultMethod = (id: string) => apiFetch(`/wallet/payment-methods/${id}/default`, { method: 'PATCH', schema: methodsSchema });
export const removeMethod = (id: string) => apiFetch(`/wallet/payment-methods/${id}`, { method: 'DELETE', schema: methodsSchema });
export const setAutoTransfer = (enabled: boolean, methodId?: string) => apiFetch('/wallet/auto-transfer', { method: 'PATCH', body: { enabled, ...(methodId ? { methodId } : {}) } });

/* ── Moyens de paiement : apparence et formulaire propre à chacun (comme le site) ── */

export const METHODS: Record<MethodType, { label: string; badge?: string; icon?: 'card-outline' | 'business-outline' | 'cash-outline' | 'wallet-outline'; color: string }> = {
  orange_money: { label: 'Orange Money', badge: 'OM', color: '#FF7900' },
  mtn_money: { label: 'MTN Money', badge: 'MM', color: '#FFCC08' },
  kulu: { label: 'Kulu', badge: 'KU', color: '#7C3AED' },
  paycard: { label: 'PayCard', icon: 'wallet-outline', color: '#0EA5E9' },
  card: { label: 'Carte bancaire', icon: 'card-outline', color: '#334155' },
  bank: { label: 'Virement bancaire', icon: 'business-outline', color: '#1F1F1F' },
  cash: { label: 'Espèces (Cash)', icon: 'cash-outline', color: '#16A34A' },
};
/** Retrait / transfert : seulement les moyens électroniques (pas le cash). */
export const ELECTRONIC: MethodType[] = ['orange_money', 'mtn_money', 'kulu', 'paycard', 'card', 'bank'];

export type Field = { key: string; label: string; placeholder: string; prefix?: string; numeric?: boolean; maxLength?: number };
export const FIELDS: Record<MethodType, Field[]> = {
  orange_money: [{ key: 'phone', label: 'Numéro Orange Money', placeholder: '622 00 00 00', prefix: '+224', numeric: true, maxLength: 12 }],
  mtn_money: [{ key: 'phone', label: 'Numéro MTN Money', placeholder: '660 00 00 00', prefix: '+224', numeric: true, maxLength: 12 }],
  kulu: [{ key: 'phone', label: 'Numéro Kulu', placeholder: '622 00 00 00', prefix: '+224', numeric: true, maxLength: 12 }],
  paycard: [
    { key: 'cardNumber', label: 'Numéro PayCard', placeholder: '0000 0000 0000', numeric: true, maxLength: 19 },
    { key: 'holder', label: 'Titulaire', placeholder: 'Nom complet' },
  ],
  card: [
    { key: 'cardNumber', label: 'Numéro de carte', placeholder: '0000 0000 0000 0000', numeric: true, maxLength: 19 },
    { key: 'holder', label: 'Nom sur la carte', placeholder: 'Ex : Mamadou Diallo' },
    { key: 'expiry', label: 'Date d’expiration', placeholder: 'MM/AA', maxLength: 5 },
  ],
  bank: [
    { key: 'bankName', label: 'Nom de la banque', placeholder: 'Ex : Ecobank Guinée' },
    { key: 'holder', label: 'Titulaire du compte', placeholder: 'Nom complet' },
    { key: 'iban', label: 'Numéro de compte / IBAN', placeholder: 'GN00 0000 0000 0000 0000' },
  ],
  cash: [],
};

export const isFormValid = (type: MethodType, v: Record<string, string>) => FIELDS[type].every((f) => (v[f.key] ?? '').trim().length > 0);

/** Couple { label, number } envoyé au serveur — jamais de secret (pas de CVV), carte masquée. */
export function composeMethod(type: MethodType, v: Record<string, string>): { label: string; number: string } {
  const meta = METHODS[type];
  const t = (k: string) => (v[k] ?? '').trim();
  switch (type) {
    case 'orange_money':
    case 'mtn_money':
    case 'kulu':
      return { label: meta.label, number: t('phone') ? `+224 ${t('phone')}` : '' };
    case 'paycard': {
      const last4 = t('cardNumber').replace(/\D/g, '').slice(-4);
      return { label: t('holder') || meta.label, number: last4 ? `•••• ${last4}` : t('cardNumber') };
    }
    case 'card': {
      const last4 = t('cardNumber').replace(/\D/g, '').slice(-4);
      return { label: t('holder') || meta.label, number: [last4 ? `•••• •••• •••• ${last4}` : '', t('expiry') && `Exp ${t('expiry')}`].filter(Boolean).join(' · ') };
    }
    case 'bank':
      return { label: t('bankName') || meta.label, number: [t('iban'), t('holder')].filter(Boolean).join(' · ') };
    default:
      return { label: meta.label, number: '' };
  }
}

export const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
export const AMOUNT_CHIPS = [50_000, 100_000, 500_000, 1_000_000];

export const TX_STATUS: Record<string, string> = { completed: 'Validé', pending: 'En attente', failed: 'Échoué', cancelled: 'Annulé' };
export const isCredit = (tx: WalletTx) => tx.type === 'credit' || tx.type === 'refund';
export function txIcon(tx: WalletTx): 'arrow-down' | 'arrow-up' | 'paper-plane-outline' | 'pricetag-outline' | 'bag-handle-outline' {
  if (tx.referenceType === 'commission') return 'pricetag-outline';
  if (tx.referenceType === 'withdraw') return 'arrow-up';
  if (tx.referenceType === 'transfer') return 'paper-plane-outline';
  if (tx.referenceType === 'deposit') return 'arrow-down';
  return isCredit(tx) ? 'bag-handle-outline' : 'arrow-up';
}

/**
 * Suivi d'une commande par le CLIENT — mêmes adresses que la page
 * /commande/:id/suivi du site (CommandePage.tsx) :
 *   GET  /commandes/:uuid           détail + chaîne de validation (le serveur
 *                                   ne renvoie MON code qu'une fois débloqué)
 *   POST /commandes/:uuid/valider   { role: 'client', code } — je confirme la réception
 *   POST /commandes/:uuid/litige    { type, description } — signaler un problème
 */
import { apiFetch } from '@/lib/api/client';

export { fetchOrder, ISSUE_TYPES, reportIssue, gnf, type IssueType, type OrderDetail } from '@/features/company-orders/api';

/** Je confirme avoir reçu le colis (dernière étape de la chaîne). */
export const confirmReception = (uuid: string, code: string) =>
  apiFetch(`/commandes/${uuid}/valider`, { method: 'POST', body: { role: 'client', code: code.trim().toUpperCase() } });

export type StepState = 'done' | 'now' | 'next';

/** État de chaque étape : validée, en cours (celle d'après la dernière validée), à venir. */
export const stepState = (index: number, currentStep: number): StepState =>
  index < currentStep ? 'done' : index === currentStep ? 'now' : 'next';

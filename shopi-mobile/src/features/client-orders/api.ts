/**
 * Suivi d'une commande par le CLIENT — mêmes adresses que la page
 * /commande/:id/suivi du site (CommandePage.tsx) :
 *   GET   /commandes/:uuid                détail + chaîne de validation (le serveur
 *                                         ne renvoie MON code qu'une fois débloqué)
 *   POST  /commandes/:uuid/valider        { role: 'client', code } — je confirme la réception
 *   POST  /commandes/:uuid/litige         { type, description } — signaler un problème
 *   POST  /commandes/:uuid/notes          { notes: [{ role, note 1-5, commentaire }] } — noter
 *                                         les acteurs (commande livrée, une note par acteur)
 *   PATCH /client/commandes/:uuid/livreur { livreurId } — autre livreur après un refus
 *   POST  /client/returns                 { commandeId, productId, quantity, reason, description }
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

/* ── Notation ───────────────────────────────────────────────────────── */

export type RatedRole = 'entreprise' | 'livreur' | 'correspondant';
export type Rating = { role: RatedRole; note: number; commentaire?: string };

export const sendRatings = (uuid: string, notes: Rating[]) =>
  apiFetch(`/commandes/${uuid}/notes`, {
    method: 'POST',
    body: { notes: notes.map((n) => ({ role: n.role, note: n.note, ...(n.commentaire?.trim() ? { commentaire: n.commentaire.trim().slice(0, 500) } : {}) })) },
  });

export const RATE_LABELS = ['', 'Très insatisfait', 'Insatisfait', 'Correct', 'Satisfait', 'Excellent !'];

/* ── Autre livreur (après un refus) ─────────────────────────────────── */

export const chooseDriver = (uuid: string, livreurId: string) =>
  apiFetch(`/client/commandes/${uuid}/livreur`, { method: 'PATCH', body: { livreurId } });

/* ── Demande de retour ──────────────────────────────────────────────── */

export type ReturnReason = 'defective' | 'not_matching' | 'change_of_mind' | 'wrong_item' | 'damaged' | 'expired' | 'other';

export const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'damaged', label: 'Arrivé endommagé' },
  { value: 'defective', label: 'Défectueux' },
  { value: 'wrong_item', label: 'Mauvais article' },
  { value: 'not_matching', label: 'Ne correspond pas' },
  { value: 'expired', label: 'Périmé' },
  { value: 'change_of_mind', label: 'Changement d’avis' },
  { value: 'other', label: 'Autre' },
];

export const createReturn = (p: { commandeId: string; productId: string; quantity: number; reason: ReturnReason; description: string }) =>
  apiFetch('/client/returns', { method: 'POST', body: p });

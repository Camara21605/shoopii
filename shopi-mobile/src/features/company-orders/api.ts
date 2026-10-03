/**
 * Commandes de la boutique (espace entreprise) — mêmes routes que le site :
 *   GET   /entreprise/commandes                liste (orders.view)
 *   GET   /commandes/:uuid                     détail + chaîne de validation
 *   POST  /commandes/:uuid/valider             valider SON étape avec SON code
 *                                              { role: 'entreprise', code } — réservé
 *                                              au titulaire du code (le propriétaire)
 *   PATCH /entreprise/commandes/:uuid/livreur  assigner / changer le livreur
 *                                              { livreurId } (deliveries.assign)
 *   GET   /livreurs?limit=50                   livreurs de l'entreprise (choix)
 *   POST  /commandes/:uuid/litige              signaler un problème { type, description }
 *
 * Confirmer la commande (étape « entreprise ») la fait passer « En préparation »
 * et prévient le client ; le code du client ne se débloque qu'après les étapes
 * entreprise, livreur et point relais (règle du serveur).
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);
const str = z.string().nullable().optional().catch(null);

export type OrderStatus = 'new' | 'prep' | 'ship' | 'del' | 'can';
export type AssignmentStatus = 'pending' | 'accepted' | 'refused' | null;

const assignment = z.enum(['pending', 'accepted', 'refused']).nullable().optional().catch(null);

export const orderSchema = z
  .object({
    id: z.string().catch(''),
    uuid: z.string(),
    imageUrl: str,
    nm: z.string().catch('—'),
    vt: z.string().nullable().optional().catch(''),
    items: z.array(z.object({ nm: z.string().catch(''), imageUrl: str, vt: str, qty: num })).catch([]),
    client: z.string().catch('—'),
    price: num,
    status: z.enum(['new', 'prep', 'ship', 'del', 'can']).catch('new'),
    date: z.string().catch(''),
    livreur: z.string().catch('—'),
    zone: z.string().catch('—'),
    livreurId: str,
    livreurAssignmentStatus: assignment,
    livreurRefusalReason: str,
  })
  .passthrough();
export type Order = z.infer<typeof orderSchema>;

export const fetchOrders = () => apiFetch('/entreprise/commandes', { schema: z.array(orderSchema).catch([]) });

/* ── Détail ─────────────────────────────────────────────────────────── */

export type ActorRole = 'entreprise' | 'livreur' | 'correspondant' | 'client';

export const orderDetailSchema = z
  .object({
    id: z.string().catch(''),
    datePaiement: z.string().catch(''),
    destination: z.string().catch(''),
    acteurs: z
      .array(
        z.object({
          role: z.enum(['entreprise', 'livreur', 'correspondant', 'client']).catch('client'),
          nom: z.string().catch(''),
          sousTitre: z.string().catch(''),
          action: z.string().catch(''),
          valideA: str,
        }),
      )
      .catch([]),
    articles: z
      .array(z.object({ productId: str, imageUrl: str, nom: z.string().catch(''), qty: num, prix: num }))
      .catch([]),
    montant: z.object({ sousTotal: num, livraison: num, fraisCorrespondant: num, total: num }).catch({ sousTotal: 0, livraison: 0, fraisCorrespondant: 0, total: 0 }),
    commissions: z.array(z.object({ role: z.string().catch(''), nom: z.string().catch(''), libelle: z.string().catch(''), montant: num })).catch([]),
    codes: z.record(z.string(), z.string()).catch({}),
    currentStep: num,
    times: z.array(z.string().nullable().optional()).catch([]),
    livreurAssignmentStatus: assignment,
    livreurRefusalReason: str,
  })
  .passthrough();
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const fetchOrder = (uuid: string) => apiFetch(`/commandes/${uuid}`, { schema: orderDetailSchema });

/** Valide l'étape « entreprise » (le code s'écrit en majuscules côté serveur). */
export const confirmOrder = (uuid: string, code: string) =>
  apiFetch(`/commandes/${uuid}/valider`, { method: 'POST', body: { role: 'entreprise', code: code.trim().toUpperCase() } });

/* ── Livreur ────────────────────────────────────────────────────────── */

export const driverSchema = z
  .object({ id: z.string(), fullName: z.string().catch(''), zone: str, avatarEmoji: str, averageRating: num, availability: str })
  .passthrough();
export type Driver = z.infer<typeof driverSchema>;

export const fetchAssignableDrivers = () =>
  apiFetch('/livreurs', { query: { limit: 50 }, schema: z.object({ data: z.array(driverSchema).catch([]) }).passthrough() }).then((r) => r.data);

export const assignDriver = (uuid: string, livreurId: string) =>
  apiFetch(`/entreprise/commandes/${uuid}/livreur`, { method: 'PATCH', body: { livreurId } });

/* ── Problème ───────────────────────────────────────────────────────── */

export type IssueType = 'endommage' | 'manquant' | 'errone' | 'retard' | 'autre';
export const ISSUE_TYPES: { value: IssueType; label: string }[] = [
  { value: 'endommage', label: 'Article endommagé' },
  { value: 'manquant', label: 'Article manquant' },
  { value: 'errone', label: 'Mauvais article' },
  { value: 'retard', label: 'Retard de livraison' },
  { value: 'autre', label: 'Autre problème' },
];
export const reportIssue = (uuid: string, type: IssueType, description: string) =>
  apiFetch(`/commandes/${uuid}/litige`, { method: 'POST', body: { type, description } });

/* ── Présentation partagée ──────────────────────────────────────────── */

export const STATUS: Record<OrderStatus, { label: string; short: string; color: string; bg: string; icon: string }> = {
  new: { label: 'Nouvelle — à confirmer', short: 'Nouvelle', color: '#1F1F1F', bg: 'rgba(0,0,0,0.05)', icon: 'ellipse' },
  prep: { label: 'En préparation', short: 'En préparation', color: '#B45309', bg: '#FFF7E6', icon: 'construct' },
  ship: { label: 'En livraison', short: 'En livraison', color: '#7C3AED', bg: '#F5F0FF', icon: 'bicycle' },
  del: { label: 'Livrée', short: 'Livrée', color: '#047857', bg: '#ECFDF5', icon: 'checkmark-circle' },
  can: { label: 'Annulée', short: 'Annulée', color: '#B91C1C', bg: '#FEF2F2', icon: 'close-circle' },
};

export const FILTERS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'new', label: 'À confirmer' },
  { key: 'prep', label: 'En préparation' },
  { key: 'ship', label: 'En livraison' },
  { key: 'del', label: 'Livrées' },
  { key: 'can', label: 'Annulées' },
];

export const gnf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;

/** Recherche sans accents ni casse (numéro, client, produit). */
export const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

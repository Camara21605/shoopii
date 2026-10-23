/**
 * Profil du client connecté — mêmes adresses que la page /mon-profil du site
 * (shopi-frontend/src/shared/profils/profil-client) :
 *   GET /client/profil              identité, points, compteurs
 *   GET /client/commandes           mes commandes (liste déjà mise en forme)
 *   GET /suivis/mes-abonnements     boutiques / livreurs / points relais suivis
 *   GET /client/favoris  ·  GET /client/wishlist
 *   GET /client/returns             mes demandes de retour
 *   GET /wallet                     solde RÉEL du portefeuille
 *   GET /location/addresses         ville de l'adresse par défaut
 * (Le serveur renvoie encore walletSolde = 0 et une localisation fixe dans
 * /client/profil : on prend donc le vrai solde et la vraie ville ailleurs.)
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);

export const clientProfileSchema = z
  .object({
    id: z.string(),
    initiales: z.string().catch(''),
    nomComplet: z.string().catch('Client'),
    email: z.string().catch(''),
    emailVerifie: z.boolean().catch(false),
    telephone: z.string().nullable().optional(),
    membreDepuis: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    twoFaEnabled: z.boolean().catch(false),
    profilePicture: z.string().nullable().optional(),
    totalOrders: num,
    totalSpent: num,
    totalFavorites: num,
    shopiPoints: num,
  })
  .passthrough();
export type ClientProfile = z.infer<typeof clientProfileSchema>;

export const fetchClientProfile = () => apiFetch('/client/profil', { schema: clientProfileSchema });

export const orderSchema = z
  .object({
    id: z.string(), // numéro affiché (CMD-2026-00010)
    uuid: z.string(),
    imageUrl: z.string().nullable().optional(),
    nm: z.string().catch('—'),
    items: z.array(z.object({ nm: z.string().catch(''), qty: num }).passthrough()).catch([]),
    client: z.string().catch('—'), // nom de la boutique
    price: num,
    status: z.string().catch('new'),
    date: z.string().catch(''),
  })
  .passthrough();
export type ClientOrder = z.infer<typeof orderSchema>;

export async function fetchClientOrders() {
  const raw = await apiFetch('/client/commandes', { schema: z.unknown() });
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { data?: unknown[] })?.data) ? (raw as { data: unknown[] }).data : [];
  return z.array(orderSchema).parse(list);
}

const followSchema = z
  .object({ id: z.string(), nom: z.string().catch(''), categorie: z.string().catch(''), emoji: z.string().catch('⭐'), photo: z.string().nullable().optional().catch(null), abonnes: num, hidden: z.boolean().catch(false) })
  .passthrough();
export type FollowItem = z.infer<typeof followSchema>;

export const fetchMyFollows = () =>
  apiFetch('/suivis/mes-abonnements', {
    schema: z.object({
      boutiques: z.array(followSchema).catch([]),
      livreurs: z.array(followSchema).catch([]),
      correspondants: z.array(followSchema).catch([]),
    }),
  });

const savedProductSchema = z
  .object({
    id: z.string(),
    productId: z.string(),
    nom: z.string().catch(''),
    prix: num,
    prixAncien: z.coerce.number().nullable().optional(),
    emoji: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
  })
  .passthrough();
export type SavedProduct = z.infer<typeof savedProductSchema>;

export const fetchFavorites = () => apiFetch('/client/favoris', { schema: z.array(savedProductSchema) });
export const fetchWishlist = () => apiFetch('/client/wishlist', { schema: z.array(savedProductSchema) });

const returnSchema = z
  .object({
    id: z.string(),
    reference: z.string().catch(''),
    productName: z.string().catch(''),
    productImage: z.string().nullable().optional(),
    status: z.string().catch('pending'),
    montantDemande: num,
    createdAt: z.string(),
  })
  .passthrough();
export type ClientReturn = z.infer<typeof returnSchema>;

export async function fetchReturns() {
  const res = await apiFetch('/client/returns', { query: { limit: 50 }, schema: z.object({ data: z.array(returnSchema) }).passthrough() });
  return res.data;
}

export async function fetchWalletBalance() {
  const res = await apiFetch('/wallet', { schema: z.object({ balance: num }).passthrough() });
  return res.balance;
}

/** Ville (et quartier) de l'adresse par défaut, sinon de la première adresse. */
export async function fetchHomeCity(): Promise<string | null> {
  const list = await apiFetch('/location/addresses', {
    schema: z.array(z.object({ ville: z.string().nullable().optional(), quartier: z.string().nullable().optional(), estDefaut: z.boolean().optional() }).passthrough()),
  });
  const a = list.find((x) => x.estDefaut) ?? list[0];
  return a ? [a.quartier, a.ville].filter(Boolean).join(', ') || null : null;
}

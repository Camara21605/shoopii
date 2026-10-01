/**
 * Panier du client — même panier que sur le site (un article ajouté sur l'un
 * apparaît sur l'autre). Réservé au rôle client. Adresses (panier.controller) :
 *   GET    /client/panier           liste
 *   POST   /client/panier           ajouter { produitId, qty, variante }
 *   PATCH  /client/panier/:itemId   quantité { qty } (le serveur plafonne à 10 et au stock)
 *   DELETE /client/panier/:itemId   retirer un article
 *   DELETE /client/panier           vider
 * Chaque écriture renvoie le panier complet à jour : on le pose directement
 * dans le cache (pas de second aller-retour).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { z } from 'zod';

import { useSession } from '@/features/auth/session-store';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/errors';

/** Plafond serveur (panier.service : Math.min(qty, 10, stock)). */
export const MAX_QTY = 10;

export const cartItemSchema = z
  .object({
    id: z.string(),
    produitId: z.string(),
    nom: z.string(),
    prix: z.coerce.number(),
    prixAncien: z.coerce.number().nullable().optional(),
    qty: z.coerce.number(),
    variante: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    emoji: z.string().nullable().optional(),
    shopNom: z.string().optional(),
    shopId: z.string().optional(),
    stock: z.coerce.number().optional(),
  })
  .passthrough();
export type CartItem = z.infer<typeof cartItemSchema>;

const cartSchema = z.array(cartItemSchema);

export function fetchCart() {
  return apiFetch('/client/panier', { schema: cartSchema });
}

/** Panier du client connecté (désactivé pour les autres rôles). */
export function useCart() {
  const role = useSession((s) => s.user?.role);
  return useQuery({ queryKey: ['cart'], queryFn: fetchCart, enabled: role === 'client', staleTime: 30_000 });
}

export const cartCount = (items: CartItem[] | undefined) => (items ?? []).reduce((n, i) => n + i.qty, 0);

const setQty = (itemId: string, qty: number) => apiFetch(`/client/panier/${itemId}`, { method: 'PATCH', body: { qty }, schema: cartSchema });
const removeItem = (itemId: string) => apiFetch(`/client/panier/${itemId}`, { method: 'DELETE', schema: cartSchema });
const clearCart = () => apiFetch('/client/panier', { method: 'DELETE', schema: z.unknown() });
const reAdd = (item: CartItem) =>
  apiFetch('/client/panier', { method: 'POST', body: { produitId: item.produitId, qty: item.qty, variante: item.variante ?? undefined }, schema: cartSchema });

/**
 * Modifications du panier, toutes optimistes : l'écran change tout de suite,
 * puis prend la réponse du serveur (qui fait foi : plafond 10 / stock) ou
 * revient en arrière avec un message si la requête échoue.
 */
export function useCartActions() {
  const qc = useQueryClient();
  const key = ['cart'];

  const optimistic = async (change: (items: CartItem[]) => CartItem[]) => {
    await qc.cancelQueries({ queryKey: key });
    const prev = qc.getQueryData<CartItem[]>(key);
    qc.setQueryData<CartItem[]>(key, (old) => change(old ?? []));
    return { prev };
  };
  const rollback = (title: string) => (e: unknown, _v: unknown, ctx?: { prev?: CartItem[] }) => {
    if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    Alert.alert(title, toUserMessage(e));
  };
  const settle = (data?: CartItem[] | unknown) => {
    if (Array.isArray(data)) qc.setQueryData(key, data);
    else void qc.invalidateQueries({ queryKey: key });
  };

  const qty = useMutation({
    mutationFn: ({ id, qty: q }: { id: string; qty: number }) => setQty(id, q),
    onMutate: ({ id, qty: q }) => optimistic((l) => l.map((i) => (i.id === id ? { ...i, qty: q } : i))),
    onError: rollback('Quantité'),
    onSuccess: settle,
  });

  const remove = useMutation({
    mutationFn: (item: CartItem) => removeItem(item.id),
    onMutate: (item) => optimistic((l) => l.filter((i) => i.id !== item.id)),
    onError: rollback('Panier'),
    onSuccess: settle,
  });

  const restore = useMutation({
    mutationFn: (item: CartItem) => reAdd(item),
    onError: rollback('Panier'),
    onSuccess: settle,
  });

  const clear = useMutation({
    mutationFn: clearCart,
    onMutate: () => optimistic(() => []),
    onError: rollback('Panier'),
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });

  return {
    setQty: (id: string, q: number) => qty.mutate({ id, qty: q }),
    remove: (item: CartItem) => remove.mutate(item),
    restore: (item: CartItem) => restore.mutate(item),
    clear: () => clear.mutate(),
    clearing: clear.isPending,
  };
}

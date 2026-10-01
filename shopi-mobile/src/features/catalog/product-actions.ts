/**
 * Actions d'une carte produit pour le client connecté — ❤ favori
 * (POST /client/favoris/:id/toggle, optimiste), 🔖 liste de souhaits
 * (POST /client/wishlist/:id/toggle, optimiste) et « Ajouter au panier »
 * (POST /client/panier). Mêmes appels que le site (CardProduit.tsx) ;
 * les autres rôles reçoivent un message clair au lieu d'une action muette.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert } from 'react-native';
import { z } from 'zod';

import { useSession } from '@/features/auth/session-store';
import { useCart } from '@/features/cart/api';
import { addToCart, fetchFavoriteIds, toggleFavorite } from '@/features/shop/api';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/errors';

const fetchWishIds = async () => new Set(await apiFetch('/client/wishlist/ids', { schema: z.array(z.string()).catch([]) }));
const toggleWish = (id: string) => apiFetch(`/client/wishlist/${id}/toggle`, { method: 'POST', schema: z.unknown() });

/** Bascule optimiste d'un id dans un Set du cache (favoris, souhaits). */
function flip(set: Set<string> | undefined, id: string) {
  const next = new Set(set ?? []);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

const clientsOnly = (what: string) => Alert.alert(what, 'Connectez-vous avec un compte client pour utiliser cette fonction.');

export function useProductActions() {
  const qc = useQueryClient();
  const isClient = useSession((s) => s.user?.role) === 'client';

  const favQ = useQuery({ queryKey: ['favorite-ids'], queryFn: fetchFavoriteIds, enabled: isClient });
  const wishQ = useQuery({ queryKey: ['wish-ids'], queryFn: fetchWishIds, enabled: isClient });
  const cartQ = useCart();
  const cartIds = useMemo(() => new Set((cartQ.data ?? []).map((i) => i.produitId)), [cartQ.data]);

  const cart = useMutation({
    mutationFn: (produitId: string) => addToCart(produitId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cart'] }),
    onError: (e) => Alert.alert('Panier', toUserMessage(e)),
  });

  const fav = useMutation({
    mutationFn: (productId: string) => toggleFavorite(productId),
    onMutate: (productId) => {
      const prev = qc.getQueryData<Set<string>>(['favorite-ids']);
      const next = new Set(prev ?? []);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      qc.setQueryData(['favorite-ids'], next);
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['favorite-ids'], ctx.prev);
      Alert.alert('Favoris', toUserMessage(e));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['client-favs'] }),
  });

  const wish = useMutation({
    mutationFn: (productId: string) => toggleWish(productId),
    onMutate: (productId) => {
      const prev = qc.getQueryData<Set<string>>(['wish-ids']);
      qc.setQueryData(['wish-ids'], flip(prev, productId));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['wish-ids'], ctx.prev);
      Alert.alert('Liste de souhaits', toUserMessage(e));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['client-wishlist'] }),
  });

  return {
    wishIds: wishQ.data ?? new Set<string>(),
    toggleWish: (id: string) => (isClient ? wish.mutate(id) : clientsOnly('Liste de souhaits')),
    favIds: favQ.data ?? new Set<string>(),
    cartIds,
    pendingCart: cart.isPending ? cart.variables : undefined,
    toggleFav: (id: string) => (isClient ? fav.mutate(id) : clientsOnly('Favoris')),
    addToCart: (id: string) => (isClient ? cart.mutate(id) : clientsOnly('Panier')),
    refresh: () => {
      void favQ.refetch();
      void wishQ.refetch();
      void cartQ.refetch();
    },
  };
}

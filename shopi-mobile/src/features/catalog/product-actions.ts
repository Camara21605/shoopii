/**
 * Actions d'une carte produit pour le client connecté — ❤ favori
 * (POST /client/favoris/:id/toggle, optimiste), 🔖 liste de souhaits
 * (POST /client/wishlist/:id/toggle, optimiste) et « Ajouter au panier »
 * (POST /client/panier). Mêmes appels que le site (CardProduit.tsx) ;
 * un visiteur ou un autre rôle voit la fenêtre de connexion (auth-gate),
 * comme useAuthGate().requireClient du site.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert } from 'react-native';
import { z } from 'zod';

import { requireClient } from '@/features/auth/auth-gate';
import { useSession } from '@/features/auth/session-store';
import { useCart } from '@/features/cart/api';
import { addToCart, fetchFavoriteIds, toggleFavorite } from '@/features/shop/api';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

const fetchWishIds = async () => new Set(await apiFetch('/client/wishlist/ids', { schema: z.array(z.string()).catch([]) }));
const toggleWish = (id: string) => apiFetch(`/client/wishlist/${id}/toggle`, { method: 'POST', schema: z.unknown() });

/** Bascule optimiste d'un id dans un Set du cache (favoris, souhaits). */
function flip(set: Set<string> | undefined, id: string) {
  const next = new Set(set ?? []);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function useProductActions() {
  const qc = useQueryClient();
  const isClient = useSession((s) => s.user?.role) === 'client';

  const favQ = useQuery({ queryKey: qk.favorites.ids, queryFn: fetchFavoriteIds, enabled: isClient });
  const wishQ = useQuery({ queryKey: qk.wishlist.ids, queryFn: fetchWishIds, enabled: isClient });
  const cartQ = useCart();
  const cartIds = useMemo(() => new Set((cartQ.data ?? []).map((i) => i.produitId)), [cartQ.data]);

  const cart = useMutation({
    mutationFn: (produitId: string) => addToCart(produitId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.cart }),
    onError: (e) => Alert.alert('Panier', toUserMessage(e)),
  });

  const fav = useMutation({
    mutationFn: (productId: string) => toggleFavorite(productId),
    onMutate: (productId) => {
      const prev = qc.getQueryData<Set<string>>(qk.favorites.ids);
      const next = new Set(prev ?? []);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      qc.setQueryData(qk.favorites.ids, next);
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.favorites.ids, ctx.prev);
      Alert.alert('Favoris', toUserMessage(e));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.favorites.list }),
  });

  const wish = useMutation({
    mutationFn: (productId: string) => toggleWish(productId),
    onMutate: (productId) => {
      const prev = qc.getQueryData<Set<string>>(qk.wishlist.ids);
      qc.setQueryData(qk.wishlist.ids, flip(prev, productId));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.wishlist.ids, ctx.prev);
      Alert.alert('Liste de souhaits', toUserMessage(e));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.wishlist.list }),
  });

  return {
    wishIds: wishQ.data ?? new Set<string>(),
    toggleWish: (id: string) => requireClient(() => wish.mutate(id), 'Gardez ce produit dans votre liste de souhaits.'),
    favIds: favQ.data ?? new Set<string>(),
    cartIds,
    pendingCart: cart.isPending ? cart.variables : undefined,
    toggleFav: (id: string) => requireClient(() => fav.mutate(id), 'Ajoutez ce produit à vos favoris.'),
    addToCart: (id: string) => requireClient(() => cart.mutate(id), 'Ajoutez ce produit à votre panier.'),
    refresh: () => {
      void favQ.refetch();
      void wishQ.refetch();
      void cartQ.refetch();
    },
  };
}

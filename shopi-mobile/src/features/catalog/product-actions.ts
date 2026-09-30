/**
 * Actions d'une carte produit pour le client connecté — ❤ favori
 * (POST /client/favoris/:id/toggle, optimiste) et « Ajouter au panier »
 * (POST /client/panier). Mêmes appels que le site (CardProduit.tsx) ;
 * les autres rôles reçoivent un message clair au lieu d'une action muette.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { useSession } from '@/features/auth/session-store';
import { useCart } from '@/features/cart/api';
import { addToCart, fetchFavoriteIds, toggleFavorite } from '@/features/shop/api';
import { toUserMessage } from '@/lib/api/errors';

const clientsOnly = (what: string) => Alert.alert(what, 'Connectez-vous avec un compte client pour utiliser cette fonction.');

export function useProductActions() {
  const qc = useQueryClient();
  const isClient = useSession((s) => s.user?.role) === 'client';

  const favQ = useQuery({ queryKey: ['favorite-ids'], queryFn: fetchFavoriteIds, enabled: isClient });
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

  return {
    favIds: favQ.data ?? new Set<string>(),
    cartIds,
    pendingCart: cart.isPending ? cart.variables : undefined,
    toggleFav: (id: string) => (isClient ? fav.mutate(id) : clientsOnly('Favoris')),
    addToCart: (id: string) => (isClient ? cart.mutate(id) : clientsOnly('Panier')),
    refresh: () => {
      void favQ.refetch();
      void cartQ.refetch();
    },
  };
}

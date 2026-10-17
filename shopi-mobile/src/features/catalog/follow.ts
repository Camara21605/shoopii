/**
 * Bouton « S'abonner » : boutiques suivies du client + bascule immédiate
 * (POST /suivis/{entreprises|livreurs|correspondants}/:id). Mise à jour
 * optimiste : l'état change tout de suite, revient en arrière si le serveur
 * refuse. Réservé au client connecté (le site impose la même règle) : un
 * visiteur voit la fenêtre « Connectez-vous pour continuer » (auth-gate).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { requireClient } from '@/features/auth/auth-gate';
import { useSession } from '@/features/auth/session-store';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { fetchFollowedShopIds, toggleFollow, type FollowKind } from './api';

export function useFollowedShops() {
  const role = useSession((s) => s.user?.role);
  return useQuery({ queryKey: qk.follows.shops, queryFn: fetchFollowedShopIds, enabled: role === 'client', staleTime: 60_000 });
}

/** Bascule le suivi ; `pending` = id en cours d'envoi (spinner sur le bon bouton). */
export function useToggleFollow(kind: FollowKind) {
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: (id: string) => toggleFollow(kind, id),
    onMutate: async (id) => {
      if (kind !== 'entreprises') return;
      const prev = qc.getQueryData<Set<string>>(qk.follows.shops);
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      qc.setQueryData(qk.follows.shops, next);
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.follows.shops, ctx.prev);
      Alert.alert('Abonnement', toUserMessage(err));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.follows.all });
      if (kind !== 'entreprises') void qc.invalidateQueries({ queryKey: [kind] });
      /* Accueil : un compte suivi n'y est plus proposé, un compte quitté y revient */
      else void qc.invalidateQueries({ queryKey: ['shops', 'home'] });
    },
  });

  return {
    toggle: (id: string) => requireClient(() => m.mutate(id), 'Abonnez-vous pour suivre ses nouveautés et lui écrire.'),
    pending: m.isPending ? m.variables : undefined,
  };
}

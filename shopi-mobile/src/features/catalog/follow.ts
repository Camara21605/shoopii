/**
 * Bouton « S'abonner » : boutiques suivies du client + bascule immédiate
 * (POST /suivis/{entreprises|livreurs|correspondants}/:id). Mise à jour
 * optimiste : l'état change tout de suite, revient en arrière si le serveur
 * refuse. Réservé au client connecté (le site impose la même règle).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { useSession } from '@/features/auth/session-store';
import { toUserMessage } from '@/lib/api/errors';

import { fetchFollowedShopIds, toggleFollow, type FollowKind } from './api';

export function useFollowedShops() {
  const role = useSession((s) => s.user?.role);
  return useQuery({ queryKey: ['follows', 'entreprises'], queryFn: fetchFollowedShopIds, enabled: role === 'client', staleTime: 60_000 });
}

/** Bascule le suivi ; `pending` = id en cours d'envoi (spinner sur le bon bouton). */
export function useToggleFollow(kind: FollowKind) {
  const qc = useQueryClient();
  const role = useSession((s) => s.user?.role);

  const m = useMutation({
    mutationFn: (id: string) => toggleFollow(kind, id),
    onMutate: async (id) => {
      if (kind !== 'entreprises') return;
      const prev = qc.getQueryData<Set<string>>(['follows', 'entreprises']);
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      qc.setQueryData(['follows', 'entreprises'], next);
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['follows', 'entreprises'], ctx.prev);
      Alert.alert('Abonnement', toUserMessage(err));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['follows'] });
      if (kind !== 'entreprises') void qc.invalidateQueries({ queryKey: [kind] });
    },
  });

  return {
    toggle: (id: string) => {
      if (role !== 'client') {
        Alert.alert('Abonnement', 'Seuls les comptes clients peuvent s’abonner.');
        return;
      }
      m.mutate(id);
    },
    pending: m.isPending ? m.variables : undefined,
  };
}

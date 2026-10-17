/**
 * Hooks du réseau du livreur :
 *   · useMyLivreurId()   id de MON profil livreur (jamais listé, jamais « S'abonner ») ;
 *   · useFollowActions() suivre / se désabonner / masquer / retirer de la liste —
 *                        comme le bouton FollowButton du site (⋮ Se désabonner,
 *                        Masquer, Supprimer) ; la réponse du serveur est reportée
 *                        dans toutes les listes et profils déjà chargés ;
 *   · useDistances()     « · 2,3 km » depuis ma position, seulement si la
 *                        localisation est DÉJÀ autorisée (aucune fenêtre surprise).
 */
import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Location from 'expo-location';

import { fetchSettings } from '@/features/livreur-settings/api';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { fetchDistances, setHidden, toggleFollow, type ActorRole, type DriverProfile, type DriverRow, type NetworkKind, type RelayProfile, type RelayRow } from './api';

export function useMyLivreurId() {
  const q = useQuery({ queryKey: qk.livreur.settings, queryFn: fetchSettings, staleTime: 5 * 60_000 });
  return q.data?.id ?? null;
}

type DriversPage = { data: DriverRow[]; total: number };
type Patch = { isSuivi?: boolean; removed?: boolean };

const LABEL: Record<NetworkKind, string> = { livreurs: 'ce livreur', correspondants: 'ce correspondant' };

export function useFollowActions(kind: NetworkKind, notify: (msg: string, error?: boolean) => void) {
  const qc = useQueryClient();

  /** Reporte un changement dans les listes et le profil déjà chargés. */
  const apply = (id: string, p: Patch) => {
    if (kind === 'correspondants') {
      qc.setQueriesData<RelayRow[]>({ queryKey: [...qk.livreur.network, 'relays'] }, (list) =>
        list ? (p.removed ? list.filter((r) => r.id !== id) : list.map((r) => (r.id === id && p.isSuivi !== undefined ? { ...r, isSuivi: p.isSuivi } : r))) : list,
      );
      if (p.isSuivi !== undefined)
        qc.setQueryData<RelayProfile>(qk.livreur.relay(id), (pr) => (pr && pr.suivi !== p.isSuivi ? { ...pr, suivi: !!p.isSuivi, abonnes: Math.max(0, pr.abonnes + (p.isSuivi ? 1 : -1)) } : pr));
    } else {
      qc.setQueriesData<InfiniteData<DriversPage>>({ queryKey: [...qk.livreur.network, 'drivers'] }, (inf) =>
        inf
          ? {
              ...inf,
              pages: inf.pages.map((pg) => ({
                ...pg,
                data: p.removed ? pg.data.filter((d) => d.id !== id) : pg.data.map((d) => (d.id === id && p.isSuivi !== undefined ? { ...d, isSuivi: p.isSuivi } : d)),
                total: p.removed && pg.data.some((d) => d.id === id) ? Math.max(0, pg.total - 1) : pg.total,
              })),
            }
          : inf,
      );
      if (p.isSuivi !== undefined)
        qc.setQueryData<DriverProfile>(qk.livreur.driver(id), (pr) =>
          pr && pr.isSuivi !== p.isSuivi ? { ...pr, isSuivi: !!p.isSuivi, abonnesCount: Math.max(0, pr.abonnesCount + (p.isSuivi ? 1 : -1)) } : pr,
        );
    }
  };

  const follow = useMutation({
    mutationFn: async ({ id }: { id: string; name: string; remove?: boolean }) => toggleFollow(kind, id),
    onSuccess: (res, { id, name, remove }) => {
      apply(id, { isSuivi: res.isSuivi });
      if (remove && !res.isSuivi) apply(id, { removed: true });
      notify(res.isSuivi ? `✅ Abonné à ${name}` : `👋 Désabonné de ${name}`);
    },
    onError: (e) => notify(`❌ ${toUserMessage(e)}`, true),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.follows.all }),
  });

  const hide = useMutation({
    mutationFn: ({ id }: { id: string }) => setHidden(kind, id, true),
    onSuccess: (_r, { id }) => {
      apply(id, { removed: true });
      notify(`🙈 ${LABEL[kind]} masqué(e) des listes — réaffichable depuis « Mes abonnements » du site`);
    },
    onError: (e) => notify(`❌ ${toUserMessage(e)}`, true),
  });

  const busy = follow.isPending ? follow.variables?.id : hide.isPending ? hide.variables?.id : undefined;
  return {
    /** Suivre si pas suivi, se désabonner sinon. */
    toggle: (id: string, name: string) => follow.mutate({ id, name }),
    /** Se désabonner ET retirer la carte de la liste affichée (« Supprimer » du site). */
    remove: (id: string, name: string) => follow.mutate({ id, name, remove: true }),
    hide: (id: string) => hide.mutate({ id }),
    busy,
  };
}

/** Distances depuis ma position (seulement si la localisation est déjà autorisée). */
export function useDistances(role: ActorRole, ids: string[]) {
  const key = ids.slice(0, 60).join(',');
  return useQuery({
    queryKey: qk.livreur.distances(role, key),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return {} as Record<string, { km: number; approx: boolean } | null>;
      const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      return fetchDistances(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        ids.slice(0, 60).map((id) => ({ role, id })),
      );
    },
  });
}

/**
 * Données partagées par tous les écrans correspondant (cache qk.correspondant) :
 * identité (nom, photo, id du point relais), vue d'ensemble et pastilles du
 * menu et de la barre du bas (mêmes compteurs que la barre latérale du site :
 * colis à réceptionner, transferts, retours, boutiques, livreurs, note).
 */
import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { fetchColis, fetchEvaluation, fetchMe, fetchOverview } from './api';

export const useCorrespondantMe = () => useQuery({ queryKey: qk.correspondant.me, queryFn: fetchMe, staleTime: 10 * 60_000 });
export const useOverview = () => useQuery({ queryKey: qk.correspondant.overview, queryFn: fetchOverview, refetchInterval: 60_000 });
export const useColis = () => useQuery({ queryKey: qk.correspondant.colis, queryFn: fetchColis, refetchInterval: 45_000 });
export const useEvaluation = () => useQuery({ queryKey: qk.correspondant.evaluation, queryFn: fetchEvaluation, staleTime: 5 * 60_000 });

export function useCorrespondantBadges() {
  const o = useOverview().data;
  const ev = useEvaluation().data;
  return {
    colis: o?.colisCounts.att ?? 0,
    transferts: o?.colisCounts.dep ?? 0,
    retours: o?.colisCounts.ret ?? 0,
    boutiques: o?.relayFlow.sources ?? 0,
    livreurs: o?.relayFlow.destinations ?? 0,
    /* Note affichée à côté de « Mon évaluation » seulement s'il y a des missions (comme le site) */
    note: ev && ev.totalMissions > 0 ? ev.averageRating : null,
  };
}

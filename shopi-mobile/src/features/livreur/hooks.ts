/**
 * Données partagées par tous les écrans livreur (cache qk.livreur) : identité
 * (nom, photo), statistiques, nombre de missions en cours et de nouvelles
 * missions (pastilles du menu et de la barre du bas).
 */
import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { fetchMe, fetchMissions, fetchStats } from './api';

export const useLivreurMe = () => useQuery({ queryKey: qk.livreur.me, queryFn: fetchMe, staleTime: 10 * 60_000 });
export const useLivreurStats = () => useQuery({ queryKey: qk.livreur.stats, queryFn: fetchStats, staleTime: 60_000 });
export const useMissions = () => useQuery({ queryKey: qk.livreur.missions, queryFn: fetchMissions, refetchInterval: 45_000 });

/** Pastilles : nouvelles missions à accepter, missions en route (colis pris en charge).
 *  (Le compteur du serveur « nbActives » inclut aussi les missions pas encore acceptées.) */
export function useLivreurBadges() {
  const missions = useMissions();
  const list = missions.data ?? [];
  return {
    missions: list.filter((m) => m.status === 'new').length,
    encours: list.filter((m) => m.status === 'active').length,
  };
}

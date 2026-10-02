/**
 * Hooks de l'espace entreprise : identité de la boutique, permissions de
 * l'utilisateur (propriétaire ou collaborateur) et pastilles du menu.
 * Chargés une fois puis partagés par tous les écrans entreprise (cache qk.company).
 */
import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { can, fetchIdentity, fetchPermissions, fetchUnreadByType } from './api';

export function useCompanyIdentity() {
  return useQuery({ queryKey: qk.company.identity, queryFn: fetchIdentity, staleTime: 10 * 60_000 });
}

/** `can('orders', 'view')` — même règle que le site ; refus tant que les permissions ne sont pas chargées. */
export function usePermissions() {
  const q = useQuery({ queryKey: qk.company.permissions, queryFn: fetchPermissions, staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 });
  return {
    can: (group: string, action: string) => can(q.data, group, action),
    isOwner: q.data?.isOwner ?? false,
    loading: q.isPending,
  };
}

export function useCompanyBadges() {
  return useQuery({ queryKey: qk.company.badges, queryFn: fetchUnreadByType, refetchInterval: 60_000 });
}

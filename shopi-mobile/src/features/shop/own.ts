/**
 * « Est-ce ma boutique ? » — un compte entreprise (propriétaire ou membre de
 * l'équipe) qui ouvre sa propre boutique ou l'un de ses produits ne doit pas
 * voir les actions réservées aux visiteurs : s'abonner, écrire, appeler,
 * favoris, panier, acheter. On lui propose plutôt de gérer (paramètres,
 * produits). Même cache que useCompanyIdentity (qk.company.identity).
 */
import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-store';
import { fetchIdentity } from '@/features/company/api';
import { qk } from '@/lib/query-keys';

/** Identifiant de ma boutique (compte entreprise), sinon undefined. */
export function useMyShopId(): string | undefined {
  const isCompany = useSession((s) => s.user?.role === 'company');
  const q = useQuery({ queryKey: qk.company.identity, queryFn: fetchIdentity, enabled: isCompany, staleTime: 10 * 60_000 });
  return isCompany ? q.data?.id : undefined;
}

/** true si `shopId` est la boutique du compte connecté. */
export function useIsMyShop(shopId: string | undefined): boolean {
  const mine = useMyShopId();
  return !!mine && !!shopId && mine === shopId;
}

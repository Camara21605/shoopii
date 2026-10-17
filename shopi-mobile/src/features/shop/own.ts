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
import { fetchMyDriverSettings } from '@/features/driver-public/api';
import { fetchMyRelayId } from '@/features/relay-public/api';
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

/**
 * Identifiants de MES profils publics, quel que soit mon rôle : boutique,
 * livreur ou point relais. Sert à ne jamais proposer de m'abonner à moi-même
 * (listes d'équipe d'une boutique, cartes de l'accueil…). Le serveur me
 * retire déjà de toutes les listes et refuse l'abonnement : c'est une
 * seconde sécurité pour les données déjà en cache.
 */
export function useMyActorIds(): { shop?: string; driver?: string; relay?: string } {
  const role = useSession((s) => s.user?.role);
  const shop = useMyShopId();
  const driver = useQuery({ queryKey: qk.livreur.settings, queryFn: fetchMyDriverSettings, enabled: role === 'delivery', staleTime: 5 * 60_000 });
  const relay = useQuery({ queryKey: qk.myRelayId, queryFn: fetchMyRelayId, enabled: role === 'correspondent', staleTime: 10 * 60_000 });
  return {
    shop,
    driver: role === 'delivery' ? driver.data?.id || undefined : undefined,
    relay: role === 'correspondent' ? relay.data || undefined : undefined,
  };
}

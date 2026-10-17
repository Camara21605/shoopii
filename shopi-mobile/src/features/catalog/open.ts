/**
 * Ouverture des fiches. Boutiques, produits, livreurs et points relais ont leur écran
 * natif (features/shop, features/product, features/driver-public, features/relay-public) ; le reste
 * s'ouvre sur le site (navigateur intégré) en attendant les écrans natifs.
 *
 * Performance : la fiche est PRÉCHARGÉE au moment du toucher (prefetchQuery),
 * en parallèle de l'animation de transition — l'écran s'affiche déjà rempli
 * au lieu d'attendre le réseau. Même clé que l'écran (qk), donc aucun doublon.
 */
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { fetchDriverProfile, fetchRelayProfile } from '@/features/livreur-network/api';
import { fetchProduct } from '@/features/product/api';
import { fetchPublicService } from '@/features/service-public/api';
import { fetchShop } from '@/features/shop/api';
import { queryClient } from '@/lib/query-client';
import { qk } from '@/lib/query-keys';

const SITE = 'https://www.shoneya.com';

export const openProduct = (id: string) => {
  void queryClient.prefetchQuery({ queryKey: qk.product.detail(id), queryFn: () => fetchProduct(id) });
  router.push({ pathname: '/produit/[id]', params: { id } });
};

export const openShop = (id: string) => {
  void queryClient.prefetchQuery({ queryKey: qk.shop.detail(id), queryFn: () => fetchShop(id) });
  router.push({ pathname: '/boutique/[id]', params: { id } });
};

export const openService = (id: string) => {
  void queryClient.prefetchQuery({ queryKey: qk.servicePublic(id), queryFn: () => fetchPublicService(id) });
  router.push({ pathname: '/service/[id]', params: { id } });
};

export const openDriver = (id: string) => {
  void queryClient.prefetchQuery({ queryKey: qk.driverPublic(id), queryFn: () => fetchDriverProfile(id) });
  router.push({ pathname: '/profil-livreur/[id]', params: { id } });
};
export const openRelay = (id: string) => {
  void queryClient.prefetchQuery({ queryKey: qk.relayPublic(id), queryFn: () => fetchRelayProfile(id) });
  router.push({ pathname: '/point-relais/[id]', params: { id } });
};
export const openSite = (path: string) => void WebBrowser.openBrowserAsync(`${SITE}${path}`);

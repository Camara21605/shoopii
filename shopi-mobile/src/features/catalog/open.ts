/**
 * Ouverture des fiches. Boutiques et produits ont leur écran natif
 * (features/shop/screens, features/product/screens) ; le reste s'ouvre sur le
 * site (navigateur intégré) en attendant les écrans natifs.
 *
 * Performance : la fiche est PRÉCHARGÉE au moment du toucher (prefetchQuery),
 * en parallèle de l'animation de transition — l'écran s'affiche déjà rempli
 * au lieu d'attendre le réseau. Même clé que l'écran (qk), donc aucun doublon.
 */
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { fetchProduct } from '@/features/product/api';
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

export const openDriver = (id: string) => void WebBrowser.openBrowserAsync(`${SITE}/livreurs/${id}`);
export const openRelay = (id: string) => void WebBrowser.openBrowserAsync(`${SITE}/correspondants/${id}`);
export const openSite = (path: string) => void WebBrowser.openBrowserAsync(`${SITE}${path}`);

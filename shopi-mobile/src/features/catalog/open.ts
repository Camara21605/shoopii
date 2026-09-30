/**
 * Ouverture des fiches. Les boutiques ont leur écran natif (app/(app)/boutique/[id].tsx) ;
 * le reste s'ouvre sur le site (navigateur intégré) en attendant les écrans natifs.
 */
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

const SITE = 'https://www.shoneya.com';

export const openProduct = (id: string) => void WebBrowser.openBrowserAsync(`${SITE}/produit/${id}`);
export const openShop = (id: string) => router.push({ pathname: '/boutique/[id]', params: { id } });
export const openDriver = (id: string) => void WebBrowser.openBrowserAsync(`${SITE}/livreurs/${id}`);
export const openRelay = (id: string) => void WebBrowser.openBrowserAsync(`${SITE}/correspondants/${id}`);
export const openSite = (path: string) => void WebBrowser.openBrowserAsync(`${SITE}${path}`);

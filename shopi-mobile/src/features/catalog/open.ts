/** Ouverture des fiches — sur le site (navigateur intégré) en attendant les écrans natifs. */
import * as WebBrowser from 'expo-web-browser';

const SITE = 'https://www.shoneya.com';

export const openProduct = (id: string) => void WebBrowser.openBrowserAsync(`${SITE}/produit/${id}`);
export const openShop = (id: string) => void WebBrowser.openBrowserAsync(`${SITE}/boutique/${id}`);
export const openDriver = (id: string) => void WebBrowser.openBrowserAsync(`${SITE}/livreurs/${id}`);
export const openRelay = (id: string) => void WebBrowser.openBrowserAsync(`${SITE}/correspondants/${id}`);
export const openSite = (path: string) => void WebBrowser.openBrowserAsync(`${SITE}${path}`);

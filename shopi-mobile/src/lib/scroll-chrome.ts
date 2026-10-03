/**
 * Barre du bas qui se cache au défilement — pour TOUS les espaces (client,
 * entreprise, et les futurs tableaux de bord) :
 *   · on fait défiler vers le bas  → la barre du bas glisse hors de l'écran ;
 *   · on remonte (ou on revient en haut) → elle réapparaît.
 *
 * Utilisation dans un écran qui a une barre du bas :
 *   <ScrollView {...hideOnScroll} …>  ou  <FlatList {...hideOnScroll} …>
 * La barre lit `chromeHidden` (0 = visible, 1 = cachée) pour s'animer ;
 * elle est en position absolue : le contenu prévoit une marge basse (~100).
 * À chaque arrivée sur un écran, la barre se réaffiche (showChrome, appelé par
 * la barre elle-même : CompanyBottomNav, onglets clients).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

export const chromeHidden = new Animated.Value(0);

let hidden = false;
let lastY = 0;
/** Seuil (px) pour ignorer les micro-mouvements du doigt. */
const STEP = 8;

function setHidden(h: boolean) {
  if (h === hidden) return;
  hidden = h;
  Animated.timing(chromeHidden, { toValue: h ? 1 : 0, duration: 220, useNativeDriver: true }).start();
}

export function showChrome() {
  lastY = 0;
  setHidden(false);
}

export function handleChromeScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
  const y = contentOffset.y;
  const maxY = Math.max(0, contentSize.height - layoutMeasurement.height);
  const dy = y - lastY;
  if (y <= 20) setHidden(false); // tout en haut : toujours visible
  else if (y >= maxY - 2) {
    /* rebond en bas de liste : on ne change rien */
  } else if (dy > STEP) setHidden(true);
  else if (dy < -STEP) setHidden(false);
  if (Math.abs(dy) > STEP || y <= 20) lastY = y;
}

/** Props à étaler sur le ScrollView / FlatList principal de l'écran. */
export const hideOnScroll = { onScroll: handleChromeScroll, scrollEventThrottle: 16 } as const;

/** Réaffiche la barre à chaque arrivée sur l'écran (à appeler dans la barre). */
export function useShowChromeOnFocus() {
  useFocusEffect(useCallback(() => showChrome(), []));
}

/** Décalage vertical (px) d'un élément qui doit sortir de l'écran par le bas. */
export const chromeTranslate = (distance: number) => ({
  transform: [{ translateY: chromeHidden.interpolate({ inputRange: [0, 1], outputRange: [0, distance] }) }],
});

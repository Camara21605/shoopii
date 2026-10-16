/**
 * Menu latéral ☰ de l'espace client : il SORT DU CÔTÉ DU BOUTON ☰ (à droite de
 * l'en-tête), glisse vers la gauche pour entrer et repart vers la droite.
 * État ouvert/fermé et animation partagés entre l'en-tête (qui l'ouvre) et le
 * tiroir monté une seule fois dans (app)/_layout. Fermeture = l'animation joue
 * d'abord, puis le tiroir est retiré.
 */
import { useSyncExternalStore } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

/** Le menu laisse voir une bande de l'écran à gauche (toucher = fermer). */
export const DRAWER_WIDTH = Math.min(Math.round(Dimensions.get('window').width * 0.88), 420);
/** 0 = ouvert ; DRAWER_WIDTH = rangé hors de l'écran, à droite. */
export const drawerX = new Animated.Value(DRAWER_WIDTH);

let open = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  open = v;
  listeners.forEach((l) => l());
};

export function openClientDrawer() {
  if (open) return;
  drawerX.setValue(DRAWER_WIDTH);
  set(true);
  Animated.spring(drawerX, { toValue: 0, useNativeDriver: true, damping: 26, stiffness: 260, mass: 0.9 }).start();
}

export function closeClientDrawer(then?: () => void) {
  if (!open) {
    then?.();
    return;
  }
  Animated.timing(drawerX, { toValue: DRAWER_WIDTH, duration: 180, useNativeDriver: true }).start(() => {
    set(false);
    then?.();
  });
}

const settle = () => Animated.spring(drawerX, { toValue: 0, useNativeDriver: true, damping: 26, stiffness: 300 }).start();

/** Glisser le tiroir vers la droite pour le fermer. */
export const drawerPan = PanResponder.create({
  onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy),
  onPanResponderMove: (_, g) => drawerX.setValue(Math.max(0, g.dx)),
  onPanResponderRelease: (_, g) => {
    if (g.dx > DRAWER_WIDTH / 3 || g.vx > 0.5) closeClientDrawer();
    else settle();
  },
  onPanResponderTerminate: settle,
});

export function useClientDrawerOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
  );
}

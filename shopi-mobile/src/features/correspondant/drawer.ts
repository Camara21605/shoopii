/**
 * Menu latéral ☰ de l'espace correspondant : état ouvert/fermé et animation de
 * glissement, partagés entre l'en-tête (qui l'ouvre) et le tiroir monté une
 * seule fois dans correspondant/_layout (même mécanique que l'espace entreprise).
 */
import { useSyncExternalStore } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

export const DRAWER_WIDTH = Dimensions.get('window').width;
export const drawerX = new Animated.Value(-DRAWER_WIDTH);

let open = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  open = v;
  listeners.forEach((l) => l());
};

export function openCorrespondantDrawer() {
  drawerX.setValue(-DRAWER_WIDTH);
  set(true);
  Animated.timing(drawerX, { toValue: 0, duration: 230, useNativeDriver: true }).start();
}

export function closeCorrespondantDrawer() {
  if (!open) return;
  Animated.timing(drawerX, { toValue: -DRAWER_WIDTH, duration: 190, useNativeDriver: true }).start(() => set(false));
}

export const drawerPan = PanResponder.create({
  onMoveShouldSetPanResponder: (_, g) => g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy),
  onPanResponderMove: (_, g) => drawerX.setValue(Math.min(0, g.dx)),
  onPanResponderRelease: (_, g) => {
    if (g.dx < -DRAWER_WIDTH / 3 || g.vx < -0.5) closeCorrespondantDrawer();
    else Animated.timing(drawerX, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  },
});

export function useCorrespondantDrawerOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
  );
}

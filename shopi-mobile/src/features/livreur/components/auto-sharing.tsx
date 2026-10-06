/**
 * Partage de position automatique pendant une livraison (monté une seule fois
 * dans le layout livreur) : « livraison en cours » = une mission acceptée
 * (à récupérer ou en route), comme la règle du site (LivreurApp, /livreur/encours).
 */
import { useMissions } from '../hooks';
import { useAutoSharing } from '../sharing';

export function AutoSharing() {
  const missions = useMissions();
  const hasActive = (missions.data ?? []).some((m) => m.status === 'prep' || m.status === 'active');
  useAutoSharing(hasActive);
  return null;
}

/** Livraison en cours (même règle que le partage automatique). */
export function useHasActiveMission() {
  const missions = useMissions();
  return (missions.data ?? []).some((m) => m.status === 'prep' || m.status === 'active');
}

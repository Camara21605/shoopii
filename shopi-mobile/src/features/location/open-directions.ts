/**
 * Ouvre l'écran Itinéraire de l'appli (façon Google Maps) vers un point précis.
 * Sans coordonnées (adresse seulement), on ne peut pas tracer : la recherche
 * s'ouvre dans Google Maps, comme avant.
 */
import { router } from 'expo-router';
import { Linking } from 'react-native';

export interface DirectionsTarget {
  lat?: number | null;
  lng?: number | null;
  /** Nom affiché (« Chez Drake », « Boutique Fatou »…). */
  name?: string | null;
  /** Adresse ou repère, en sous-titre. */
  address?: string | null;
}

export function openDirections(t: DirectionsTarget): void {
  if (t.lat != null && t.lng != null && Number.isFinite(t.lat) && Number.isFinite(t.lng)) {
    router.push({
      pathname: '/itineraire',
      params: { lat: String(t.lat), lng: String(t.lng), name: t.name ?? '', address: t.address ?? '' },
    });
    return;
  }
  const q = [t.name, t.address].filter(Boolean).join(', ');
  if (q) void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q}, Guinée`)}`);
}

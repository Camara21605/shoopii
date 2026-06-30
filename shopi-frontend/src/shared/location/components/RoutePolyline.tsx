/* ============================================================
 * FICHIER : src/shared/location/components/RoutePolyline.tsx
 *
 * RÔLE : Affiche la route calculée par ORS sur la carte Leaflet.
 *        Utilise react-leaflet Polyline + un décorateur de flèches.
 * ============================================================ */

import { useEffect } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import type { RouteResult } from '../services/routingApi';

interface Props {
  route:     RouteResult;
  fitBounds?: boolean;   // auto-zoom sur la route
}

const ROUTE_STYLE = {
  color:     '#1A4FC4',
  weight:    5,
  opacity:   0.85,
  dashArray: undefined as string | undefined,
  lineJoin:  'round' as const,
};

const FALLBACK_STYLE = {
  ...ROUTE_STYLE,
  color:     '#94A3B8',
  weight:    3,
  opacity:   0.6,
  dashArray: '8, 6',
};

/** Auto-ajuste le zoom de la carte pour inclure toute la route */
function FitRouteEffect({ polyline }: { polyline: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (polyline.length < 2) return;
    const bounds = polyline.reduce(
      (b, [lat, lng]) => b.extend([lat, lng]),
      new (window as any).L.LatLngBounds(polyline[0], polyline[0]),
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, polyline]);
  return null;
}

export default function RoutePolyline({ route, fitBounds = true }: Props) {
  if (!route.polyline.length) return null;

  const style = route.provider === 'openrouteservice'
    ? ROUTE_STYLE
    : FALLBACK_STYLE;

  return (
    <>
      {/* Ombre de la route (effet de profondeur) */}
      <Polyline
        positions={route.polyline}
        pathOptions={{ color: '#000', weight: style.weight + 2, opacity: 0.12 }}
      />
      {/* Route principale */}
      <Polyline
        positions={route.polyline}
        pathOptions={style}
      />
      {fitBounds && <FitRouteEffect polyline={route.polyline} />}
    </>
  );
}

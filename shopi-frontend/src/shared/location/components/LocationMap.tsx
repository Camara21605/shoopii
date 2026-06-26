/* ============================================================
 * FICHIER : src/shared/location/components/LocationMap.tsx
 * RÔLE    : Composant carte de base (read-only).
 *           Utilisé comme fondation pour tous les autres
 *           composants carte.
 * ============================================================ */

import React, { useEffect } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup,
  ZoomControl, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/location.css';

import { OSM_TILE, DARK_TILE, DEFAULT_CENTER, DEFAULT_ZOOM } from '../utils/geoUtils';
import type { BaseMapProps, Coordinates } from '../types/location.types';

/* ── Fix icônes Leaflet avec Vite ────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── Icône marqueur personnalisée ────────────────────────────── */
export function createCustomIcon(color: 'blue' | 'green' | 'orange' | 'red' | 'purple' = 'blue', emoji = '📍') {
  return L.divIcon({
    className: '',
    html: `<div class="loc-marker-icon ${color}"><span class="icon-inner">${emoji}</span></div>`,
    iconSize:   [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -42],
  });
}

/* ── Icône GPS pulsante ──────────────────────────────────────── */
export const GPS_ICON = L.divIcon({
  className: '',
  html: '<div class="loc-gps-marker"></div>',
  iconSize:   [18, 18],
  iconAnchor: [9, 9],
});

/* ── Sous-composant : recadrage automatique ──────────────────── */
interface RecenterProps { center: Coordinates; zoom?: number }
function Recenter({ center, zoom }: RecenterProps) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.latitude, center.longitude], zoom ?? map.getZoom(), { duration: 0.8 });
  }, [center.latitude, center.longitude, zoom, map]);
  return null;
}

/* ── Props LocationMap ───────────────────────────────────────── */
export interface MarkerConfig {
  id:        string;
  position:  Coordinates;
  color?:    'blue' | 'green' | 'orange' | 'red' | 'purple';
  emoji?:    string;
  popupContent?: React.ReactNode;
}

interface LocationMapProps extends BaseMapProps {
  markers?:       MarkerConfig[];
  showGpsMarker?: Coordinates | null;    // marqueur GPS bleu pulsant
  onMapClick?:    (coords: Coordinates) => void;
  children?:      React.ReactNode;
}

/* ── Sous-composant : clic sur la carte ─────────────────────── */
function MapClickHandler({ onMapClick }: { onMapClick: (c: Coordinates) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) =>
      onMapClick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [map, onMapClick]);
  return null;
}

/* ── Composant principal ─────────────────────────────────────── */
export default function LocationMap({
  center      = DEFAULT_CENTER,
  zoom        = DEFAULT_ZOOM,
  height      = '400px',
  darkMode    = false,
  className   = '',
  markers     = [],
  showGpsMarker,
  onMapClick,
  children,
}: LocationMapProps) {
  const tile = darkMode ? DARK_TILE : OSM_TILE;

  return (
    <div
      className={`loc-map-container${darkMode ? ' dark' : ''} ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={zoom}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
        <ZoomControl position="bottomright" />

        {/* Recadrage automatique si center change */}
        <Recenter center={center} zoom={zoom} />

        {/* Clic sur la carte */}
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

        {/* Marqueur GPS pulsant */}
        {showGpsMarker && (
          <Marker position={[showGpsMarker.latitude, showGpsMarker.longitude]} icon={GPS_ICON} />
        )}

        {/* Marqueurs configurés */}
        {markers.map(m => (
          <Marker
            key={m.id}
            position={[m.position.latitude, m.position.longitude]}
            icon={createCustomIcon(m.color, m.emoji)}
          >
            {m.popupContent && (
              <Popup className="loc-popup">{m.popupContent}</Popup>
            )}
          </Marker>
        ))}

        {/* Contenu custom (cercles, polylines, etc.) */}
        {children}
      </MapContainer>
    </div>
  );
}

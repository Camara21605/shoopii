/* ============================================================
 * FICHIER : src/shared/location/components/LocationPicker.tsx
 * RÔLE    : Carte interactive permettant de :
 *           - Cliquer pour choisir une position
 *           - Drag & Drop du marqueur
 *           - Bouton GPS pour position actuelle
 *           - Recherche d'adresse (Nominatim)
 *           - Reverse geocoding automatique
 * ============================================================ */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, ZoomControl,
  useMapEvents, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/location.css';

import { OSM_TILE, DARK_TILE, DEFAULT_CENTER, DEFAULT_ZOOM } from '../utils/geoUtils';
import { reverseGeocode, searchAddress }                     from '../utils/nominatim';
import { createCustomIcon, GPS_ICON }                        from './LocationMap';
import type { Coordinates, NominatimResult }                 from '../types/location.types';

/* ── Sous-composant : marqueur draggable ─────────────────────── */
interface DraggableMarkerProps {
  position:  Coordinates;
  onDragEnd: (pos: Coordinates) => void;
}
function DraggableMarker({ position, onDragEnd }: DraggableMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const icon      = createCustomIcon('blue', '📍');

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (!marker) return;
      const { lat, lng } = marker.getLatLng();
      onDragEnd({ latitude: lat, longitude: lng });
    },
  };

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={[position.latitude, position.longitude]}
      ref={markerRef}
      icon={icon}
    />
  );
}

/* ── Sous-composant : clic sur carte ─────────────────────────── */
function ClickHandler({ onClick }: { onClick: (c: Coordinates) => void }) {
  useMapEvents({
    click(e) { onClick({ latitude: e.latlng.lat, longitude: e.latlng.lng }); },
  });
  return null;
}

/* ── Sous-composant : recadrage ──────────────────────────────── */
function FlyTo({ center }: { center: Coordinates }) {
  const map = useMap();
  const prev = useRef<Coordinates | null>(null);
  useEffect(() => {
    if (!prev.current || prev.current.latitude !== center.latitude || prev.current.longitude !== center.longitude) {
      map.flyTo([center.latitude, center.longitude], 16, { duration: 0.7 });
      prev.current = center;
    }
  }, [center, map]);
  return null;
}

/* ── Props ───────────────────────────────────────────────────── */
export interface LocationPickerValue {
  coordinates: Coordinates;
  address:     NominatimResult | null;
}

interface LocationPickerProps {
  value?:           LocationPickerValue | null;
  onChange:         (val: LocationPickerValue) => void;
  height?:          string;
  darkMode?:        boolean;
  placeholder?:     string;
  showSearch?:      boolean;
  showGpsButton?:   boolean;
}

/* ── Composant principal ─────────────────────────────────────── */
export default function LocationPicker({
  value,
  onChange,
  height       = '380px',
  darkMode     = false,
  placeholder  = 'Rechercher une adresse…',
  showSearch   = true,
  showGpsButton = true,
}: LocationPickerProps) {
  const tile = darkMode ? DARK_TILE : OSM_TILE;

  const [position,    setPosition]    = useState<Coordinates>(value?.coordinates ?? DEFAULT_CENTER);
  const [gpsLoading,  setGpsLoading]  = useState(false);
  const [gpsPos,      setGpsPos]      = useState<Coordinates | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRes,   setSearchRes]   = useState<NominatimResult[]>([]);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [revLoading,  setRevLoading]  = useState(false);

  // Sync de l'extérieur → intérieur
  useEffect(() => {
    if (value?.coordinates) setPosition(value.coordinates);
  }, [value?.coordinates]);

  const handlePositionChange = useCallback(async (coords: Coordinates) => {
    setPosition(coords);
    setRevLoading(true);
    const addr = await reverseGeocode(coords.latitude, coords.longitude);
    setRevLoading(false);
    onChange({ coordinates: coords, address: addr });
  }, [onChange]);

  /* ── GPS ──────────────────────────────────────────────────── */
  const handleGps = () => {
    if (!('geolocation' in navigator)) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setGpsPos(c);
        setGpsLoading(false);
        handlePositionChange(c);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  /* ── Recherche ────────────────────────────────────────────── */
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchInput = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchRes([]); setSearchOpen(false); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const res = await searchAddress(q, 5);
      setSearchRes(res);
      setSearchOpen(res.length > 0);
    }, 500);
  };

  const selectResult = (r: NominatimResult) => {
    setSearchQuery(r.displayName ?? r.ville ?? '');
    setSearchOpen(false);
    handlePositionChange({ latitude: r.latitude, longitude: r.longitude });
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Barre de recherche */}
      {showSearch && (
        <div className="loc-search-bar">
          <i className="fas fa-magnifying-glass loc-search-bar__icon" />
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={e => handleSearchInput(e.target.value)}
            onFocus={() => searchRes.length > 0 && setSearchOpen(true)}
          />
          {searchOpen && searchRes.length > 0 && (
            <div className="loc-search-results">
              {searchRes.map((r, i) => (
                <div key={i} className="loc-search-result" onClick={() => selectResult(r)}>
                  <strong>{r.ville ?? r.commune ?? 'Localisation'}</strong>
                  <span>{r.displayName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bouton GPS */}
      {showGpsButton && (
        <button
          type="button"
          className="loc-gps-btn"
          style={{ marginBottom: 10, width: '100%' }}
          onClick={handleGps}
          disabled={gpsLoading}
        >
          <i className={`fas ${gpsLoading ? 'fa-circle-notch loading' : 'fa-location-dot'}`} />
          {gpsLoading ? 'Localisation…' : 'Ma position actuelle'}
        </button>
      )}

      {/* Carte */}
      <div className={`loc-map-container${darkMode ? ' dark' : ''}`} style={{ height }}>
        <MapContainer
          center={[position.latitude, position.longitude]}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
          <ZoomControl position="bottomright" />
          <FlyTo center={position} />
          <ClickHandler onClick={handlePositionChange} />
          <DraggableMarker position={position} onDragEnd={handlePositionChange} />
          {gpsPos && <L.Marker position={[gpsPos.latitude, gpsPos.longitude]} icon={GPS_ICON} />}
        </MapContainer>
      </div>

      {/* Infos adresse */}
      {(value?.address || revLoading) && (
        <div style={{
          marginTop: 10, padding: '10px 14px',
          background: 'var(--sky-2, #f0f4ff)', borderRadius: 8,
          fontSize: 12.5, color: 'var(--t2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className="fas fa-location-dot" style={{ color: 'var(--blue)' }} />
          {revLoading
            ? 'Récupération de l\'adresse…'
            : value?.address?.displayName ?? `${value?.coordinates?.latitude?.toFixed(5)}, ${value?.coordinates?.longitude?.toFixed(5)}`
          }
        </div>
      )}

      {/* Coordonnées */}
      <div style={{
        marginTop: 8, display: 'flex', gap: 10,
        fontSize: 11.5, color: 'var(--t3)',
      }}>
        <span>Lat : {position.latitude.toFixed(6)}</span>
        <span>Lng : {position.longitude.toFixed(6)}</span>
      </div>
    </div>
  );
}

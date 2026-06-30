/* ============================================================
 * FICHIER : src/shared/location/index.ts
 * RÔLE    : Point d'entrée unique du module location.
 *           Importer depuis '@/shared/location' ou
 *           '../../../shared/location'.
 * ============================================================ */

// ── Types ───────────────────────────────────────────────────
export * from './types/location.types';

// ── Utils ───────────────────────────────────────────────────
export * from './utils/geoUtils';
export * from './utils/nominatim';

// ── Hooks ───────────────────────────────────────────────────
export { useGeolocation }           from './hooks/useGeolocation';
export { useReverseGeocode, useAddressSearch } from './hooks/useNominatim';
export { useLivreurSharing, useTrackDelivery } from './hooks/useLocationSocket';

// ── Components ──────────────────────────────────────────────
export { default as LocationMap }           from './components/LocationMap';
export { default as LocationPicker }        from './components/LocationPicker';
export { default as AddressCard }           from './components/AddressCard';
export { default as AddressForm }           from './components/AddressForm';
export { default as DeliveryTrackingMap }   from './components/DeliveryTrackingMap';
export { default as RoutePolyline }         from './components/RoutePolyline';
export { default as TrackingPanel }         from './components/TrackingPanel';
export { default as OrderTrackingMap }      from './components/OrderTrackingMap';
export { createCustomIcon, GPS_ICON }       from './components/LocationMap';

// ── Tracking API & Hooks ─────────────────────────────────────
export { fetchOrderTracking, fetchRoute }   from './services/routingApi';
export { useOrderTracking }                 from './hooks/useOrderTracking';

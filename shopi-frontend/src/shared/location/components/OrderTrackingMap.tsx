/* ============================================================
 * FICHIER : src/shared/location/components/OrderTrackingMap.tsx
 *
 * RÔLE : Composant de suivi complet d'une commande.
 *        - Carte OpenStreetMap avec 3 marqueurs (vendeur/livreur/client)
 *        - Itinéraire tracé via OpenRouteService
 *        - Mise à jour temps réel du livreur via Socket.IO
 *        - Panneau d'informations (distance, durée, ETA, vitesse)
 *
 * USAGE :
 *   <OrderTrackingMap orderId="uuid-commande" height="500px" />
 * ============================================================ */

import { lazy, Suspense }                          from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/location.css';

import { useOrderTracking }    from '../hooks/useOrderTracking';
import { useTrackDelivery }    from '../hooks/useLocationSocket';
import TrackingPanel           from './TrackingPanel';
import { DEFAULT_CENTER, OSM_TILE, DARK_TILE } from '../utils/geoUtils';

/* Lazy-load RoutePolyline (dépend de react-leaflet Polyline) */
const RoutePolyline = lazy(() => import('./RoutePolyline'));

/* ── Fix icônes Leaflet avec Vite ─────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── Icônes personnalisées ─────────────────────────────────── */
function makeIcon(emoji: string, color: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:44px; height:44px; border-radius:50% 50% 50% 0;
        transform:rotate(-45deg); background:${color};
        border:3px solid #fff; box-shadow:0 3px 10px rgba(0,0,0,.25);
        display:flex; align-items:center; justify-content:center;
      ">
        <span style="transform:rotate(45deg); font-size:20px; line-height:1">${emoji}</span>
      </div>`,
    iconSize:    [44, 44],
    iconAnchor:  [22, 44],
    popupAnchor: [0, -46],
  });
}

const VENDOR_ICON   = makeIcon('🏪', '#047857');
const DELIVERY_ICON = makeIcon('🛵', '#1A4FC4');
const CLIENT_ICON   = makeIcon('🏠', '#7C3AED');

const ROLE_ICONS = {
  vendor:   VENDOR_ICON,
  delivery: DELIVERY_ICON,
  client:   CLIENT_ICON,
};

/* ── Props ────────────────────────────────────────────────── */
interface Props {
  orderId:   string;
  height?:   string;
  darkMode?: boolean;
  showPanel?: boolean;   // afficher le panneau d'info à droite/dessous
}

/* ── Composant principal ──────────────────────────────────── */
export default function OrderTrackingMap({
  orderId,
  height    = '480px',
  darkMode  = false,
  showPanel = true,
}: Props) {
  const {
    actors, route, numero, status,
    loading, error, deliveryLive, refresh,
  } = useOrderTracking(orderId);

  /* Postion live du livreur (pour le panneau vitesse) */
  const deliveryId = actors.find(a => a.role === 'delivery')?.id ?? null;
  const { position: livePos } = useTrackDelivery(deliveryId);

  /* Centre de la carte : 1er acteur disponible ou Conakry */
  const mapCenter = actors.length > 0
    ? { lat: actors[0].lat, lng: actors[0].lng }
    : { lat: DEFAULT_CENTER.latitude, lng: DEFAULT_CENTER.longitude };

  const tile = darkMode ? DARK_TILE : OSM_TILE;

  /* ── États de chargement / erreur ─────────────────────── */
  if (loading) return (
    <div style={centeredState}>
      <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28, color: '#1A4FC4', marginBottom: 10 }} />
      <div style={{ color: '#475569', fontSize: 13 }}>Chargement du suivi…</div>
    </div>
  );

  if (error) return (
    <div style={centeredState}>
      <i className="fas fa-triangle-exclamation" style={{ fontSize: 28, color: '#EF4444', marginBottom: 10 }} />
      <div style={{ color: '#475569', fontSize: 13, marginBottom: 14 }}>{error}</div>
      <button onClick={refresh} style={retryBtn}>
        <i className="fas fa-rotate-right" /> Réessayer
      </button>
    </div>
  );

  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: showPanel ? '1fr 320px' : '1fr',
      gap:                 16,
      alignItems:          'start',
    }}>

      {/* ── Carte ─────────────────────────────────────────── */}
      <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.10)', position: 'relative' }}>

        {/* Badge statut temps réel */}
        {deliveryLive && (
          <div style={{
            position:     'absolute', top: 12, left: 12, zIndex: 500,
            background:   '#065F46', color: '#fff',
            padding:      '4px 12px', borderRadius: 20,
            fontSize:     11, fontWeight: 700,
            display:      'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', animation: 'locPulsGreen 2s infinite' }} />
            Suivi en direct
          </div>
        )}

        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={13}
          style={{ height, width: '100%' }}
          scrollWheelZoom
          zoomControl={false}
        >
          <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
          <ZoomControl position="bottomright" />

          {/* Marqueurs des acteurs */}
          {actors.map(actor => {
            /* Le livreur utilise sa position live si disponible */
            const lat = (actor.role === 'delivery' && livePos)
              ? livePos.latitude  : actor.lat;
            const lng = (actor.role === 'delivery' && livePos)
              ? livePos.longitude : actor.lng;

            return (
              <Marker
                key={actor.id}
                position={[lat, lng]}
                icon={ROLE_ICONS[actor.role]}
              >
                <Popup className="loc-popup">
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{actor.name}</div>
                  {actor.address && (
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>{actor.address}</div>
                  )}
                  {actor.role === 'delivery' && livePos?.vitesseKmh != null && (
                    <div style={{ fontSize: 11.5, color: '#1A4FC4', marginTop: 4 }}>
                      <i className="fas fa-gauge-high" /> {livePos.vitesseKmh.toFixed(0)} km/h
                    </div>
                  )}
                </Popup>
              </Marker>
            );
          })}

          {/* Itinéraire */}
          {route && (
            <Suspense fallback={null}>
              <RoutePolyline route={route} fitBounds={actors.length >= 2} />
            </Suspense>
          )}
        </MapContainer>

        {/* Légende fournisseur de route */}
        {route && (
          <div style={{
            position:   'absolute', bottom: 10, left: 10, zIndex: 400,
            background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)',
            borderRadius: 8, padding: '4px 10px',
            fontSize: 10, color: '#64748B', fontWeight: 600,
            border: '1px solid rgba(0,0,0,.07)',
          }}>
            {route.provider === 'openrouteservice'
              ? <><i className="fas fa-route" style={{ color: '#1A4FC4' }} /> OpenRouteService</>
              : <><i className="fas fa-minus" style={{ color: '#94A3B8' }} /> Ligne droite</>
            }
          </div>
        )}

        {/* Animation CSS */}
        <style>{`
          @keyframes locPulsGreen {
            0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,.5); }
            50%       { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
          }
        `}</style>
      </div>

      {/* ── Panneau d'info ────────────────────────────────── */}
      {showPanel && (
        <TrackingPanel
          actors={actors}
          route={route}
          livePosition={livePos}
          numero={numero}
          status={status}
          deliveryLive={deliveryLive}
        />
      )}
    </div>
  );
}

/* ── Styles constants ── */
const centeredState: React.CSSProperties = {
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  justifyContent: 'center',
  height:         240,
  background:     '#F8FAFF',
  borderRadius:   14,
  border:         '1px solid #E2E8F0',
  textAlign:      'center',
};

const retryBtn: React.CSSProperties = {
  padding:      '8px 20px',
  borderRadius: 9,
  border:       'none',
  background:   '#1A4FC4',
  color:        '#fff',
  fontSize:     13,
  fontWeight:   700,
  cursor:       'pointer',
  display:      'flex',
  alignItems:   'center',
  gap:          7,
};

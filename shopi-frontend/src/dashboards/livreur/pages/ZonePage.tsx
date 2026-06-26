/* ============================================================
 * FICHIER : src/dashboards/livreur/pages/ZonePage.tsx
 * RÔLE    : Page zone du livreur avec :
 *           - Carte interactive de sa zone
 *           - Bouton de partage de position temps réel
 *           - Statistiques par zone (inchangées)
 * ============================================================ */
import { useState, lazy, Suspense } from 'react';
import shared from '../styles/Shared.module.css';
import { useLivreurSharing } from '../../../shared/location/hooks/useLocationSocket';
import '../../../shared/location/styles/location.css';

// Lazy-load pour ne pas alourdir le bundle initial
const LocationMap = lazy(() => import('../../../shared/location/components/LocationMap'));

interface Props { onPop: (m: string, t?: string) => void; }

const ZONES      = ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto'];
const ZONE_STATS = [
  { z: 'Kaloum', nb: 18, c: 'var(--teal)',    pct: 43 },
  { z: 'Ratoma', nb: 12, c: 'var(--blue)',    pct: 29 },
  { z: 'Dixinn', nb: 8,  c: 'var(--emerald)', pct: 19 },
  { z: 'Matam',  nb: 4,  c: 'var(--amber)',   pct: 9  },
];

export default function ZonePage({ onPop }: Props) {
  const [activeZones, setActiveZones] = useState([0, 1, 2, 3]);

  const {
    sharing,
    position,
    startSharing,
    stopSharing,
  } = useLivreurSharing({
    onError: msg => onPop(`❌ ${msg}`, 'e'),
  });

  const toggleZone = (i: number) => {
    setActiveZones(a => a.includes(i) ? a.filter(x => x !== i) : [...a, i]);
    onPop(`📍 Zone ${ZONES[i]} ${activeZones.includes(i) ? 'désactivée' : 'activée'}`, 'i');
  };

  const handleToggleSharing = () => {
    if (sharing) {
      stopSharing();
      onPop('⏹ Partage de position arrêté.', 'i');
    } else {
      startSharing();
      onPop('📍 Partage de position démarré.', 's');
    }
  };

  const mapCenter = position
    ? { latitude: position.latitude, longitude: position.longitude }
    : { latitude: 9.5370, longitude: -13.6773 };  // Conakry par défaut

  const mapMarkers = position ? [{
    id:       'me',
    position: { latitude: position.latitude, longitude: position.longitude },
    color:    'green'  as const,
    emoji:    '🛵',
    popupContent: <div style={{ fontWeight: 700, fontSize: 13 }}>Ma position</div>,
  }] : [];

  return (
    <div className={shared.page}>
      <div className={shared.g2}>

        {/* ── Carte + Partage ──────────────────────────────── */}
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}>
            <div className={shared.chT}>
              <i className="fas fa-map-location-dot" /> Ma position en temps réel
            </div>
          </div>
          <div className={shared.cb}>

            {/* Toggle partage */}
            <div className={`loc-sharing-toggle${sharing ? ' active' : ''}`}>
              <div className="loc-sharing-label">
                <div className={`loc-sharing-dot${sharing ? ' active' : ''}`} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: sharing ? '#047857' : 'var(--navy)' }}>
                    {sharing ? 'Partage actif' : 'Partage désactivé'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 2 }}>
                    {sharing
                      ? 'Les boutiques et clients voient votre position'
                      : 'Activez pour être visible sur la carte'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleToggleSharing}
                style={{
                  padding:      '8px 18px',
                  borderRadius: 20,
                  border:       'none',
                  background:   sharing ? '#dc2626' : '#047857',
                  color:        '#fff',
                  fontSize:     13,
                  fontWeight:   700,
                  cursor:       'pointer',
                  transition:   'background .15s',
                }}
              >
                {sharing ? '⏹ Arrêter' : '▶ Partager'}
              </button>
            </div>

            {/* Carte */}
            <Suspense fallback={
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sky-2)', borderRadius: 12 }}>
                <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--blue)', fontSize: 24 }} />
              </div>
            }>
              <LocationMap
                center={mapCenter}
                zoom={position ? 15 : 12}
                height="280px"
                markers={mapMarkers}
                showGpsMarker={position ?? null}
              />
            </Suspense>

            {/* Coordonnées actuelles */}
            {position && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--t2)', display: 'flex', gap: 16 }}>
                <span>Lat : {position.latitude.toFixed(5)}</span>
                <span>Lng : {position.longitude.toFixed(5)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Zones actives ────────────────────────────────── */}
        <div>
          <div className={`${shared.card}`} style={{ marginBottom: 16 }}>
            <div className={shared.ch}>
              <div className={shared.chT}><i className="fas fa-location-dot" /> Zones de livraison</div>
            </div>
            <div className={shared.cb}>
              <div style={{
                background: 'linear-gradient(135deg,var(--sky),var(--sky-2))',
                border: '1.5px solid var(--sky-3)',
                borderRadius: 'var(--r-lg)',
                padding: 16,
                textAlign: 'center',
                marginBottom: 14,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
                  🗺️ Zone active · Conakry
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {ZONES.filter((_, i) => activeZones.includes(i)).map(z => (
                    <span key={z} style={{
                      background: 'var(--white)', color: 'var(--navy)',
                      fontSize: 11, fontWeight: 700, padding: '5px 12px',
                      borderRadius: 'var(--pill)', border: '1px solid var(--sky-3)',
                    }}>
                      📍 {z}
                    </span>
                  ))}
                </div>
              </div>

              {ZONES.map((z, i) => (
                <div key={z} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: i < ZONES.length - 1 ? '1px solid var(--bdr)' : 'none',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <i className="fas fa-location-dot" style={{ color: 'var(--teal)' }} /> {z}
                  </span>
                  <label className={shared.tog}>
                    <input type="checkbox" checked={activeZones.includes(i)} onChange={() => toggleZone(i)} />
                    <span className={shared.togs} />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Statistiques */}
          <div className={`${shared.card} ${shared.cardLast}`}>
            <div className={shared.ch}>
              <div className={shared.chT}><i className="fas fa-chart-bar" /> Statistiques par zone</div>
            </div>
            <div className={shared.cb}>
              {ZONE_STATS.map((s, i) => (
                <div key={i} style={{ marginBottom: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, color: 'var(--navy)' }}>📍 {s.z}</span>
                    <span style={{ fontWeight: 700, color: s.c }}>{s.nb} livr. · {s.pct}%</span>
                  </div>
                  <div style={{ background: 'var(--g100)', borderRadius: 'var(--pill)', height: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${s.pct}%`, height: '100%', background: s.c, borderRadius: 'var(--pill)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

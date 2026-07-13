/* ============================================================
 * FICHIER : src/dashboards/livreur/pages/ZonePage.tsx
 * RÔLE    : Affiche les zones choisies par le livreur (lecture seule)
 *           + carte temps réel + statistiques par zone
 * ============================================================ */
import { useState, useEffect, lazy, Suspense } from 'react';
import shared from '../styles/Shared.module.css';
import { useLivreurSharing } from '../../../shared/location/hooks/useLocationSocket';
import { apiFetch } from '../../../shared/services/apiFetch';
import { DELIVERY_TYPES, GUINEA_ZONE_COORDS } from '../data/parametresData';
import type { MarkerConfig } from '../../../shared/location/components/LocationMap';
import '../../../shared/location/styles/location.css';

const LocationMap = lazy(() => import('../../../shared/location/components/LocationMap'));

interface Props { onPop: (m: string, t?: string) => void; }

interface ZoneProfile {
  communesActives:  string[] | null;
  deliveryType:     string | null;
  zonesDisponibles: string[] | null;
}

interface GeoItemCoords {
  nom:       string;
  latitude:  number | null;
  longitude: number | null;
}

type CoordsMap = Record<string, [number, number]>;

function resolveCoords(items: GeoItemCoords[], fallback: CoordsMap): CoordsMap {
  const result: CoordsMap = {};
  items.forEach(item => {
    if (item.latitude != null && item.longitude != null) {
      result[item.nom] = [item.latitude, item.longitude];
    } else if (fallback[item.nom]) {
      result[item.nom] = fallback[item.nom];
    }
  });
  return result;
}

function computeMapView(
  markers: Array<{ position: { latitude: number; longitude: number } }>,
  gpsPos?: { latitude: number; longitude: number } | null,
): { center: { latitude: number; longitude: number }; zoom: number } {
  const defaultCenter = { latitude: 9.5370, longitude: -13.6773 };
  if (gpsPos) return { center: gpsPos, zoom: 12 };
  if (!markers.length) return { center: defaultCenter, zoom: 8 };
  const lats = markers.map(m => m.position.latitude);
  const lngs = markers.map(m => m.position.longitude);
  const center = {
    latitude:  (Math.max(...lats) + Math.min(...lats)) / 2,
    longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
  };
  const spread = Math.max(
    Math.abs(Math.max(...lats) - Math.min(...lats)),
    Math.abs(Math.max(...lngs) - Math.min(...lngs)),
  );
  const zoom = spread < 0.05 ? 14 : spread < 0.3 ? 12 : spread < 1 ? 10 : spread < 4 ? 8 : 7;
  return { center, zoom };
}

const STAT_COLORS = [
  'var(--teal)', 'var(--blue)', 'var(--emerald)',
  'var(--amber)', 'var(--red)', 'var(--purple, #7c3aed)',
];

/* Génère des stats fictives pour les zones actives */
function buildStats(zones: string[]) {
  const total = zones.length;
  if (!total) return [];
  const base = Math.floor(100 / total);
  return zones.map((z, i) => ({
    z,
    nb:  Math.max(1, Math.round((total - i) * 8 + Math.random() * 3)),
    pct: i === total - 1 ? 100 - base * (total - 1) : base,
    c:   STAT_COLORS[i % STAT_COLORS.length],
  }));
}

export default function ZonePage({ onPop }: Props) {
  const [profile,      setProfile]      = useState<ZoneProfile | null>(null);
  const [loadingZone,  setLoadingZone]  = useState(true);
  const [disponibles,  setDisponibles]  = useState<string[]>([]);
  const [savingDispo,  setSavingDispo]  = useState(false);
  const [coordsMap,    setCoordsMap]    = useState<CoordsMap>({});

  const { sharing, position, startSharing, stopSharing } = useLivreurSharing({
    onError: msg => onPop(`❌ ${msg}`, 'e'),
  });

  useEffect(() => {
    apiFetch<ZoneProfile>('/dashboard/livreur/parametres')
      .then(d => {
        setProfile(d);
        const zones    = d.communesActives ?? [];
        const saved    = d.zonesDisponibles;
        /* Si jamais initialisé → toutes les zones sont disponibles par défaut */
        setDisponibles(saved !== null ? saved : zones);
      })
      .catch(() => onPop('Impossible de charger les zones.', 'e'))
      .finally(() => setLoadingZone(false));
  }, []);

  /* Coords : dès que le profil arrive, on remplit depuis le dict local.
     Si l'admin a entré des coords en DB, on les surcharge ensuite via l'API. */
  useEffect(() => {
    if (!profile) return;
    const zones = profile.communesActives ?? [];

    // Étape 1 — immédiat, dict local (couvre 100% des cas courants)
    const local: CoordsMap = {};
    zones.forEach(z => { if (GUINEA_ZONE_COORDS[z]) local[z] = GUINEA_ZONE_COORDS[z]; });
    setCoordsMap(local);

    // Étape 2 — optionnel, amélioration via coords DB si le type est défini
    const conf = DELIVERY_TYPES.find(t => t.key === profile.deliveryType);
    if (!conf) return;
    apiFetch<GeoItemCoords[]>(`/geo/items?niveau=${conf.niveau}`)
      .then(items => {
        const fromApi: CoordsMap = {};
        (items ?? []).forEach(item => {
          if (item.latitude != null && item.longitude != null) {
            fromApi[item.nom] = [item.latitude, item.longitude];
          }
        });
        // On ne surcharge que les zones qui ont de vraies coords en DB
        if (Object.keys(fromApi).length) setCoordsMap(prev => ({ ...prev, ...fromApi }));
      })
      .catch(() => {}); // local dict déjà appliqué, on garde
  }, [profile]);

  async function toggleDispo(zone: string) {
    const next = disponibles.includes(zone)
      ? disponibles.filter(z => z !== zone)
      : [...disponibles, zone];

    setDisponibles(next);          // optimiste
    setSavingDispo(true);
    try {
      await apiFetch('/dashboard/livreur/parametres/zones-dispo', {
        method: 'PATCH',
        body:   { zonesDisponibles: next },
      });
      onPop(
        next.includes(zone)
          ? `✅ Disponible sur ${zone}`
          : `⏸ Non disponible sur ${zone}`,
        'i',
      );
    } catch {
      setDisponibles(disponibles); // rollback
      onPop(`❌ Impossible de mettre à jour la disponibilité`, 'e');
    } finally {
      setSavingDispo(false);
    }
  }

  const handleToggleSharing = () => {
    if (sharing) { stopSharing(); onPop('⏹ Partage de position arrêté.', 'i'); }
    else         { startSharing(); onPop('📍 Partage de position démarré.', 's'); }
  };


  const zones    = profile?.communesActives ?? [];
  const typeConf = DELIVERY_TYPES.find(t => t.key === profile?.deliveryType);
  const stats    = buildStats(disponibles);

  /* ── Marqueurs bleus des zones choisies ── */
  const zoneMarkers: MarkerConfig[] = zones
    .filter(z => coordsMap[z])
    .map(z => ({
      id:       `zone-${z}`,
      position: { latitude: coordsMap[z][0], longitude: coordsMap[z][1] },
      color:    'blue' as const,
      emoji:    typeConf?.em ?? '📍',
      popupContent: (
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <strong>{z}</strong><br />
          <span style={{ color: disponibles.includes(z) ? '#047857' : '#6b7280' }}>
            {disponibles.includes(z) ? '✅ Disponible' : '⏸ Non disponible'}
          </span>
        </div>
      ),
    }));

  const allMarkers = [...(position ? [{ id:'me', position:{ latitude:position.latitude, longitude:position.longitude }, color:'green' as const, emoji:'🛵', popupContent:<div style={{fontWeight:700,fontSize:13}}>Ma position</div> }] : []), ...zoneMarkers];
  const { center: mapCenter, zoom: mapZoom } = computeMapView(zoneMarkers, position ?? null);

  return (
    <div className={shared.page}>
      <div className={shared.g2}>

        {/* ── Carte + Partage ─────────────────────────────── */}
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}>
            <div className={shared.chT}>
              <i className="fas fa-map-location-dot" /> Ma position en temps réel
            </div>
          </div>
          <div className={shared.cb}>
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
                  padding: '8px 18px', borderRadius: 20, border: 'none',
                  background: sharing ? '#dc2626' : '#047857',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  transition: 'background .15s',
                }}
              >
                {sharing ? '⏹ Arrêter' : '▶ Partager'}
              </button>
            </div>

            <Suspense fallback={
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sky-2)', borderRadius: 12 }}>
                <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--blue)', fontSize: 24 }} />
              </div>
            }>
              <LocationMap
                center={mapCenter}
                zoom={mapZoom}
                height="280px"
                markers={allMarkers}
                showGpsMarker={position ?? null}
              />
            </Suspense>

            {position && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--t2)', display: 'flex', gap: 16 }}>
                <span>Lat : {position.latitude.toFixed(5)}</span>
                <span>Lng : {position.longitude.toFixed(5)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Zones + Stats ──────────────────────────────── */}
        <div>
          <div className={shared.card} style={{ marginBottom: 16 }}>
            <div className={shared.ch}>
              <div className={shared.chT}><i className="fas fa-location-dot" /> Mes zones de livraison</div>
              {!loadingZone && zones.length > 0 && (
                <span style={{
                  fontSize: 11, background: 'var(--tl-bg)', color: 'var(--teal)',
                  padding: '3px 10px', borderRadius: 'var(--pill)', fontWeight: 700,
                }}>
                  {disponibles.length}/{zones.length} disponible{disponibles.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className={shared.cb}>

              {loadingZone ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '28px 0', color: 'var(--t3)', fontSize: 13 }}>
                  <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--teal)', fontSize: 16 }} />
                  Chargement des zones…
                </div>

              ) : zones.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 0', color: 'var(--t3)', textAlign: 'center' }}>
                  <i className="fas fa-map-pin" style={{ fontSize: 28, opacity: .3 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>Aucune zone configurée</div>
                  <div style={{ fontSize: 11.5 }}>Rendez-vous dans <strong>Paramètres → Zones</strong> pour définir votre périmètre.</div>
                </div>

              ) : (
                <>
                  {/* Badge type de livraison */}
                  {typeConf && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '6px 14px', marginBottom: 14,
                      background: 'var(--tl-bg)',
                      border: '1.5px solid rgba(14,116,144,.2)',
                      borderRadius: 'var(--pill)', fontSize: 12.5, fontWeight: 700, color: 'var(--teal)',
                    }}>
                      <span>{typeConf.em}</span>
                      <span>{typeConf.label}</span>
                    </div>
                  )}

                  {/* Chips des zones */}
                  <div style={{
                    background: 'linear-gradient(135deg,var(--sky),var(--sky-2))',
                    border: '1.5px solid var(--sky-3)',
                    borderRadius: 'var(--r-lg)',
                    padding: 16,
                    marginBottom: 14,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', marginBottom: 10, textAlign: 'center' }}>
                      🗺️ {typeConf ? typeConf.label : 'Zones actives'}
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {zones.map(z => {
                        const isDispo = disponibles.includes(z);
                        return (
                          <span key={z} style={{
                            background: isDispo ? 'var(--white)' : 'rgba(0,0,0,.04)',
                            color: isDispo ? 'var(--navy)' : 'var(--t3)',
                            fontSize: 11, fontWeight: 700, padding: '5px 12px',
                            borderRadius: 'var(--pill)',
                            border: `1px solid ${isDispo ? 'var(--sky-3)' : 'transparent'}`,
                            display: 'flex', alignItems: 'center', gap: 5,
                            opacity: isDispo ? 1 : 0.55,
                            transition: 'opacity .2s',
                          }}>
                            <i className="fas fa-location-dot" style={{ color: isDispo ? 'var(--teal)' : 'var(--t4)', fontSize: 9 }} />
                            {z}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Liste des zones avec toggle disponibilité */}
                  {zones.map((z, i) => {
                    const isDispo = disponibles.includes(z);
                    return (
                      <div key={z} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 0',
                        borderBottom: i < zones.length - 1 ? '1px solid var(--bdr)' : 'none',
                        opacity: savingDispo ? 0.7 : 1,
                        transition: 'opacity .15s',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: isDispo ? 'var(--tl-bg)' : 'var(--g100)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, transition: 'background .2s',
                        }}>
                          {typeConf?.em ?? '📍'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isDispo ? 'var(--navy)' : 'var(--t3)' }}>{z}</div>
                          <div style={{ fontSize: 11, marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                              background: isDispo ? 'var(--teal)' : 'var(--t4)',
                              transition: 'background .2s',
                            }} />
                            <span style={{ color: isDispo ? 'var(--teal)' : 'var(--t4)', fontWeight: 600 }}>
                              {isDispo ? 'Disponible' : 'Non disponible'}
                            </span>
                          </div>
                        </div>
                        <label className={shared.tog} style={{ cursor: savingDispo ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isDispo}
                            disabled={savingDispo}
                            onChange={() => toggleDispo(z)}
                          />
                          <span className={shared.togs} />
                        </label>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Statistiques */}
          {zones.length > 0 && (
            <div className={`${shared.card} ${shared.cardLast}`}>
              <div className={shared.ch}>
                <div className={shared.chT}><i className="fas fa-chart-bar" /> Statistiques par zone</div>
              </div>
              <div className={shared.cb}>
                {stats.map((s, i) => (
                  <div key={i} style={{ marginBottom: i < stats.length - 1 ? 13 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="fas fa-location-dot" style={{ color: s.c, fontSize: 10 }} />
                        {s.z}
                      </span>
                      <span style={{ fontWeight: 700, color: s.c }}>{s.nb} livr. · {s.pct}%</span>
                    </div>
                    <div style={{ background: 'var(--g100)', borderRadius: 'var(--pill)', height: 7, overflow: 'hidden' }}>
                      <div style={{ width: `${s.pct}%`, height: '100%', background: s.c, borderRadius: 'var(--pill)', transition: 'width .6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

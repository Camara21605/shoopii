/* ============================================================
 * FICHIER : src/dashboards/livreur/pages/ZonePage.tsx
 * RÔLE    : Affiche les zones choisies par le livreur (lecture seule)
 *           + carte temps réel + statistiques par zone
 * ============================================================ */
import { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import shared from '../styles/Shared.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import { buildDeliveryTypes, GUINEA_ZONE_COORDS } from '../data/parametresData';
import type { MapMissionState } from '../data/livreurData';
import type { MarkerConfig } from '../../../shared/location/components/LocationMap';
import '../../../shared/location/styles/location.css';

const LocationMap = lazy(() => import('../../../shared/location/components/LocationMap'));

interface Props {
  onPop: (m: string, t?: string) => void;
  /* Partage de position — géré au niveau LivreurApp pour persister
   * entre les pages (voir LivreurApp.tsx). */
  sharing:          boolean;
  position:         { latitude: number; longitude: number } | null;
  hasActiveMission: boolean;
  startSharing:     () => void;
  stopSharing:      () => void;
}

/** Résout la commune de livraison vers des coordonnées approximatives
 *  (même dictionnaire que les zones — pas de géocodage précis pour le client). */
function resolveClientCoords(commune: string | null): [number, number] | null {
  if (!commune) return null;
  if (GUINEA_ZONE_COORDS[commune]) return GUINEA_ZONE_COORDS[commune];
  const key = Object.keys(GUINEA_ZONE_COORDS).find(k => commune.toLowerCase().startsWith(k.toLowerCase()));
  return key ? GUINEA_ZONE_COORDS[key] : null;
}

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
  'var(--amber)', 'var(--red)', 'var(--purple, #000000)',
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

export default function ZonePage({ onPop, sharing, position, hasActiveMission, startSharing, stopSharing }: Props) {
  const { t } = useTranslation();
  const DELIVERY_TYPES = buildDeliveryTypes(t);
  const location = useLocation();
  const [profile,      setProfile]      = useState<ZoneProfile | null>(null);
  const [loadingZone,  setLoadingZone]  = useState(true);
  const [disponibles,  setDisponibles]  = useState<string[]>([]);
  const [savingDispo,  setSavingDispo]  = useState(false);
  const [coordsMap,    setCoordsMap]    = useState<CoordsMap>({});
  const [mapMission,   setMapMission]   = useState<MapMissionState | null>(
    (location.state as any)?.mapMission ?? null,
  );

  useEffect(() => {
    apiFetch<ZoneProfile>('/dashboard/livreur/parametres')
      .then(d => {
        setProfile(d);
        const zones    = d.communesActives ?? [];
        const saved    = d.zonesDisponibles;
        /* Si jamais initialisé → toutes les zones sont disponibles par défaut */
        setDisponibles(saved !== null ? saved : zones);
      })
      .catch(() => onPop(t('livreurZone.zones.loadError'), 'e'))
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
          ? t('livreurZone.zones.dispoOnToast', { zone })
          : t('livreurZone.zones.dispoOffToast', { zone }),
        'i',
      );
    } catch {
      setDisponibles(disponibles); // rollback
      onPop(t('livreurZone.zones.dispoUpdateError'), 'e');
    } finally {
      setSavingDispo(false);
    }
  }

  const handleToggleSharing = () => {
    /* Sécurité : impossible d'arrêter le partage tant qu'une livraison est
     * en cours — le bouton "Arrêter" est déjà masqué dans ce cas (voir le
     * rendu ci-dessous), mais on verrouille aussi la fonction elle-même
     * pour ne jamais dépendre uniquement de l'UI. */
    if (sharing) {
      if (hasActiveMission) { onPop(t('livreurZone.sharing.cantStopToast'), 'w'); return; }
      stopSharing();
      onPop(t('livreurZone.sharing.stoppedToast'), 'i');
    } else {
      startSharing();
      onPop(t('livreurZone.sharing.startedToast'), 's');
    }
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
          <span style={{ color: disponibles.includes(z) ? '#000000' : '#6b7280' }}>
            {disponibles.includes(z) ? `✅ ${t('livreurZone.zones.available')}` : `⏸ ${t('livreurZone.zones.unavailable')}`}
          </span>
        </div>
      ),
    }));

  /* ── Marqueurs de la mission sélectionnée via le bouton "Carte" ── */
  const missionMarkers: MarkerConfig[] = [];
  if (mapMission) {
    if (mapMission.companyLat != null && mapMission.companyLng != null) {
      missionMarkers.push({
        id:       `mission-shop-${mapMission.id}`,
        position: { latitude: mapMission.companyLat, longitude: mapMission.companyLng },
        color:    'orange' as const,
        emoji:    '🏪',
        popupContent: (
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <strong>{mapMission.shop}</strong><br />
            <span style={{ color: '#6b7280' }}>{t('livreurZone.missionAddr.boutiqueId', { id: mapMission.id })}</span>
          </div>
        ),
      });
    }
    /* Position réelle du client (adresse GPS enregistrée) si disponible ;
     * sinon repli sur le centre approximatif de sa commune — mieux vaut
     * une position approchée que pas de marqueur du tout. */
    const clientCoords: [number, number] | null =
      mapMission.clientLat != null && mapMission.clientLng != null
        ? [mapMission.clientLat, mapMission.clientLng]
        : resolveClientCoords(mapMission.clientCommune);
    const clientIsApprox = mapMission.clientLat == null || mapMission.clientLng == null;
    if (clientCoords) {
      missionMarkers.push({
        id:       `mission-client-${mapMission.id}`,
        position: { latitude: clientCoords[0], longitude: clientCoords[1] },
        color:    'red' as const,
        emoji:    '🏠',
        popupContent: (
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <strong>{mapMission.client}</strong><br />
            <span style={{ color: '#6b7280' }}>
              {mapMission.clientCommune}
              {clientIsApprox && t('livreurZone.missionAddr.positionApprox')}
            </span>
          </div>
        ),
      });
    }
  }

  const allMarkers = [...(position ? [{ id:'me', position:{ latitude:position.latitude, longitude:position.longitude }, color:'green' as const, emoji:'🛵', popupContent:<div style={{fontWeight:700,fontSize:13}}>{t('livreurZone.maPosition')}</div> }] : []), ...zoneMarkers, ...missionMarkers];
  const { center: mapCenter, zoom: mapZoom } = missionMarkers.length > 0
    ? computeMapView(missionMarkers, null)
    : computeMapView(zoneMarkers, position ?? null);

  return (
    <div className={shared.page}>
      <div className={shared.g2}>

        {/* ── Carte + Partage ─────────────────────────────── */}
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}>
            <div className={shared.chT}>
              <i className="fas fa-map-location-dot" /> {t('livreurZone.carteTitre')}
            </div>
          </div>
          <div className={shared.cb}>
            {mapMission && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--tl-bg)', border: '1.5px solid rgba(0,0,0,.2)',
                borderRadius: 'var(--r-lg)', padding: '10px 14px', marginBottom: 12,
              }}>
                <i className="fas fa-route" style={{ color: 'var(--teal)' }} />
                <div style={{ flex: 1, fontSize: 12.5 }}>
                  <strong style={{ color: 'var(--navy)' }}>{mapMission.id}</strong>
                  <span style={{ color: 'var(--t2)' }}> · 🏪 {mapMission.shop} → 🏠 {mapMission.client}</span>
                </div>
                <button
                  onClick={() => setMapMission(null)}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--t3)',
                    cursor: 'pointer', fontSize: 13, padding: 4,
                  }}
                  title={t('livreurZone.fermer')}
                >
                  <i className="fas fa-xmark" />
                </button>
              </div>
            )}
            <div className={`loc-sharing-toggle${sharing ? ' active' : ''}`}>
              <div className="loc-sharing-label">
                <div className={`loc-sharing-dot${sharing ? ' active' : ''}`} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: sharing ? '#000000' : 'var(--t3)' }}>
                    {hasActiveMission
                      ? t('livreurZone.sharing.autoTitle')
                      : sharing ? t('livreurZone.sharing.activeTitle') : t('livreurZone.sharing.offTitle')}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 2 }}>
                    {hasActiveMission
                      ? t('livreurZone.sharing.autoSub')
                      : sharing
                        ? t('livreurZone.sharing.activeSub')
                        : t('livreurZone.sharing.offSub')}
                  </div>
                </div>
              </div>
              {!hasActiveMission && (
                <button
                  onClick={handleToggleSharing}
                  style={{
                    padding: '8px 18px', borderRadius: 20, border: sharing ? 'none' : '1.5px solid #000',
                    background: sharing ? '#000000' : 'transparent',
                    color: sharing ? '#fff' : '#000000', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    transition: 'background .15s',
                  }}
                >
                  {sharing ? t('livreurZone.sharing.stop') : t('livreurZone.sharing.start')}
                </button>
              )}
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
                <span>{t('livreurZone.lat')} {position.latitude.toFixed(5)}</span>
                <span>{t('livreurZone.lng')} {position.longitude.toFixed(5)}</span>
              </div>
            )}

            {/* ── Adresses de la mission (même infos que sur la carte de mission) ── */}
            {mapMission && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                <div style={{
                  flex: '1 1 200px', background: 'var(--g50)', border: '1px solid var(--bdr)',
                  borderRadius: 'var(--r-lg)', padding: 14,
                }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🏪 {mapMission.shop}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>{t('livreurZone.missionAddr.pays')} <strong style={{ color: 'var(--navy)' }}>{mapMission.companyPays ?? '—'}</strong></span>
                    <span>{t('livreurZone.missionAddr.ville')} <strong style={{ color: 'var(--navy)' }}>{mapMission.companyVille ?? '—'}</strong></span>
                    <span>{t('livreurZone.missionAddr.quartier')} <strong style={{ color: 'var(--navy)' }}>{mapMission.companyQuartier ?? '—'}</strong></span>
                  </div>
                </div>
                <div style={{
                  flex: '1 1 200px', background: 'var(--g50)', border: '1px solid var(--bdr)',
                  borderRadius: 'var(--r-lg)', padding: 14,
                }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🏠 {mapMission.client}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>{t('livreurZone.missionAddr.pays')} <strong style={{ color: 'var(--navy)' }}>{mapMission.companyPays ?? '—'}</strong></span>
                    <span>{t('livreurZone.missionAddr.ville')} <strong style={{ color: 'var(--navy)' }}>{mapMission.clientVille ?? '—'}</strong></span>
                    <span>{t('livreurZone.missionAddr.quartier')} <strong style={{ color: 'var(--navy)' }}>{mapMission.clientCommune ?? '—'}</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Zones + Stats ──────────────────────────────── */}
        <div>
          <div className={shared.card} style={{ marginBottom: 16 }}>
            <div className={shared.ch}>
              <div className={shared.chT}><i className="fas fa-location-dot" /> {t('livreurZone.zones.title')}</div>
              {!loadingZone && zones.length > 0 && (
                <span style={{
                  fontSize: 11, background: 'var(--tl-bg)', color: 'var(--teal)',
                  padding: '3px 10px', borderRadius: 'var(--pill)', fontWeight: 700,
                }}>
                  {t('livreurZone.zones.dispoBadge', { dispo: disponibles.length, total: zones.length })}
                </span>
              )}
            </div>
            <div className={shared.cb}>

              {loadingZone ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '28px 0', color: 'var(--t3)', fontSize: 13 }}>
                  <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--teal)', fontSize: 16 }} />
                  {t('livreurZone.zones.loading')}
                </div>

              ) : zones.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 0', color: 'var(--t3)', textAlign: 'center' }}>
                  <i className="fas fa-map-pin" style={{ fontSize: 28, opacity: .3 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>{t('livreurZone.zones.noZonesTitle')}</div>
                  <div style={{ fontSize: 11.5 }}>{t('livreurZone.zones.noZonesPrefix')}<strong>{t('livreurZone.zones.noZonesBold')}</strong>{t('livreurZone.zones.noZonesSuffix')}</div>
                </div>

              ) : (
                <>
                  {/* Badge type de livraison */}
                  {typeConf && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '6px 14px', marginBottom: 14,
                      background: 'var(--tl-bg)',
                      border: '1.5px solid rgba(0,0,0,.2)',
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
                      🗺️ {typeConf ? typeConf.label : t('livreurZone.zones.activeFallback')}
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
                              {isDispo ? t('livreurZone.zones.available') : t('livreurZone.zones.unavailable')}
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
                <div className={shared.chT}><i className="fas fa-chart-bar" /> {t('livreurZone.stats.title')}</div>
              </div>
              <div className={shared.cb}>
                {stats.map((s, i) => (
                  <div key={i} style={{ marginBottom: i < stats.length - 1 ? 13 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="fas fa-location-dot" style={{ color: s.c, fontSize: 10 }} />
                        {s.z}
                      </span>
                      <span style={{ fontWeight: 700, color: s.c }}>{s.nb} {t('livreurBoutiques.livrAbrev')} · {s.pct}%</span>
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

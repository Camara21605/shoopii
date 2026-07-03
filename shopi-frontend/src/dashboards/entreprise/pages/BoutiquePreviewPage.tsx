/* ============================================================
 * FICHIER : BoutiquePreviewPage.tsx
 * ============================================================ */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useParametres } from '../hooks/useParametres';
import type { EntreprisePage } from '../types';
import {
  VILLES_SORTED, getCommunesByVille, getQuartiersByCommune, findVille,
} from '../../../shared/location/data/geo-guinee';
import { searchAddress } from '../../../shared/location/utils/nominatim';

/* ── Fix icônes Leaflet + Vite ── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* Marqueur bleu personnalisé */
const BLUE_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:36px;height:36px;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    background:#1A4FC4;border:3px solid #fff;
    box-shadow:0 3px 10px rgba(26,79,196,.5);
    display:flex;align-items:center;justify-content:center;">
    <span style="transform:rotate(45deg);font-size:16px">🏪</span>
  </div>`,
  iconSize:    [36, 36],
  iconAnchor:  [18, 36],
  popupAnchor: [0, -38],
});

interface Props { onNavigate: (page: EntreprisePage) => void; }
type Tab = 'apercu' | 'localisation';

const PAYS_LIST = [
  { code: 'GN', nom: 'Guinée',        emoji: '🇬🇳' },
  { code: 'SN', nom: 'Sénégal',       emoji: '🇸🇳' },
  { code: 'ML', nom: 'Mali',           emoji: '🇲🇱' },
  { code: 'CI', nom: "Côte d'Ivoire", emoji: '🇨🇮' },
  { code: 'GW', nom: 'Guinée-Bissau', emoji: '🇬🇼' },
  { code: 'LR', nom: 'Libéria',       emoji: '🇱🇷' },
  { code: 'SL', nom: 'Sierra Leone',  emoji: '🇸🇱' },
  { code: 'FR', nom: 'France',         emoji: '🇫🇷' },
];

const OSM_URL  = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const DEFAULT_LAT = 9.5370;
const DEFAULT_LNG = -13.6773;

/* ── Sous-composant : vol vers coordonnées ── */
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map    = useMap();
  const prevRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    if (!prev || prev.lat !== lat || prev.lng !== lng) {
      map.flyTo([lat, lng], 15, { duration: 0.8 });
      prevRef.current = { lat, lng };
    }
  }, [lat, lng, map]);
  return null;
}

/* ── Sous-composant : clic sur carte ── */
function ClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMove(e.latlng.lat, e.latlng.lng); } });
  return null;
}

/* ── Marqueur draggable ── */
function DraggableMarker({ lat, lng, onDragEnd }: { lat: number; lng: number; onDragEnd: (lt: number, ln: number) => void }) {
  const markerRef = useRef<L.Marker | null>(null);
  return (
    <Marker
      draggable
      position={[lat, lng]}
      icon={BLUE_ICON}
      ref={markerRef}
      eventHandlers={{ dragend() {
        const m = markerRef.current;
        if (m) { const p = m.getLatLng(); onDragEnd(p.lat, p.lng); }
      }}}
    />
  );
}

/* ── Styles ── */
const sel = (active = false): React.CSSProperties => ({
  width: '100%', padding: '10px 32px 10px 12px',
  border: `1.5px solid ${active ? '#1A4FC4' : '#CBD5E1'}`,
  borderRadius: 10,
  background: active ? '#EFF6FF' : '#fff',
  color: '#0B1F3A', fontSize: 13,
  fontFamily: '"DM Sans",sans-serif',
  outline: 'none', cursor: 'pointer', appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  transition: 'border-color .15s, background .15s',
});
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1.5px solid #CBD5E1', borderRadius: 10,
  background: '#fff', color: '#0B1F3A', fontSize: 13,
  fontFamily: '"DM Sans",sans-serif', outline: 'none',
  boxSizing: 'border-box' as const, transition: 'border-color .15s',
};
const fg: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };

/* ══════════════════════════════════════════════════════════════ */

export default function BoutiquePreviewPage({ onNavigate }: Props) {
  const { data, loading, saveContact } = useParametres();
  const [iframeKey,  setIframeKey]  = useState(0);
  const [activeTab,  setActiveTab]  = useState<Tab>('apercu');
  const [pays,       setPays]       = useState('GN');
  const [ville,      setVille]      = useState('');
  const [commune,    setCommune]    = useState('');
  const [quartier,   setQuartier]   = useState('');
  const [adresse,    setAdresse]    = useState('');
  const [repere,     setRepere]     = useState('');
  const [markerLat,  setMarkerLat]  = useState(DEFAULT_LAT);
  const [markerLng,  setMarkerLng]  = useState(DEFAULT_LNG);
  const [flyTarget,  setFlyTarget]  = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
  const [geocoding,  setGeocoding]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => { setIframeKey(k => k + 1); }, []);

  useEffect(() => {
    if (!data) return;
    setPays(data.pays      ?? 'GN');
    setVille(data.ville    ?? '');
    setCommune(data.commune ?? '');
    setQuartier((data as any).quartier ?? '');
    setAdresse(data.adresse ?? '');
    setRepere(data.repere   ?? '');
    if (data.latitude && data.longitude) {
      const lt = Number(data.latitude);
      const ln = Number(data.longitude);
      setMarkerLat(lt); setMarkerLng(ln);
      setFlyTarget({ lat: lt, lng: ln });
    }
  }, [data]);

  const estGuinee = pays === 'GN';
  const communes  = useMemo(() => estGuinee ? getCommunesByVille(ville)                        : [], [ville, estGuinee]);
  const quartiers = useMemo(() => estGuinee && commune ? getQuartiersByCommune(ville, commune) : [], [ville, commune, estGuinee]);

  /* ── Géocodage → déplace le marqueur ── */
  const geocodeSelection = useCallback(async (v: string, com: string, qrt: string, p: string) => {
    if (!v) return;
    /* Centrage statique immédiat */
    const vd = findVille(v);
    if (vd) { setMarkerLat(vd.lat); setMarkerLng(vd.lng); setFlyTarget({ lat: vd.lat, lng: vd.lng }); }

    /* Géocodage précis */
    const query = [qrt, com, v, p === 'GN' ? 'Guinée' : ''].filter(Boolean).join(', ');
    if (!query) return;
    setGeocoding(true);
    try {
      const results = await searchAddress(query, 1);
      if (results.length > 0) {
        const r = results[0];
        setMarkerLat(r.latitude); setMarkerLng(r.longitude);
        setFlyTarget({ lat: r.latitude, lng: r.longitude });
      }
    } finally { setGeocoding(false); }
  }, []);

  const handleVilleChange    = (v: string) => { setVille(v); setCommune(''); setQuartier(''); geocodeSelection(v, '', '', pays); };
  const handleCommuneChange  = (c: string) => { setCommune(c); setQuartier(''); geocodeSelection(ville, c, '', pays); };
  const handleQuartierChange = (q: string) => { setQuartier(q); geocodeSelection(ville, commune, q, pays); };
  const handlePaysChange     = (p: string) => { setPays(p); setVille(''); setCommune(''); setQuartier(''); setMarkerLat(DEFAULT_LAT); setMarkerLng(DEFAULT_LNG); setFlyTarget({ lat: DEFAULT_LAT, lng: DEFAULT_LNG }); };
  const handleMapMove        = (lt: number, ln: number) => { setMarkerLat(lt); setMarkerLng(ln); };

  /* ── Sauvegarde ── */
  const handleSave = async () => {
    if (!ville.trim()) { setError('La ville est obligatoire.'); return; }
    setSaving(true); setError(null);
    try {
      await (saveContact as any)({ adresse, commune, quartier, ville, pays, repere });
      if (data?.id) {
        const { apiFetch } = await import('../../../shared/services/apiFetch');
        await apiFetch(`/location/company/${data.id}`, {
          method: 'PATCH',
          body: { latitude: markerLat, longitude: markerLng, ville, commune, adresse, pays },
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la sauvegarde.');
    } finally { setSaving(false); }
  };

  if (loading || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94A3B8' }}>
      <div style={{ textAlign: 'center' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: 30, display: 'block', marginBottom: 12 }} />
        Chargement…
      </div>
    </div>
  );

  const paysInfo    = PAYS_LIST.find(p => p.code === pays) ?? PAYS_LIST[0];
  const boutiqueUrl = `/boutique/${data.id}?preview=1`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)' }}>

      {/* ═══════════════ BANDEAU ═══════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 54, background: '#fff', borderBottom: '1px solid #E2E8F0', flexShrink: 0, gap: 12 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => onNavigate('profil')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569' }}>
            <i className="fas fa-arrow-left" /> Retour
          </button>
          <div style={{ width: 1, height: 20, background: '#E2E8F0' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0B1F3A' }}>{data.companyName}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              {activeTab === 'apercu' ? 'Aperçu public de la boutique' : 'Épinglez votre boutique sur la carte'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 9, padding: 3, gap: 2 }}>
          {([
            { key: 'apercu',       label: 'Aperçu',       icon: 'fa-eye' },
            { key: 'localisation', label: 'Localisation', icon: 'fa-map-location-dot' },
          ] as { key: Tab; label: string; icon: string }[]).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ padding: '6px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s', background: activeTab === t.key ? '#fff' : 'transparent', color: activeTab === t.key ? '#0B1F3A' : '#64748B', boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,.10)' : 'none' }}>
              <i className={`fas ${t.icon}`} style={{ fontSize: 11 }} />{t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'apercu' ? (
            <>
              <button onClick={() => setIframeKey(k => k + 1)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-rotate-right" style={{ fontSize: 13 }} />
              </button>
              <button onClick={() => window.open(`/boutique/${data.id}`, '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0B1F3A', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <i className="fas fa-arrow-up-right-from-square" /> Ouvrir
              </button>
            </>
          ) : (
            <button onClick={handleSave} disabled={saving || !ville}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: saved ? '#047857' : '#1A4FC4', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 18px', fontSize: 12.5, fontWeight: 700, cursor: saving || !ville ? 'not-allowed' : 'pointer', opacity: !ville ? 0.5 : 1, transition: 'background .3s' }}>
              {saving ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</>
                : saved ? <><i className="fas fa-check" /> Enregistré !</>
                  : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder la localisation</>}
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════ APERÇU ═══════════════ */}
      {activeTab === 'apercu' && (
        <iframe key={iframeKey} src={boutiqueUrl} title="Aperçu"
          style={{ flex: 1, border: 'none', width: '100%' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
      )}

      {/* ═══════════════ LOCALISATION ═══════════════ */}
      {activeTab === 'localisation' && (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* ── FORMULAIRE gauche ── */}
          <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E2E8F0', background: '#fff', overflow: 'hidden' }}>

            {/* Header panneau */}
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg,#0B1F3A,#1a3a6b)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fas fa-map-location-dot" style={{ color: '#fff', fontSize: 14 }} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Localisation</div>
                  <div style={{ fontSize: 11, color: 'rgba(200,217,248,.7)' }}>Le marqueur 🏪 suit votre sélection</div>
                </div>
              </div>
              {(data.ville || data.commune) && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'rgba(16,185,129,.18)', borderRadius: 8 }}>
                  <i className="fas fa-circle-check" style={{ color: '#34D399', fontSize: 11 }} />
                  <span style={{ fontSize: 11.5, color: '#D1FAE5', fontWeight: 600 }}>
                    {[(data as any).quartier, data.commune, data.ville].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
            </div>

            {/* Champs */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Pays */}
              <div style={fg}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#0B1F3A', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="fas fa-globe" style={{ color: '#1A4FC4', fontSize: 10 }} /> Pays
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>{paysInfo.emoji}</span>
                  <select style={{ ...sel(), paddingLeft: 34 }} value={pays} onChange={e => handlePaysChange(e.target.value)}>
                    {PAYS_LIST.map(p => <option key={p.code} value={p.code}>{p.emoji} {p.nom}</option>)}
                  </select>
                </div>
              </div>

              {/* Ville */}
              <div style={fg}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#0B1F3A', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="fas fa-city" style={{ color: '#1A4FC4', fontSize: 10 }} /> Ville <span style={{ color: '#E11D48' }}>*</span>
                </label>
                {estGuinee ? (
                  <select style={sel(!!ville)} value={ville} onChange={e => handleVilleChange(e.target.value)}>
                    <option value="">— Choisir une ville —</option>
                    {VILLES_SORTED.map(v => <option key={v.slug} value={v.nom}>{v.nom} ({v.region})</option>)}
                  </select>
                ) : (
                  <input style={inp} value={ville} onChange={e => setVille(e.target.value)} placeholder="Nom de la ville" />
                )}
              </div>

              {/* Commune */}
              {estGuinee && communes.length > 0 && (
                <div style={fg}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#0B1F3A', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i className="fas fa-map" style={{ color: '#1A4FC4', fontSize: 10 }} /> Commune <span style={{ color: '#E11D48' }}>*</span>
                  </label>
                  <select style={sel(!!commune)} value={commune} onChange={e => handleCommuneChange(e.target.value)}>
                    <option value="">— Choisir une commune —</option>
                    {communes.map(c => <option key={c.nom} value={c.nom}>{c.nom}</option>)}
                  </select>
                </div>
              )}

              {/* Quartier */}
              {estGuinee && quartiers.length > 0 && (
                <div style={fg}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#0B1F3A', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i className="fas fa-map-pin" style={{ color: '#1A4FC4', fontSize: 10 }} /> Quartier <span style={{ color: '#E11D48' }}>*</span>
                  </label>
                  <select style={sel(!!quartier)} value={quartier} onChange={e => handleQuartierChange(e.target.value)}>
                    <option value="">— Choisir un quartier —</option>
                    {quartiers.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
              )}

              {/* Résumé / géocodage */}
              {ville && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'rgba(26,79,196,.07)', borderRadius: 9, border: '1px solid rgba(26,79,196,.15)' }}>
                  {geocoding
                    ? <i className="fas fa-circle-notch fa-spin" style={{ color: '#1A4FC4', fontSize: 12, flexShrink: 0 }} />
                    : <i className="fas fa-map-pin" style={{ color: '#1A4FC4', fontSize: 12, flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 12.5, color: '#0B1F3A', fontWeight: 700 }}>
                    {geocoding ? 'Localisation en cours…' : [quartier, commune, ville, paysInfo.nom].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}

              {/* Adresse */}
              <div style={fg}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#0B1F3A', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="fas fa-location-dot" style={{ color: '#94A3B8', fontSize: 10 }} /> Adresse
                  <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: 11 }}>(optionnel)</span>
                </label>
                <input style={inp} value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Rue, numéro…" />
              </div>

              {/* Repère */}
              <div style={fg}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#0B1F3A', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="fas fa-comment-dots" style={{ color: '#94A3B8', fontSize: 10 }} /> Repère livreurs
                  <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: 11 }}>(optionnel)</span>
                </label>
                <input style={inp} value={repere} onChange={e => setRepere(e.target.value)} placeholder="Face à la pharmacie bleue…" />
              </div>

              {/* GPS */}
              <div className="gridR2" style={{ gap: 8 }}>
                {[
                  { label: 'Latitude',  val: markerLat.toFixed(5) },
                  { label: 'Longitude', val: markerLng.toFixed(5) },
                ].map(item => (
                  <div key={item.label} style={{ padding: '8px 11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9 }}>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#0B1F3A' }}>{item.val}</div>
                  </div>
                ))}
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 9, fontSize: 12.5, color: '#B91C1C' }}>
                  <i className="fas fa-circle-exclamation" /> {error}
                </div>
              )}
            </div>

            {/* Bouton sticky bas */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', flexShrink: 0 }}>
              <button onClick={handleSave} disabled={saving || !ville}
                style={{ width: '100%', padding: '12px', background: saved ? '#047857' : '#1A4FC4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: saving || !ville ? 'not-allowed' : 'pointer', opacity: !ville ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .3s' }}>
                {saving ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</>
                  : saved ? <><i className="fas fa-check" /> Localisation enregistrée !</>
                    : <><i className="fas fa-cloud-arrow-up" /> Enregistrer la localisation</>}
              </button>
            </div>
          </div>

          {/* ── CARTE droite ── */}
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>

            {/* Badge géocodage */}
            {geocoding && (
              <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 600, background: 'rgba(11,31,58,.88)', color: '#fff', padding: '7px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7, backdropFilter: 'blur(6px)', pointerEvents: 'none' }}>
                <i className="fas fa-circle-notch fa-spin" /> Recherche de la position…
              </div>
            )}

            <MapContainer
              center={[markerLat, markerLng]}
              zoom={13}
              scrollWheelZoom
              zoomControl={false}
              style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
            >
              <TileLayer url={OSM_URL} attribution={OSM_ATTR} maxZoom={19} />
              <ZoomControl position="bottomright" />
              <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />
              <ClickHandler onMove={handleMapMove} />
              <DraggableMarker lat={markerLat} lng={markerLng} onDragEnd={handleMapMove} />
            </MapContainer>

            {/* Hint bas */}
            <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)', padding: '6px 14px', borderRadius: 999, fontSize: 12, color: '#475569', fontWeight: 600, border: '1px solid rgba(0,0,0,.08)', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.10)' }}>
              <i className="fas fa-hand-pointer" style={{ marginRight: 6, color: '#1A4FC4' }} />
              Cliquez ou glissez le marqueur pour affiner
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

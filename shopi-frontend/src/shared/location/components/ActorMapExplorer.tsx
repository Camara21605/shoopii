/* ================================================================
 * FICHIER : src/shared/location/components/ActorMapExplorer.tsx
 *
 * Carte de recherche du client (onglet « Localisation » de l'accueil) :
 * retrouver une ENTREPRISE, un LIVREUR ou un CORRESPONDANT et voir où il
 * se trouve — un POINT ROUGE apparaît sur la carte à son emplacement.
 *
 *  - Recherche à la frappe (anti-rebond + annulation des requêtes périmées),
 *    par nom, quartier, commune ou ville, sans accents ni casse, tolérante
 *    aux fautes de frappe ; filtres par type ; mode « autour de moi ».
 *  - Chaque résultat = une épingle rouge ; la sélection (clic dans la liste
 *    ou sur la carte) zoome dessus, l'anime et ouvre sa fiche (quartier,
 *    ville, distance, note, disponibilité, itinéraire, partage).
 *  - Un acteur sans GPS est situé d'après son quartier / sa ville : son
 *    épingle est en pointillés avec un cercle « position approximative ».
 *  - LIEUX : la recherche propose aussi les quartiers, communes et villes ;
 *    choisir un lieu zoome dessus et liste ce qui s'y trouve alentour.
 *  - FONDS DE CARTE : Plan / Relief / Satellite (avec noms des lieux), au choix.
 *  - État partageable dans l'URL (?q=…&t=…&focus=role:id&fond=…), navigation
 *    clavier, annonces pour lecteurs d'écran, carte claire/sombre.
 * ================================================================ */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, useMap } from 'react-leaflet';

import L from '../leafletSetup';
import '../styles/location.css';
import '../styles/actor-map.css';

import { useGeolocation }      from '../hooks/useGeolocation';
import { useActorMapSearch }   from '../hooks/useActorMapSearch';
import { usePlaceSuggestions } from '../hooks/usePlaceSuggestions';
import { GPS_ICON }            from './LocationMap';
import RoutePolyline           from './RoutePolyline';
import { fetchRoute, type RouteResult } from '../services/routingApi';
import { locatePlace, type MapActor, type MapActorRole, type MapPlace } from '../services/mapSearchApi';
import { MAP_STYLES, MAP_STYLE_ORDER, readStoredStyle, storeStyle, type MapStyleId } from '../utils/mapLayers';
import { DEFAULT_CENTER, formatDistance } from '../utils/geoUtils';
import type { Coordinates }    from '../types/location.types';

/* ── Présentation par type ─────────────────────────────────── */
const ROLE: Record<MapActorRole, { label: string; plural: string; emoji: string }> = {
  vendor:        { label: 'Entreprise',    plural: 'Entreprises',    emoji: '🏪' },
  delivery:      { label: 'Livreur',       plural: 'Livreurs',       emoji: '🛵' },
  correspondent: { label: 'Correspondant', plural: 'Correspondants', emoji: '📦' },
};
const ALL_ROLES: MapActorRole[] = ['vendor', 'delivery', 'correspondent'];
const RADII = [5, 10, 25, 50];

/* Rayon du cercle « position approximative » selon la précision de la déduction */
const APPROX_RADIUS_M: Record<string, number> = { quartier: 600, commune: 1500, ville: 4000 };
const PRECISION_LABEL: Record<string, string> = {
  exact: 'Position exacte', quartier: 'Position approximative (quartier)',
  commune: 'Position approximative (commune)', ville: 'Position approximative (ville)',
};

/* ── Icône d'épingle rouge (mise en cache : une par combinaison) ── */
const iconCache = new Map<string, L.DivIcon>();
function pinIcon(role: MapActorRole, selected: boolean, approx: boolean): L.DivIcon {
  const key = `${role}|${selected}|${approx}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: '',
      html: `<div class="am-pin am-pin--drop${selected ? ' am-pin--sel' : ''}${approx ? ' am-pin--approx' : ''}">
               <span class="am-pin__dot"></span>
               <span class="am-pin__body"><span>${ROLE[role].emoji}</span></span>
             </div>`,
      iconSize:    [38, 46],
      iconAnchor:  [19, 44],
      popupAnchor: [0, -42],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

/* Lieu choisi (quartier, commune, ville) : repère indigo, distinct des points rouges des acteurs */
const PLACE_ICON = L.divIcon({
  className: '',
  html: '<div class="am-placepin"><span class="am-placepin__body"><i class="fas fa-location-crosshairs"></i></span><span class="am-placepin__dot"></span></div>',
  iconSize: [36, 44], iconAnchor: [18, 42], popupAnchor: [0, -40],
});

/** Lieu actif : position + nom, et rayon de recherche adapté à son échelle. */
interface ActivePlace { name: string; label: string; lat: number; lng: number; kind: 'quartier' | 'commune' | 'ville' | 'libre'; approx: boolean }
const PLACE_ZOOM:   Record<ActivePlace['kind'], number> = { quartier: 16, commune: 14, ville: 12, libre: 16 };
const PLACE_RADIUS: Record<ActivePlace['kind'], number> = { quartier: 3,  commune: 8,  ville: 25, libre: 3  };

function useIsDark(): boolean {
  const read = () => {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const stars = (n: number) => n > 0 ? `★ ${n.toFixed(1)}` : '';
const keyOf = (a: Pick<MapActor, 'role' | 'id'>) => `${a.role}:${a.id}`;

/* ── Cadrage de la carte (résultats / sélection / position) ─── */
interface ControllerProps {
  results:  MapActor[];
  selected: MapActor | null;
  me:       Coordinates | null;
  recenter: number;               // incrémenté par « Ma position »
  onArrive: () => void;           // fin de l'animation vers la sélection (ouvre la fiche)
  place:    ActivePlace | null;
}
function MapController({ results, selected, me, recenter, onArrive, place }: ControllerProps) {
  const map = useMap();

  /* Lieu choisi : on vole vers lui (les épingles alentour sont cadrées ensuite, s'il y en a) */
  useEffect(() => {
    if (place) map.flyTo([place.lat, place.lng], PLACE_ZOOM[place.kind], { duration: .9 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.lat, place?.lng, map]);

  /* Nouveaux résultats → on cadre l'ensemble des épingles (et le client s'il est proche) */
  const resultsKey = results.map(keyOf).join(',');
  useEffect(() => {
    if (!results.length) return;
    const pts: L.LatLngExpression[] = results.map(r => [r.lat, r.lng]);
    if (pts.length === 1) { map.flyTo(pts[0], results[0].approx ? 14 : 16, { duration: .8 }); return; }
    map.flyToBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 16, duration: .8 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey, map]);

  /* Sélection → zoom animé sur l'épingle, puis ouverture de sa fiche */
  useEffect(() => {
    if (!selected) return;
    map.flyTo([selected.lat, selected.lng], selected.approx ? 14 : 17, { duration: .7 });
    const t = setTimeout(onArrive, 760);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.role, map]);

  useEffect(() => {
    if (recenter && me) map.flyTo([me.latitude, me.longitude], 15, { duration: .8 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenter, map]);

  /* La carte est dans un onglet/panneau qui peut changer de taille */
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  return null;
}

/* ── Une ligne de la liste ───────────────────────────────────── */
const ResultItem = memo(function ResultItem({ a, selected, onSelect }: {
  a: MapActor; selected: boolean; onSelect: (a: MapActor) => void;
}) {
  return (
    <button type="button" role="option" aria-selected={selected} className="am-item" onClick={() => onSelect(a)}>
      <span className="am-ava">
        {a.image ? <img src={a.image} alt="" loading="lazy" /> : ROLE[a.role].emoji}
      </span>
      <span className="am-meta">
        <span className="am-name">{a.name}</span>
        <span className="am-role">{ROLE[a.role].label}</span>
        <span className="am-loc">
          <i className="fas fa-location-dot" aria-hidden="true" />
          <span>
            {a.quartier && <strong>{a.quartier}</strong>}
            {a.quartier && a.ville && a.quartier.toLowerCase() !== a.ville.toLowerCase() && ' · '}
            {a.ville && a.quartier?.toLowerCase() !== a.ville.toLowerCase() && a.ville}
            {!a.quartier && !a.ville && (a.localisation ?? '—')}
          </span>
        </span>
        <span className="am-sub">
          {a.distanceKm != null && <span><i className="fas fa-route" aria-hidden="true" /> {formatDistance(a.distanceKm)}</span>}
          {a.rating > 0 && <span>{stars(a.rating)}</span>}
          {a.available === true  && <span className="am-badge am-badge--ok">Disponible</span>}
          {a.available === false && <span className="am-badge am-badge--off">Indisponible</span>}
          {a.approx && <span className="am-badge am-badge--approx">Approximatif</span>}
        </span>
      </span>
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
 * COMPOSANT PRINCIPAL
 * ═══════════════════════════════════════════════════════════════ */
interface Props {
  onToast?: (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

export default function ActorMapExplorer({ onToast }: Props) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const dark = useIsDark();
  const geo  = useGeolocation({ watch: true });
  const me   = geo.position;

  /* État initial lu dans l'URL — le lien est partageable */
  const [query,    setQuery]    = useState(params.get('q') ?? '');
  const [types,    setTypes]    = useState<MapActorRole[]>(() => {
    const t = (params.get('t') ?? '').split(',').filter((x): x is MapActorRole => (ALL_ROLES as string[]).includes(x));
    return t.length ? t : ALL_ROLES;
  });
  const [nearby,   setNearby]   = useState(params.get('near') === '1');
  const [radiusKm, setRadiusKm] = useState(Number(params.get('r')) || 10);
  const [selKey,   setSelKey]   = useState<string | null>(params.get('focus'));
  const [mapStyle, setMapStyle] = useState<MapStyleId>(() => {
    const f = params.get('fond');
    return f && f in MAP_STYLES ? (f as MapStyleId) : readStoredStyle();
  });
  const [labelsOn, setLabelsOn] = useState(true);
  const [place,    setPlace]    = useState<ActivePlace | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [recenter, setRecenter] = useState(0);
  const [route,    setRoute]    = useState<RouteResult | null>(null);
  const [routing,  setRouting]  = useState(false);

  /* Autour d'un lieu choisi, les distances se comptent depuis LE LIEU ; sinon depuis le client */
  const origin: Coordinates | null = place ? { latitude: place.lat, longitude: place.lng } : me;
  const originName = place ? place.name : 'vous';

  const { results, meta, loading, error, searched, retry } = useActorMapSearch({
    query, types, origin, nearby, radiusKm,
  });
  const placeSuggestions = usePlaceSuggestions(query);

  const selected = useMemo(() => results.find(r => keyOf(r) === selKey) ?? null, [results, selKey]);

  /* Recopie l'état dans l'URL (sans empiler l'historique) */
  useEffect(() => {
    /* On ne touche qu'à NOS paramètres : la page hôte garde les siens (ex. l'onglet actif) */
    setParams(prev => {
      const next = new URLSearchParams(prev);
      ['q', 't', 'near', 'r', 'focus', 'fond'].forEach(k => next.delete(k));
      if (mapStyle !== 'plan') next.set('fond', mapStyle);
      if (query.trim()) next.set('q', query.trim());
      if (types.length !== ALL_ROLES.length) next.set('t', types.join(','));
      if (nearby) { next.set('near', '1'); next.set('r', String(radiusKm)); }
      if (selKey) next.set('focus', selKey);
      return next;
    }, { replace: true });
  }, [query, types, nearby, radiusKm, selKey, mapStyle, setParams]);

  /* Un lien partagé (?focus=role:id) : on sélectionne dès que le résultat est chargé */
  useEffect(() => {
    if (selKey && searched && !results.some(r => keyOf(r) === selKey)) setSelKey(null);
  }, [results, searched, selKey]);

  /* Sélectionner un autre acteur efface l'itinéraire précédent */
  useEffect(() => { setRoute(null); }, [selKey]);

  /* ── Fiche (popup) : ouverte une fois le zoom terminé ── */
  const markerRefs = useRef(new Map<string, L.Marker>());
  const openPopup  = useCallback(() => {
    if (selKey) markerRefs.current.get(selKey)?.openPopup();
  }, [selKey]);

  const toggleType = (t: MapActorRole) =>
    setTypes(cur => cur.includes(t) ? (cur.length > 1 ? cur.filter(x => x !== t) : cur) : [...cur, t]);

  const toggleNearby = () => {
    if (!nearby && !me) { geo.refresh(); onToast?.('Autorisez la géolocalisation pour chercher autour de vous.', 'i'); }
    setPlace(null);
    setNearby(n => !n);
    setSelKey(null);
  };

  const select = useCallback((a: MapActor) => setSelKey(keyOf(a)), []);

  const clearAll = () => { setQuery(''); setNearby(false); setSelKey(null); setRoute(null); setPlace(null); };

  const changeStyle = (id: MapStyleId) => { setMapStyle(id); storeStyle(id); };

  /* Choisir un lieu : on récupère ses coordonnées (une requête), on y vole, puis on liste
   * ce qui se trouve alentour (mode « autour de » centré sur le lieu). */
  const goToPlace = async (input: { nom: string; type: MapPlace['type'] | 'libre'; commune?: string | null; ville?: string | null; label: string }) => {
    setPlaceBusy(true);
    try {
      const pos = await locatePlace(input);
      if (!pos) { onToast?.(`Lieu introuvable : « ${input.nom} ».`, 'w'); return; }
      const kind = input.type;
      setPlace({
        name: input.nom, label: pos.label ?? input.label, lat: pos.lat, lng: pos.lng, kind,
        approx: pos.precision !== 'quartier' || kind === 'ville' || kind === 'commune',
      });
      setQuery('');
      setSelKey(null);
      setRadiusKm(PLACE_RADIUS[kind]);
      setNearby(true);
    } catch {
      onToast?.('Impossible de localiser ce lieu pour le moment.', 'w');
    } finally { setPlaceBusy(false); }
  };

  /* ── Itinéraire depuis le client jusqu'à l'acteur sélectionné ── */
  const showRoute = async (a: MapActor) => {
    if (!me) { geo.refresh(); onToast?.('Position introuvable : autorisez la géolocalisation pour tracer l’itinéraire.', 'w'); return; }
    setRouting(true);
    try {
      setRoute(await fetchRoute([me, { latitude: a.lat, longitude: a.lng }]));
    } catch {
      onToast?.('Itinéraire indisponible pour le moment.', 'w');
    } finally { setRouting(false); }
  };

  const share = async (a: MapActor) => {
    const url = `${window.location.origin}${window.location.pathname}?${new URLSearchParams({ q: a.name, focus: keyOf(a) })}`;
    try {
      if (navigator.share) await navigator.share({ title: a.name, url });
      else { await navigator.clipboard.writeText(url); onToast?.('Lien copié', 's'); }
    } catch { /* partage annulé */ }
  };

  const styleDef = MAP_STYLES[mapStyle];
  const baseTile = styleDef.base(dark);
  const center   = me ?? DEFAULT_CENTER;
  const trimmed = query.trim();
  const idle    = !trimmed && !nearby && !place;

  return (
    <section className="am" aria-label="Carte de recherche des entreprises, livreurs et correspondants">
      {/* ── Recherche + filtres ── */}
      <div className="am-top">
        <div className="am-search" role="search">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            type="search" value={query} autoComplete="off" spellCheck={false} maxLength={80}
            placeholder="Entreprise, livreur, correspondant, quartier ou ville — ex. « Kaloum », « pharmacie »…"
            aria-label="Rechercher une entreprise, un livreur ou un correspondant"
            onChange={e => { setQuery(e.target.value); setSelKey(null); if (place) { setPlace(null); setNearby(false); } }}
            onKeyDown={e => {
              if (e.key === 'Escape') clearAll();
              if (e.key === 'Enter' && results[0]) select(results[0]);
            }}
          />
          {loading && <i className="fas fa-circle-notch am-spin" aria-label="Recherche en cours" />}
          {(query || nearby) && (
            <button type="button" className="am-clear" onClick={clearAll} aria-label="Effacer la recherche">
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>

        <div className="am-row">
          {ALL_ROLES.map(r => (
            <button key={r} type="button" className="am-chip" aria-pressed={types.includes(r)} onClick={() => toggleType(r)}>
              <span aria-hidden="true">{ROLE[r].emoji}</span> {ROLE[r].plural}
              {searched && <small>{meta.byRole[r]}</small>}
            </button>
          ))}
          <span className="am-sep" />
          <button type="button" className="am-chip am-chip--geo" aria-pressed={nearby} onClick={toggleNearby}>
            <i className="fas fa-crosshairs" aria-hidden="true" /> Autour de moi
          </button>
          {nearby && (
            <select className="am-radius" value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))} aria-label="Rayon de recherche">
              {RADII.map(r => <option key={r} value={r}>{r} km</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Liste + carte ── */}
      <div className="am-body">
        <div className="am-list" role="listbox" aria-label="Résultats" aria-live="polite">
          {idle && (
            <div className="am-state">
              <i className="fas fa-map-location-dot" />
              <h4>Où se trouve…&nbsp;?</h4>
              Tapez le nom d’une entreprise, d’un livreur ou d’un correspondant, ou un quartier :
              le point rouge apparaît sur la carte.
              <div><button type="button" className="am-btn" onClick={toggleNearby}><i className="fas fa-crosshairs" /> Voir autour de moi</button></div>
            </div>
          )}

          {/* LIEUX : quartiers, communes, villes correspondant à la saisie */}
          {trimmed.length >= 2 && (
            <div className="am-places" role="group" aria-label="Lieux">
              <div className="am-count"><b>Lieux</b></div>
              {placeSuggestions.map(pl => (
                <button key={pl.key} type="button" className="am-place" disabled={placeBusy}
                  onClick={() => goToPlace({ nom: pl.name, type: pl.type, commune: pl.commune, ville: pl.ville, label: pl.label })}>
                  <i className="fas fa-location-dot" aria-hidden="true" />
                  <span><strong>{pl.name}</strong> <small>{pl.type === 'ville' ? 'Ville' : pl.type === 'commune' ? 'Commune' : 'Quartier'}</small>
                    <em>{pl.label}</em></span>
                </button>
              ))}
              {trimmed.length >= 3 && (
                <button type="button" className="am-place am-place--free" disabled={placeBusy}
                  onClick={() => goToPlace({ nom: trimmed, type: 'libre', label: trimmed })}>
                  <i className={`fas ${placeBusy ? 'fa-circle-notch am-spin' : 'fa-magnifying-glass-location'}`} aria-hidden="true" />
                  <span><strong>Chercher « {trimmed} » sur la carte</strong><em>Rue, point de repère, quartier…</em></span>
                </button>
              )}
            </div>
          )}

          {!idle && loading && !results.length && [0, 1, 2, 3].map(i => <div key={i} className="am-skel" />)}

          {!idle && error && !loading && (
            <div className="am-state">
              <i className="fas fa-triangle-exclamation" />
              <h4>Recherche impossible</h4>{error}
              <div><button type="button" className="am-btn" onClick={retry}>Réessayer</button></div>
            </div>
          )}

          {!idle && !error && nearby && !trimmed && !me && !place && (
            <div className="am-state">
              <i className="fas fa-location-crosshairs" />
              <h4>Position nécessaire</h4>
              {geo.loading ? 'Localisation en cours…' : (geo.error ?? 'Autorisez la géolocalisation pour voir ce qui se trouve autour de vous.')}
              <div><button type="button" className="am-btn" onClick={geo.refresh}>Réessayer</button></div>
            </div>
          )}

          {!idle && !error && searched && !loading && results.length === 0 && (
            <div className="am-state">
              <i className="fas fa-store-slash" />
              <h4>Aucun résultat{trimmed ? ` pour « ${trimmed} »` : ''}</h4>
              Vérifiez l’orthographe, essayez un quartier ou une ville, ou élargissez les filtres.
              <div><button type="button" className="am-btn am-btn--ghost" onClick={clearAll}>Effacer</button></div>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="am-count">
                <b>{meta.total}</b> résultat{meta.total > 1 ? 's' : ''}
                {meta.truncated && ` — ${results.length} affichés`}
                {meta.approx > 0 && ` · ${meta.approx} position${meta.approx > 1 ? 's' : ''} approximative${meta.approx > 1 ? 's' : ''}`}
              </div>
              {results.map(a => (
                <ResultItem key={keyOf(a)} a={a} selected={keyOf(a) === selKey} onSelect={select} />
              ))}
            </>
          )}
        </div>

        <div className="am-map">
          <MapContainer
            center={[center.latitude, center.longitude]} zoom={13} maxZoom={19}
            scrollWheelZoom zoomControl={false} style={{ height: '100%', width: '100%' }}
          >
            {/* Fond de carte : Plan / Relief / Satellite — `key` = changement net de couche */}
            <TileLayer
              key={`${mapStyle}-${dark}`}
              url={baseTile.url} attribution={baseTile.attribution} subdomains={baseTile.subdomains ?? 'abc'}
              maxZoom={baseTile.maxZoom} maxNativeZoom={baseTile.maxNativeZoom}
            />
            {/* Satellite hybride : noms des lieux (villes, quartiers, routes) par-dessus l'image */}
            {styleDef.labels && labelsOn && (
              <TileLayer
                key={`${mapStyle}-labels`} url={styleDef.labels.url} attribution={styleDef.labels.attribution}
                maxZoom={styleDef.labels.maxZoom} maxNativeZoom={styleDef.labels.maxNativeZoom} zIndex={400}
              />
            )}
            <ZoomControl position="bottomright" />
            <MapController results={results} selected={selected} me={me} recenter={recenter} onArrive={openPopup} place={place} />

            {/* Lieu choisi : repère + zone de recherche */}
            {place && (
              <>
                <Marker position={[place.lat, place.lng]} icon={PLACE_ICON} zIndexOffset={500}>
                  <Popup className="loc-popup"><div className="am-pop"><h4>{place.name}</h4><div className="am-pop__note">{place.label}</div></div></Popup>
                </Marker>
                {nearby && (
                  <Circle center={[place.lat, place.lng]} radius={radiusKm * 1000}
                    pathOptions={{ color: '#4F46E5', weight: 1.5, dashArray: '6 6', fillColor: '#4F46E5', fillOpacity: .05 }} />
                )}
              </>
            )}

            {/* Position du client : point bleu + précision */}
            {me && <Marker position={[me.latitude, me.longitude]} icon={GPS_ICON} interactive={false} />}
            {me && geo.accuracy != null && geo.accuracy < 2000 && (
              <Circle center={[me.latitude, me.longitude]} radius={geo.accuracy}
                pathOptions={{ color: '#2563EB', weight: 1, fillOpacity: .08 }} />
            )}
            {nearby && me && !place && (
              <Circle center={[me.latitude, me.longitude]} radius={radiusKm * 1000}
                pathOptions={{ color: '#2563EB', weight: 1.5, dashArray: '6 6', fillOpacity: .03 }} />
            )}

            {/* Zone d'incertitude de l'acteur sélectionné (position déduite du quartier / de la ville) */}
            {selected?.approx && (
              <Circle center={[selected.lat, selected.lng]} radius={APPROX_RADIUS_M[selected.precision] ?? 1500}
                pathOptions={{ color: '#E11D48', weight: 1.5, dashArray: '5 6', fillColor: '#E11D48', fillOpacity: .08 }} />
            )}

            {/* ── LES POINTS ROUGES ── */}
            {results.map(a => {
              const k = keyOf(a);
              const isSel = k === selKey;
              return (
                <Marker
                  key={`${k}|${isSel}`}
                  position={[a.lat, a.lng]}
                  icon={pinIcon(a.role, isSel, a.approx)}
                  zIndexOffset={isSel ? 1000 : 0}
                  ref={el => { if (el) markerRefs.current.set(k, el); else markerRefs.current.delete(k); }}
                  eventHandlers={{ click: () => setSelKey(k) }}
                >
                  <Popup className="loc-popup" minWidth={240}>
                    <div className="am-pop">
                      <div className="am-pop__head">
                        <span className="am-ava" style={{ width: 40, height: 40 }}>
                          {a.image ? <img src={a.image} alt="" /> : ROLE[a.role].emoji}
                        </span>
                        <div>
                          <h4>{a.name}</h4>
                          <span className="am-role">{ROLE[a.role].label}{a.rating > 0 ? ` · ${stars(a.rating)}` : ''}</span>
                        </div>
                      </div>
                      <div className="am-pop__loc">
                        📍 {a.quartier ? <strong>{a.quartier}</strong> : null}
                        {a.quartier && a.ville && a.quartier.toLowerCase() !== a.ville.toLowerCase() ? ' · ' : ''}
                        {a.ville && a.quartier?.toLowerCase() !== a.ville.toLowerCase() ? a.ville : ''}
                        {!a.quartier && !a.ville ? (a.localisation ?? '—') : ''}
                      </div>
                      {a.address && <div className="am-pop__note">{a.address}</div>}
                      <div className="am-pop__note">
                        {a.distanceKm != null && <>À <b>{formatDistance(a.distanceKm)}</b> {place ? `de ${originName}` : 'de vous'} · </>}
                        {PRECISION_LABEL[a.precision]}
                        {a.available === true && ' · Disponible'}
                        {a.available === false && ' · Indisponible'}
                      </div>
                      <div className="am-pop__actions">
                        <button type="button" className="am-primary" onClick={() => navigate(a.profilePath)}>Voir le profil</button>
                        <button type="button" onClick={() => showRoute(a)} disabled={routing}>
                          {routing ? '…' : 'Itinéraire'}
                        </button>
                        <button type="button" onClick={() => share(a)}>Partager</button>
                        <a target="_blank" rel="noreferrer noopener"
                          href={`https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`}>Ouvrir dans Maps</a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {route && <RoutePolyline route={route} color="#E11D48" />}
          </MapContainer>

          {/* Fond de carte : Plan / Relief / Satellite */}
          <div className="am-styles" role="radiogroup" aria-label="Fond de carte">
            {MAP_STYLE_ORDER.map(id => (
              <button key={id} type="button" role="radio" aria-checked={mapStyle === id}
                className="am-style" onClick={() => changeStyle(id)} title={MAP_STYLES[id].label}>
                <i className={`fas ${MAP_STYLES[id].icon}`} aria-hidden="true" /> <span>{MAP_STYLES[id].label}</span>
              </button>
            ))}
            {styleDef.labels && (
              <button type="button" className="am-style am-style--opt" aria-pressed={labelsOn}
                onClick={() => setLabelsOn(v => !v)} title="Afficher les noms des lieux">
                <i className="fas fa-tag" aria-hidden="true" /> <span>Noms</span>
              </button>
            )}
          </div>

          {/* Bandeau d'infos sur la carte */}
          <div className="am-hud" aria-hidden="true">
            {place && (
              <span style={{ cursor: 'pointer' }} onClick={() => { setPlace(null); setNearby(false); }} title="Retirer le lieu">
                <i className="fas fa-location-crosshairs" style={{ color: '#4F46E5' }} />{place.name}{nearby ? ` · ${meta.total} autour` : ''} ✕
              </span>
            )}
            {route && <span><i className="fas fa-route" />{route.totalDistanceTxt} · {route.totalDurationTxt}</span>}
            {selected?.approx && <span><i className="fas fa-circle-info" />Position approximative — l’acteur n’a pas partagé de GPS</span>}
            {me && (
              <span style={{ cursor: 'pointer' }} onClick={() => setRecenter(n => n + 1)}>
                <i className="fas fa-location-crosshairs" />Ma position
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

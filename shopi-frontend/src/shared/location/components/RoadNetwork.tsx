/* ================================================================
 * FICHIER : src/shared/location/components/RoadNetwork.tsx
 *
 * Tous les chemins de la zone affichée, distingués comme sur une carte
 * routière :
 *   - VÉHICULES : autoroutes / nationales (orange), routes primaires,
 *     secondaires, tertiaires, rues et ruelles (blanc à liseré), pistes
 *     (pointillés bruns) ;
 *   - PIÉTONS   : sentiers, trottoirs, voies piétonnes (pointillés verts),
 *     escaliers (pointillés rouges).
 * Données OpenStreetMap chargées par tuiles z14 (GET /location/map/roads),
 * à partir du zoom 15 ; les tuiles déjà chargées ne sont jamais redemandées.
 * Rendu Canvas (des milliers de tracés restent fluides), sous les noms et
 * les épingles. Deux panneaux : liserés en dessous, traits au-dessus.
 * ================================================================ */

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

import L from '../leafletSetup';
import { fetchRoadTile, type RoadClass, type RoadWay } from '../services/mapSearchApi';

export const ROADS_MIN_ZOOM = 15;
const TILE_Z     = 14;
const MAX_TILES  = 16;          // garde-fou : jamais plus de 16 tuiles par vue
/* Une tuile en échec (service saturé) est redemandée seule, sans attendre que
 * l'utilisateur déplace la carte : délai croissant, 4 essais au plus. */
const RETRY_MS   = [4_000, 10_000, 25_000, 60_000];
const CASING_PANE = 'am-roads-casing';
const LINE_PANE   = 'am-roads';

export interface RoadStatus { visible: boolean; loading: boolean; error: boolean }

interface Props {
  tone:      'light' | 'dark';
  onStatus?: (s: RoadStatus) => void;
}

/* Ordre de dessin : les petites voies d'abord, les grandes par-dessus */
const DRAW_ORDER: RoadClass[] = ['f', 'e', 'k', 'r', 't', 's', 'p', 'm'];

/* Traits FINS : dans les quartiers denses (Kindia, Conakry…) les rues sont
 * étroites et bordées de concessions — des traits épais recouvraient les
 * maisons et la carte devenait une grille blanche (retour utilisateur). Les
 * petites rues sont légèrement transparentes : les concessions restent
 * visibles jusqu'au bord de la rue. */
interface Style { color: string; w: number; casing?: string; dash?: string; opacity?: number }
const STYLES: Record<'light' | 'dark', Record<RoadClass, Style>> = {
  light: {
    m: { color: '#F97316', w: 4,   casing: '#9A4A0C' },
    p: { color: '#FBBF24', w: 3.4, casing: '#A16207' },
    s: { color: '#FDE68A', w: 3,   casing: '#A8892B' },
    t: { color: '#FFFFFF', w: 2.4, casing: '#8B929B' },
    r: { color: '#FFFFFF', w: 1.7, casing: '#9AA0A6', opacity: .9 },
    k: { color: '#B45309', w: 1.5, dash: '5 4' },
    f: { color: '#15803D', w: 1.4, dash: '1.5 3.5', opacity: .85 },
    e: { color: '#DC2626', w: 1.8, dash: '1 3' },
  },
  dark: {
    m: { color: '#FB923C', w: 4 },
    p: { color: '#FCD34D', w: 3.4 },
    s: { color: '#FEF3C7', w: 3 },
    t: { color: '#E5E7EB', w: 2.4, opacity: .9 },
    r: { color: '#D1D5DB', w: 1.6, opacity: .7 },
    k: { color: '#FBBF77', w: 1.5, dash: '5 4', opacity: .85 },
    f: { color: '#86EFAC', w: 1.4, dash: '1.5 3.5', opacity: .8 },
    e: { color: '#FCA5A5', w: 1.8, dash: '1 3' },
  },
};

/* Zoom à partir duquel chaque classe apparaît (comme Google Maps : de loin les
 * grands axes seulement, les détails en s'approchant). Sentiers, pistes et
 * escaliers n'apparaissent qu'à partir de 16 — à 15 ils brouillaient la carte. */
const CLASS_MIN_ZOOM: Partial<Record<RoadClass, number>> = { k: 16, f: 16, e: 16 };

/** Épaisseur selon le zoom : fine de loin, un peu plus marquée de très près. */
const scale = (z: number) => (z >= 19 ? 1.8 : z >= 18 ? 1.45 : z >= 17 ? 1.15 : z >= 16 ? 0.95 : 0.8);

const lng2x = (lng: number) => Math.floor(((lng + 180) / 360) * 2 ** TILE_Z);
const lat2y = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** TILE_Z);
};

interface Drawn { cls: RoadClass; line: L.Polyline; casing?: L.Polyline }

export default function RoadNetwork({ tone, onStatus }: Props) {
  const map = useMap();

  useEffect(() => {
    for (const [name, z] of [[CASING_PANE, '410'], [LINE_PANE, '415']] as const) {
      if (!map.getPane(name)) { const p = map.createPane(name); p.style.zIndex = z; p.style.pointerEvents = 'none'; }
    }
    const casingRenderer = L.canvas({ pane: CASING_PANE, padding: 0.4 });
    const lineRenderer   = L.canvas({ pane: LINE_PANE,   padding: 0.4 });
    const group = L.layerGroup().addTo(map);

    const drawn   = new Map<number, Drawn>();     // voie OSM → tracés (dédoublonne entre tuiles voisines)
    const loaded  = new Set<string>();
    const pending = new Map<string, AbortController>();
    const attempts = new Map<string, number>();    // tuile → échecs successifs
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let failed = false;
    let alive  = true;

    const report = () => onStatus?.({
      visible: map.getZoom() >= ROADS_MIN_ZOOM, loading: pending.size > 0, error: failed && pending.size === 0 && loaded.size === 0,
    });

    const styleOf = (cls: RoadClass) => {
      const z = map.getZoom();
      const st = STYLES[tone][cls], k = scale(z);
      const shown = z >= (CLASS_MIN_ZOOM[cls] ?? ROADS_MIN_ZOOM) ? 1 : 0;
      return {
        line:   { color: st.color, weight: st.w * k, opacity: (st.opacity ?? 1) * shown, dashArray: st.dash, lineCap: 'round' as const, lineJoin: 'round' as const, interactive: false },
        casing: st.casing ? { color: st.casing, weight: st.w * k + 1.4, opacity: (st.opacity ?? 1) * 0.75 * shown, lineCap: 'round' as const, lineJoin: 'round' as const, interactive: false } : null,
      };
    };

    const addWays = (ways: RoadWay[]) => {
      const fresh = ways.filter(w => !drawn.has(w[0]))
        .sort((a, b) => DRAW_ORDER.indexOf(a[1]) - DRAW_ORDER.indexOf(b[1]));
      /* liserés d'abord (panneau du dessous), puis traits */
      for (const [id, cls, flat] of fresh) {
        const pts: L.LatLngTuple[] = [];
        for (let i = 0; i + 1 < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
        const s = styleOf(cls);
        const casing = s.casing ? L.polyline(pts, { ...s.casing, renderer: casingRenderer, pane: CASING_PANE }).addTo(group) : undefined;
        const line = L.polyline(pts, { ...s.line, renderer: lineRenderer, pane: LINE_PANE }).addTo(group);
        drawn.set(id, { cls, line, casing });
      }
    };

    const restyle = () => {
      for (const d of drawn.values()) {
        const s = styleOf(d.cls);
        d.line.setStyle(s.line);
        if (d.casing && s.casing) d.casing.setStyle(s.casing);
      }
    };

    const refresh = () => {
      if (map.getZoom() < ROADS_MIN_ZOOM) { report(); return; }
      const b = map.getBounds();
      const x0 = lng2x(b.getWest()), x1 = lng2x(b.getEast());
      const y0 = lat2y(b.getNorth()), y1 = lat2y(b.getSouth());
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_TILES) return;

      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const key = `${x}/${y}`;
        if (loaded.has(key) || pending.has(key)) continue;
        if ((attempts.get(key) ?? 0) > RETRY_MS.length) continue;   // abandonnée pour cette visite
        const ctl = new AbortController();
        pending.set(key, ctl);
        fetchRoadTile(x, y, ctl.signal)
          .then(r => { if (!alive) return; loaded.add(key); attempts.delete(key); failed = false; addWays(r.ways); })
          .catch(err => {
            if ((err as Error)?.name === 'AbortError' || !alive) return;
            failed = true;
            const n = (attempts.get(key) ?? 0) + 1;
            attempts.set(key, n);
            if (n <= RETRY_MS.length && !retryTimer) {
              retryTimer = setTimeout(() => { retryTimer = null; if (alive) refresh(); }, RETRY_MS[n - 1]);
            }
          })
          .finally(() => { pending.delete(key); if (alive) report(); });
      }
      report();
    };

    const onZoom = () => { restyle(); refresh(); };
    map.on('moveend', refresh);
    map.on('zoomend', onZoom);
    refresh();

    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      map.off('moveend', refresh);
      map.off('zoomend', onZoom);
      pending.forEach(c => c.abort());
      group.remove();
      casingRenderer.remove();
      lineRenderer.remove();
      onStatus?.({ visible: false, loading: false, error: false });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tone]);

  return null;
}

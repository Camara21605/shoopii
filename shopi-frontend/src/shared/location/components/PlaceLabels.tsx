/* ================================================================
 * FICHIER : src/shared/location/components/PlaceLabels.tsx
 *
 * Noms des lieux directement sur la carte, à la manière de Google Maps :
 *   - hiérarchie nette : PAYS > préfectures / villes > localités >
 *     COMMUNES > quartiers > villages ;
 *   - apparition progressive selon le niveau de zoom ;
 *   - texte gras à halo épais : lisible sur n'importe quel fond, et
 *     recouvre le petit nom écrit par les tuiles de rues (OpenStreetMap)
 *     au même endroit — on ne voit plus qu'un seul nom, le nôtre ;
 *   - anti-chevauchement : à priorité égale, on garde le premier posé et
 *     on masque les noms qui se superposeraient (recalculé à chaque
 *     déplacement).
 * Les données sont locales (data/guineaLabels.ts) : aucun appel réseau.
 * `skipOsm` : pour un fond dont les tuiles écriraient déjà lisiblement les
 * noms OpenStreetMap — on n'ajouterait alors que ceux qui manquent.
 * ================================================================ */

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

import L from '../leafletSetup';
import { GUINEA_LABELS, type LabelKind } from '../data/guineaLabels';

const PANE = 'am-labels';

/** 'p' = pays (en plus des types des données). */
type Kind = LabelKind | 'p';

/** Pays : la Guinée et ses voisins, noms en français. */
const COUNTRIES: readonly (readonly [string, number, number])[] = [
  ['Guinée',        10.45, -11.3],
  ['Sénégal',       13.9,  -14.6],
  ['Mali',          12.9,   -8.6],
  ['Guinée-Bissau', 11.95, -15.0],
  ['Sierra Leone',   8.6,  -11.8],
  ['Libéria',        6.7,   -9.5],
  ["Côte d'Ivoire",  8.2,   -6.4],
];

/** Plage de zoom de chaque type de nom. */
const MIN_ZOOM: Record<Kind, number> = { p: 4, c: 6, t: 9, s: 11, q: 13, v: 12 };
const MAX_ZOOM: Partial<Record<Kind, number>> = { p: 9 };
const FONT_PX:  Record<Kind, number> = { p: 15, c: 16, t: 14, s: 13.5, q: 13, v: 12 };
/* Ordre de pose (les premiers ont la priorité en cas de chevauchement) */
const PRIORITY: Kind[] = ['p', 'c', 't', 's', 'q', 'v'];

interface Props {
  /** Fond sombre (satellite, thème sombre) : texte clair à halo sombre. */
  tone:    'light' | 'dark';
  /** Masquer les noms déjà dessinés par les tuiles OpenStreetMap. */
  skipOsm: boolean;
  /** Nom du lieu actif (mis en évidence). */
  active?: string | null;
}

interface Label { name: string; kind: Kind; lat: number; lng: number; osm: boolean }

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Liste préparée une seule fois. Doublons retirés : une ville présente à la
 * fois dans OpenStreetMap et dans le référentiel Shoneya (ex. « Kindia », à
 * 3 km d'écart) s'affichait deux fois de près — on garde la position OSM, qui
 * est celle des tuiles. */
const LABELS: readonly Label[] = (() => {
  const osmKeys = new Set(GUINEA_LABELS.filter(l => l[4] === 1).map(l => `${l[1]}|${fold(l[0])}`));
  const out: Label[] = COUNTRIES.map(([name, lat, lng]) => ({ name, kind: 'p' as const, lat, lng, osm: false }));
  for (const [name, kind, lat, lng, osm] of GUINEA_LABELS) {
    if (osm === 0 && osmKeys.has(`${kind}|${fold(name)}`)) continue;
    out.push({ name, kind, lat, lng, osm: osm === 1 });
  }
  return out;
})();

function buildIcon(name: string, kind: Kind, tone: Props['tone'], isActive: boolean): L.DivIcon {
  const el = document.createElement('div');
  el.className = `am-lbl am-lbl--${kind} am-lbl--${tone}${isActive ? ' am-lbl--active' : ''}`;
  if (kind === 'c' || kind === 't') el.appendChild(Object.assign(document.createElement('i'), { className: 'am-lbl__dot' }));
  el.appendChild(Object.assign(document.createElement('span'), { textContent: name }));
  return L.divIcon({ html: el, className: 'am-lbl-wrap', iconSize: [0, 0] });
}

export default function PlaceLabels({ tone, skipOsm, active }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      pane.style.zIndex = '450';
      pane.style.pointerEvents = 'none';
    }
    const group = L.layerGroup().addTo(map);
    const activeKey = active ? fold(active) : null;

    const draw = () => {
      group.clearLayers();
      const zoom = map.getZoom();
      const bounds = map.getBounds().pad(0.15);
      const taken: { x1: number; y1: number; x2: number; y2: number }[] = [];

      for (const kind of PRIORITY) {
        if (zoom < MIN_ZOOM[kind] || zoom > (MAX_ZOOM[kind] ?? 99)) continue;
        const fs = FONT_PX[kind];
        const upper = kind === 'p' || kind === 'c' || kind === 's';
        for (const l of LABELS) {
          if (l.kind !== kind || (skipOsm && l.osm)) continue;
          if (!bounds.contains([l.lat, l.lng])) continue;

          /* Boîte occupée (majuscules espacées = plus larges) + marge : noms jamais collés */
          const pt = map.latLngToContainerPoint([l.lat, l.lng]);
          const w = l.name.length * fs * (upper ? 0.78 : 0.6) + 20;
          const h = fs + (kind === 'c' || kind === 't' ? 24 : 12);
          const box = { x1: pt.x - w / 2, x2: pt.x + w / 2, y1: pt.y - h / 2, y2: pt.y + h / 2 };
          if (taken.some(b => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)) continue;
          taken.push(box);

          L.marker([l.lat, l.lng], {
            pane: PANE, interactive: false, keyboard: false, zIndexOffset: 0,
            icon: buildIcon(l.name, kind, tone, activeKey === fold(l.name)),
          }).addTo(group);
        }
      }
    };

    draw();
    map.on('moveend zoomend', draw);
    return () => { map.off('moveend zoomend', draw); group.remove(); };
  }, [map, tone, skipOsm, active]);

  return null;
}

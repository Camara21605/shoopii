/* ================================================================
 * FICHIER : src/shared/location/components/PlaceLabels.tsx
 *
 * Noms des villes, communes et quartiers directement sur la carte, à la
 * manière de Google Maps :
 *   - hiérarchie de tailles (ville > localité > commune > quartier > village) ;
 *   - apparition progressive selon le niveau de zoom ;
 *   - anti-chevauchement : à priorité égale, on garde le premier posé et on
 *     masque les noms qui se superposeraient (recalculé à chaque déplacement) ;
 *   - halo lisible sur fond clair (plan, relief) comme sur fond sombre
 *     (satellite, thème sombre).
 * Les données sont locales (data/guineaLabels.ts) : aucun appel réseau.
 * `skipOsm` : sur les fonds OSM (Plan, Relief) le fournisseur de tuiles écrit déjà
 * les noms issus d'OpenStreetMap ; on n'ajoute alors que ceux qui manquent.
 * ================================================================ */

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

import L from '../leafletSetup';
import { GUINEA_LABELS, type LabelKind } from '../data/guineaLabels';

const PANE = 'am-labels';

/** Zoom à partir duquel chaque type de nom apparaît. */
const MIN_ZOOM: Record<LabelKind, number> = { c: 5, t: 8, s: 11, q: 13, v: 12 };
const FONT_PX:  Record<LabelKind, number> = { c: 16, t: 13, s: 13, q: 12, v: 12 };
const PRIORITY: LabelKind[] = ['c', 't', 's', 'q', 'v'];

interface Props {
  /** Fond sombre (satellite, thème sombre) : texte clair à halo sombre. */
  tone:    'light' | 'dark';
  /** Masquer les noms déjà dessinés par les tuiles OpenStreetMap. */
  skipOsm: boolean;
  /** Nom du lieu actif (mis en évidence). */
  active?: string | null;
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildIcon(name: string, kind: LabelKind, tone: Props['tone'], isActive: boolean): L.DivIcon {
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
        if (zoom < MIN_ZOOM[kind]) continue;
        const fs = FONT_PX[kind];
        for (const [name, k, lat, lng, osm] of GUINEA_LABELS) {
          if (k !== kind || (skipOsm && osm)) continue;
          if (!bounds.contains([lat, lng])) continue;

          const pt = map.latLngToContainerPoint([lat, lng]);
          const w = name.length * fs * 0.58 + 14;
          const h = fs + (kind === 'c' || kind === 't' ? 22 : 10);
          const box = { x1: pt.x - w / 2, x2: pt.x + w / 2, y1: pt.y - h / 2, y2: pt.y + h / 2 };
          if (taken.some(b => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)) continue;
          taken.push(box);

          L.marker([lat, lng], {
            pane: PANE, interactive: false, keyboard: false, zIndexOffset: 0,
            icon: buildIcon(name, kind, tone, activeKey === fold(name)),
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

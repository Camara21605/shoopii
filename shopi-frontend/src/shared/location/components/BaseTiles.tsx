/* ================================================================
 * FICHIER : src/shared/location/components/BaseTiles.tsx
 *
 * Fond de carte commun à toutes les cartes du site, qui s'adapte au
 * niveau de zoom comme Google Maps :
 *   - de loin (zoom ≤ OVERVIEW_MAX_ZOOM) : fond neutre sans aucun nom (gris
 *     clair, ou gris foncé en mode sombre) + routes principales seules ;
 *   - de près (zoom > OVERVIEW_MAX_ZOOM) : OpenStreetMap France — toutes
 *     les rues, ruelles et concessions.
 * Les noms des lieux sont dessinés par PlaceLabels, par-dessus.
 * Les calques ont des plages de zoom disjointes : Leaflet affiche
 * automatiquement le bon, sans aucune logique ici.
 * ================================================================ */

import { TileLayer } from 'react-leaflet';
import {
  OSM_TILE, OVERVIEW_BASE_LIGHT, OVERVIEW_BASE_DARK, OVERVIEW_ROADS, DARK_TILE_CLASS, hdTile,
} from '../utils/geoUtils';

export default function BaseTiles({ dark = false }: { dark?: boolean }) {
  return (
    <>
      {/* De loin : vrai fond sombre en mode sombre (pas de filtre), routes par-dessus.
          zIndex FIXES : sans eux, passer clair ↔ sombre remontait le fond APRÈS le calque
          des routes, qui se retrouvait caché dessous (routes principales invisibles). */}
      {/* hdTile : nets sur les écrans à densité > 1 (fonds sans texte) */}
      <TileLayer key={`overview-${dark}`} {...hdTile(dark ? OVERVIEW_BASE_DARK : OVERVIEW_BASE_LIGHT)} zIndex={1} />
      <TileLayer key="overview-roads" {...hdTile(OVERVIEW_ROADS)} zIndex={2} />
      {/* De près : `key` — l'URL ne change pas entre clair et sombre, seule la classe */}
      <TileLayer key={`streets-${dark}`} {...OSM_TILE} className={dark ? DARK_TILE_CLASS : undefined} zIndex={1} />
    </>
  );
}

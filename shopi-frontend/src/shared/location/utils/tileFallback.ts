/* ================================================================
 * FICHIER : src/shared/location/utils/tileFallback.ts
 *
 * Tuile de secours, comme Google Maps quand on zoome très fort : là où le
 * serveur n'a pas d'image à ce zoom (Guinée : imagerie satellite souvent
 * limitée au zoom 17-18), on affiche la même zone prise au zoom inférieur,
 * agrandie et découpée (jusqu'à 5 niveaux plus bas) — bâtiments et routes
 * restent visibles, un peu flous, au lieu de l'image grise « Map data not
 * yet available » ou d'un trou.
 *
 * S'applique à tous les calques de tuiles (importé une fois par geoUtils).
 * Les tuiles Esri sont demandées avec ?blankTile=false (voir ESRI_NOBLANK) :
 * une zone sans image répond 404 au lieu de l'image d'avertissement.
 * ================================================================ */
import L from 'leaflet';

type FbTile = HTMLImageElement & { _fb?: { x: number; y: number; z: number; k: number } };
/* Méthodes internes de L.TileLayer (non typées par @types/leaflet). */
type Internals = {
  options: L.TileLayerOptions;
  getTileSize(): L.Point;
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement;
  _url: string;
  _getZoomForUrl(): number;
  _getSubdomain(c: { x: number; y: number }): string;
  _tileOnError(done: L.DoneCallback, tile: HTMLElement, e: Error): void;
};

const MAX_LEVELS = 5;
const proto = L.TileLayer.prototype as unknown as Internals & { __shoneyaFallback?: boolean };

if (!proto.__shoneyaFallback) {
  proto.__shoneyaFallback = true;
  const origCreate = proto.createTile;
  const origErr = proto._tileOnError;

  proto.createTile = function (this: Internals, coords: L.Coords, done: L.DoneCallback) {
    const t = origCreate.call(this, coords, done) as FbTile;
    t._fb = { x: coords.x, y: coords.y, z: this._getZoomForUrl(), k: 0 };
    return t;
  };

  proto._tileOnError = function (this: Internals, done: L.DoneCallback, tile: HTMLElement, e: Error) {
    const img = tile as FbTile;
    const f = img._fb;
    if (!f || f.k >= MAX_LEVELS || f.z - f.k - 1 < 1) return origErr.call(this, done, tile, e);
    f.k += 1;
    const n = 1 << f.k;
    const size = this.getTileSize();
    const px = Math.floor(f.x / n), py = Math.floor(f.y / n);
    const ox = (f.x - px * n) * size.x, oy = (f.y - py * n) * size.y;
    const W = size.x * n, H = size.y * n;
    img.style.width = `${W}px`;
    img.style.height = `${H}px`;
    img.style.marginLeft = `${-ox}px`;
    img.style.marginTop = `${-oy}px`;
    img.style.clipPath = `inset(${oy}px ${W - ox - size.x}px ${H - oy - size.y}px ${ox}px)`;
    img.src = L.Util.template(this._url, { ...this.options, s: this._getSubdomain({ x: px, y: py }), x: px, y: py, z: f.z - f.k });
  };
}

export {};

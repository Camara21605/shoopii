/**
 * Document HTML de la carte (Leaflet) affiché dans la WebView de MapView.tsx —
 * même rendu que la carte du site (ActorMapExplorer.tsx) :
 *   - fonds sans clé d'API : « Plan » (vue d'ensemble Esri gris + routes de
 *     loin, OpenStreetMap France de près) et « Satellite » (Esri + routes) ;
 *   - noms des pays, villes, communes, quartiers, villages (PlaceLabels du
 *     site), anti-chevauchement recalculé à chaque déplacement ;
 *   - épingles rouges des acteurs (pointillés = position approximative),
 *     épingle indigo du lieu choisi, point bleu « vous », cercles de rayon,
 *     tracé de l'itinéraire.
 *
 * Pont avec l'application :
 *   app → carte : window.__shoneya({ type, ... })  (injectJavaScript)
 *   carte → app : window.ReactNativeWebView.postMessage(JSON)  — ready, select, tap, error
 * La carte ne décide rien : elle affiche l'état envoyé par l'écran, et
 * signale les touchers. Toute la logique (recherche, sélection) reste côté app.
 */

export function buildMapHtml(center: { lat: number; lng: number }, zoom = 13): string {
  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E9ECEF; }
  .leaflet-control-attribution { font-size: 9px; }
  .leaflet-container { font-family: -apple-system, system-ui, Roboto, sans-serif; -webkit-tap-highlight-color: transparent; }

  /* Épingle rouge — acteur */
  .pin { position: relative; width: 38px; height: 46px; }
  .pin b {
    position: absolute; left: 3px; top: 0; width: 32px; height: 32px; box-sizing: border-box;
    background: #E11D48; border: 2.5px solid #fff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
    box-shadow: 0 4px 10px rgba(190,18,60,.45); display: flex; align-items: center; justify-content: center;
    transition: transform .2s ease, box-shadow .2s;
  }
  .pin b > span { transform: rotate(45deg); font-size: 15px; line-height: 1; }
  .pin i { position: absolute; left: 50%; bottom: 2px; width: 8px; height: 8px; margin-left: -4px; background: #9F1239; border-radius: 50%; opacity: .55; }
  .pin.approx b { background: rgba(225,29,72,.88); border-style: dashed; }
  .pin.sel b { transform: rotate(-45deg) scale(1.22); box-shadow: 0 8px 18px rgba(190,18,60,.6); }
  .pin.sel::before {
    content: ''; position: absolute; left: 50%; bottom: -6px; width: 16px; height: 16px; margin-left: -8px;
    border-radius: 50%; background: rgba(225,29,72,.45); animation: pulse 1.6s ease-out infinite;
  }
  .pin.drop { animation: drop .45s cubic-bezier(.2,.9,.3,1.3) both; }
  @keyframes pulse { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(4.2); opacity: 0; } }
  @keyframes drop { from { transform: translateY(-26px); opacity: 0; } to { transform: none; opacity: 1; } }

  /* Épingle indigo — lieu choisi */
  .ppin { position: relative; width: 36px; height: 44px; }
  .ppin b {
    position: absolute; left: 2px; top: 0; width: 32px; height: 32px; box-sizing: border-box; background: #1F1F1F;
    border: 2.5px solid #fff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 10px rgba(49,46,129,.5);
  }
  .ppin b::after { content: ''; position: absolute; left: 9px; top: 9px; width: 9px; height: 9px; border-radius: 50%; background: #fff; }

  /* Point bleu — vous */
  .me { width: 18px; height: 18px; border-radius: 50%; background: #1F1F1F; border: 3px solid #fff; box-sizing: border-box; box-shadow: 0 0 0 2px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.3); }

  /* Itinéraire façon Google Maps : point bleu avec cône de direction, épingle rouge d'arrivée */
  .gme { position: relative; width: 90px; height: 90px; }
  .gme .cone { position: absolute; left: 0; top: 0; width: 90px; height: 90px; transform-origin: 50% 50%; border-radius: 50%;
    background: conic-gradient(from -35deg, rgba(26,115,232,.62), rgba(26,115,232,.62) 70deg, transparent 70deg);
    -webkit-mask: radial-gradient(circle, #000 0, rgba(0,0,0,.85) 30%, transparent 70%); mask: radial-gradient(circle, #000 0, rgba(0,0,0,.85) 30%, transparent 70%); }
  .gme .dot { position: absolute; left: 35px; top: 35px; width: 20px; height: 20px; border-radius: 50%; background: #1A73E8;
    border: 3px solid #fff; box-sizing: border-box; box-shadow: 0 1px 6px rgba(0,0,0,.35); }
  .gme.nav .dot { left: 32px; top: 32px; width: 26px; height: 26px; }
  .gdest { position: relative; width: 30px; height: 42px; }
  .gdest svg { width: 30px; height: 42px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }

  /* Noms des lieux */
  .lblw { background: none; border: none; }
  .lbl {
    position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 2px;
    white-space: nowrap; pointer-events: none; line-height: 1.15; color: #1F2937;
    text-shadow: -2px -2px 0 #fff, 0 -2px 0 #fff, 2px -2px 0 #fff, 2px 0 0 #fff, 2px 2px 0 #fff, 0 2px 0 #fff, -2px 2px 0 #fff, -2px 0 0 #fff, 0 0 6px #fff;
  }
  .lbl.dark { color: #F9FAFB; text-shadow: -2px -2px 0 #000, 0 -2px 0 #000, 2px -2px 0 #000, 2px 0 0 #000, 2px 2px 0 #000, 0 2px 0 #000, -2px 2px 0 #000, -2px 0 0 #000, 0 0 6px rgba(0,0,0,.9); }
  .lbl.p { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; color: #6B7280; }
  .lbl.c { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #111827; }
  .lbl.t { font-size: 13.5px; font-weight: 700; }
  .lbl.s { font-size: 12.5px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; color: #404040; }
  .lbl.q { font-size: 12.5px; font-weight: 700; color: #404040; }
  .lbl.v { font-size: 11.5px; font-weight: 600; color: #4B5563; }
  .lbl.dark.p, .lbl.dark.c, .lbl.dark.s, .lbl.dark.q, .lbl.dark.v { color: #F9FAFB; }
  .lbl.active { color: #1F1F1F; }
  .lbl.dark.active { color: rgba(0,0,0,0.12); }
  .lbl em { width: 7px; height: 7px; border-radius: 50%; background: #5F6368; border: 1.5px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.25); }

  #err { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; text-align: center; padding: 24px; color: #6B6B6B; font-size: 14px; }
</style>
</head><body>
<div id="map"></div>
<div id="err">Carte indisponible — vérifiez votre connexion.</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="document.getElementById('err').style.display='flex';send({type:'error'})"></script>
<script>
function send(m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} }

(function () {
  if (!window.L) return;

  var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
  var OVERVIEW_MAX = 13;
  var HD = (window.devicePixelRatio || 1) > 1;
  /* Fonds SANS TEXTE : sur écran haute densité, 4 tuiles du zoom suivant à demi-taille = net */
  function hd(opts) { return HD ? Object.assign({}, opts, { tileSize: 128, zoomOffset: 1, maxNativeZoom: opts.maxNativeZoom ? opts.maxNativeZoom - 1 : undefined }) : opts; }

  var map = L.map('map', { zoomControl: false, attributionControl: true, center: [${center.lat}, ${center.lng}], zoom: ${zoom}, maxZoom: 19 });
  map.attributionControl.setPrefix('');

  var planLayers = [
    L.tileLayer(ESRI + '/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', hd({ maxZoom: OVERVIEW_MAX, attribution: 'Fond © Esri', zIndex: 1 })),
    L.tileLayer(ESRI + '/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', hd({ maxZoom: OVERVIEW_MAX, zIndex: 2 })),
    L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
      minZoom: OVERVIEW_MAX + 1, maxNativeZoom: 19, maxZoom: 20, subdomains: 'abc', zIndex: 1,
      attribution: '© OpenStreetMap contributors · OSM France',
    }),
  ];
  var satLayers = [
    L.tileLayer(ESRI + '/World_Imagery/MapServer/tile/{z}/{y}/{x}', hd({ maxNativeZoom: 18, maxZoom: 19, attribution: 'Imagerie © Esri, Maxar', zIndex: 1 })),
    L.tileLayer(ESRI + '/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', hd({ maxNativeZoom: 18, maxZoom: 19, zIndex: 2 })),
  ];

  var style = null;
  function setStyle(s) {
    if (s === style) return;
    style = s;
    (s === 'satellite' ? planLayers : satLayers).forEach(function (l) { map.removeLayer(l); });
    (s === 'satellite' ? satLayers : planLayers).forEach(function (l) { l.addTo(map); });
    drawLabels();
  }

  /* ── Noms des lieux (même logique que PlaceLabels.tsx du site) ── */
  var LABELS = [];
  var MIN_ZOOM = { p: 4, c: 6, t: 9, s: 11, q: 13, v: 12 }, MAX_ZOOM = { p: 9 };
  var FONT = { p: 14, c: 15, t: 13.5, s: 12.5, q: 12.5, v: 11.5 };
  var ORDER = ['p', 'c', 't', 's', 'q', 'v'];
  map.createPane('labels').style.zIndex = 450;
  map.getPane('labels').style.pointerEvents = 'none';
  var labelGroup = L.layerGroup().addTo(map);
  var labelsOn = true, activePlace = null;
  function fold(s) { return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase(); }

  function drawLabels() {
    labelGroup.clearLayers();
    if (!labelsOn || !LABELS.length) return;
    var zoom = map.getZoom(), bounds = map.getBounds().pad(0.15), taken = [];
    var tone = style === 'satellite' ? ' dark' : '';
    var act = activePlace ? fold(activePlace) : null;
    for (var o = 0; o < ORDER.length; o++) {
      var k = ORDER[o];
      if (zoom < MIN_ZOOM[k] || zoom > (MAX_ZOOM[k] || 99)) continue;
      var fs = FONT[k], upper = k === 'p' || k === 'c' || k === 's';
      for (var i = 0; i < LABELS.length; i++) {
        var l = LABELS[i];
        if (l[1] !== k || !bounds.contains([l[2], l[3]])) continue;
        var pt = map.latLngToContainerPoint([l[2], l[3]]);
        var w = l[0].length * fs * (upper ? 0.78 : 0.6) + 20, h = fs + (k === 'c' || k === 't' ? 24 : 12);
        var box = [pt.x - w / 2, pt.y - h / 2, pt.x + w / 2, pt.y + h / 2];
        var hit = false;
        for (var j = 0; j < taken.length; j++) { var b = taken[j]; if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) { hit = true; break; } }
        if (hit) continue;
        taken.push(box);
        var dot = (k === 'c' || k === 't') ? '<em></em>' : '';
        var cls = 'lbl ' + k + tone + (act && fold(l[0]) === act ? ' active' : '');
        L.marker([l[2], l[3]], { pane: 'labels', interactive: false, keyboard: false,
          icon: L.divIcon({ className: 'lblw', iconSize: [0, 0], html: '<div class="' + cls + '">' + dot + '<span>' + escapeHtml(l[0]) + '</span></div>' }) }).addTo(labelGroup);
      }
    }
  }
  map.on('moveend zoomend', drawLabels);

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ── Calques dynamiques : épingles, lieu, vous, cercles, itinéraire ── */
  var EMOJI = { vendor: '🏪', delivery: '🛵', correspondent: '📦' };
  var APPROX_M = { quartier: 600, commune: 1500, ville: 4000 };
  var actorLayer = L.layerGroup().addTo(map);
  var overlay = L.layerGroup().addTo(map);
  var markers = {};
  var lastKeys = '';

  function pinIcon(a, sel, isNew) {
    return L.divIcon({
      className: '', iconSize: [38, 46], iconAnchor: [19, 44],
      html: '<div class="pin' + (sel ? ' sel' : '') + (a.approx ? ' approx' : '') + (isNew ? ' drop' : '') + '"' + (a.dim ? ' style="opacity:.45;filter:grayscale(1)"' : '') + '><b><span>' + escapeHtml(a.emoji || EMOJI[a.role]) + '</span></b><i></i></div>',
    });
  }

  function render(s) {
    if (s.style) setStyle(s.style);
    if (s.labelsOn !== labelsOn || s.activePlace !== activePlace) { labelsOn = s.labelsOn; activePlace = s.activePlace; drawLabels(); }

    /* Épingles : recréées seulement si la liste change (sinon simple mise à jour de l'icône sélectionnée) */
    var keys = s.actors.map(function (a) { return a.key; }).join(',');
    var fresh = keys !== lastKeys;
    if (fresh) { actorLayer.clearLayers(); markers = {}; lastKeys = keys; }
    s.actors.forEach(function (a) {
      var sel = a.key === s.selectedKey;
      if (!markers[a.key]) {
        var m = L.marker([a.lat, a.lng], { icon: pinIcon(a, sel, true), zIndexOffset: sel ? 1000 : 0 });
        m.on('click', function () { send({ type: 'select', key: a.key }); });
        m.addTo(actorLayer);
        markers[a.key] = { m: m, a: a, sel: sel };
      } else if (markers[a.key].sel !== sel) {
        markers[a.key].m.setIcon(pinIcon(a, sel, false));
        markers[a.key].m.setZIndexOffset(sel ? 1000 : 0);
        markers[a.key].sel = sel;
      }
    });

    overlay.clearLayers();
    if (s.place) {
      L.marker([s.place.lat, s.place.lng], { interactive: false, zIndexOffset: 500,
        icon: L.divIcon({ className: '', iconSize: [36, 44], iconAnchor: [18, 42], html: '<div class="ppin"><b></b></div>' }) }).addTo(overlay);
    }
    var g = !!s.directions;   /* écran Itinéraire : rendu façon Google Maps */
    if (s.dest) {
      L.marker([s.dest.lat, s.dest.lng], { interactive: false, zIndexOffset: 600,
        icon: L.divIcon({ className: '', iconSize: [30, 42], iconAnchor: [15, 41], html: '<div class="gdest"><svg viewBox="0 0 30 42"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 42 15 42s15-16.1 15-27.2C30 6.6 23.3 0 15 0z" fill="#EA4335"/><circle cx="15" cy="15" r="5.5" fill="#A50E0E"/></svg></div>' }) }).addTo(overlay);
    }
    if (s.me) {
      if (s.me.acc && s.me.acc < 2000) L.circle([s.me.lat, s.me.lng], { radius: s.me.acc, color: g ? '#1A73E8' : '#1F1F1F', weight: 1, fillColor: g ? '#1A73E8' : '#1F1F1F', fillOpacity: g ? .12 : .08, interactive: false }).addTo(overlay);
      var hasHeading = g && typeof s.me.heading === 'number' && !isNaN(s.me.heading);
      var meHtml = g
        ? '<div class="gme' + (s.directions === 'nav' ? ' nav' : '') + '">' + (hasHeading ? '<div class="cone" style="transform:rotate(' + Math.round(s.me.heading) + 'deg)"></div>' : '') + '<div class="dot"></div></div>'
        : '<div class="me"></div>';
      L.marker([s.me.lat, s.me.lng], { interactive: false, zIndexOffset: 700,
        icon: L.divIcon({ className: '', iconSize: g ? [90, 90] : [18, 18], iconAnchor: g ? [45, 45] : [9, 9], html: meHtml }) }).addTo(overlay);
    }
    if (s.radius) {
      L.circle([s.radius.lat, s.radius.lng], { radius: s.radius.km * 1000, color: s.radius.color, weight: 1.5, dashArray: '6 6', fillColor: s.radius.color, fillOpacity: .05, interactive: false }).addTo(overlay);
    }
    var selA = s.actors.find(function (a) { return a.key === s.selectedKey; });
    if (selA && selA.approx) {
      L.circle([selA.lat, selA.lng], { radius: APPROX_M[selA.precision] || 1500, color: '#E11D48', weight: 1.5, dashArray: '5 6', fillColor: '#E11D48', fillOpacity: .08, interactive: false }).addTo(overlay);
    }
    if (s.route && s.route.length > 1) {
      if (g) {
        /* Bleu Google, bordure plus foncée ; tracé en pointillés quand ce n'est qu'une ligne droite */
        L.polyline(s.route, { color: '#1967D2', weight: 9, opacity: 1, interactive: false, dashArray: s.routeApprox ? '2 12' : null, lineCap: 'round' }).addTo(overlay);
        L.polyline(s.route, { color: '#4285F4', weight: 6, opacity: 1, interactive: false, dashArray: s.routeApprox ? '2 12' : null, lineCap: 'round' }).addTo(overlay);
      } else {
        L.polyline(s.route, { color: '#fff', weight: 8, opacity: .9, interactive: false }).addTo(overlay);
        L.polyline(s.route, { color: '#E11D48', weight: 5, opacity: .95, interactive: false }).addTo(overlay);
      }
    }
  }

  /* ── Caméra ── */
  function camera(c) {
    if (c.kind === 'fly') map.flyTo([c.lat, c.lng], c.zoom, { duration: .7 });
    else if (c.kind === 'follow') map.setView([c.lat, c.lng], c.zoom || map.getZoom(), { animate: true, duration: .8 });
    else if (c.kind === 'fit' && c.points.length) {
      if (c.points.length === 1) map.flyTo(c.points[0], c.zoom || 16, { duration: .7 });
      else map.flyToBounds(L.latLngBounds(c.points), { paddingTopLeft: [40, c.padTop || 40], paddingBottomRight: [40, c.padBottom || 40], maxZoom: 16, duration: .7 });
    } else if (c.kind === 'zoom') { map.setZoom(map.getZoom() + c.delta); }
  }

  /* L'utilisateur déplace la carte lui-même : l'écran arrête de suivre sa position (bouton « Recentrer »). */
  map.on('dragstart', function () { send({ type: 'drag' }); });
  /* Centre de la carte après chaque déplacement (épingle fixe au centre : position de la boutique). */
  map.on('moveend', function () { var c = map.getCenter(); send({ type: 'move', lat: c.lat, lng: c.lng, zoom: map.getZoom() }); });

  /* Toucher la carte : position touchée (placer une épingle, ex. position du dépôt) */
  map.on('click', function (e) { send({ type: 'tap', lat: e.latlng.lat, lng: e.latlng.lng }); });

  window.__shoneya = function (msg) {
    try {
      if (msg.type === 'labels') { LABELS = msg.data; drawLabels(); }
      else if (msg.type === 'state') render(msg);
      else if (msg.type === 'camera') camera(msg);
    } catch (e) { send({ type: 'log', message: String(e) }); }
  };

  setStyle('plan');
  send({ type: 'ready' });
  (function () { var c = map.getCenter(); send({ type: 'move', lat: c.lat, lng: c.lng, zoom: map.getZoom() }); })();
})();
</script>
</body></html>`;
}

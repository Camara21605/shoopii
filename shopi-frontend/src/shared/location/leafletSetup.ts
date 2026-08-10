/* ============================================================
 * FICHIER : src/shared/location/leafletSetup.ts
 *
 * RÔLE : Point d'import UNIQUE pour "leaflet" côté app. Réexporte L tel
 * quel et applique une seule fois le correctif d'URLs d'icônes (Vite ne
 * résout pas les images référencées par le CSS de Leaflet).
 *
 * POURQUOI UN SEUL POINT D'IMPORT : ce correctif était auparavant dupliqué
 * dans LocationMap.tsx, OrderTrackingMap.tsx et BoutiquePreviewPage.tsx —
 * chacun avec son propre `import L from 'leaflet'`. "leaflet" est un
 * module UMD/CommonJS (pas de vrai export ESM) ; le multiplier sur
 * plusieurs points d'entrée fait dépendre le bundler (Rolldown) d'un
 * interop CJS→ESM répété à travers plusieurs chunks différents — c'est
 * exactement ce qui a cassé en production ("… is not a function" dans le
 * chunk LocationMap alors que tout fonctionnait en dev). Un seul point
 * d'import réduit ce risque à une seule frontière CJS/ESM au lieu de
 * trois indépendantes.
 * ============================================================ */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default L;

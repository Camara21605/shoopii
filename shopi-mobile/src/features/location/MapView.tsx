/**
 * Carte Leaflet dans une WebView (voir map-html.ts) — pourquoi pas
 * react-native-maps : sur Android il exige une clé Google Maps, donc un
 * compte de facturation Google (carte bancaire internationale requise,
 * indisponible pour le projet). Ici : mêmes tuiles sans clé, mêmes épingles et
 * mêmes noms de lieux que la carte du site, et react-native-webview est déjà
 * inclus dans Expo Go (testable sans rebuild).
 *
 * Déclaratif : l'écran passe l'état complet en props, il est renvoyé à la
 * carte à chaque changement. Les mouvements de caméra (cadrer, voler vers…)
 * sont des commandes ponctuelles, via la ref (camera()).
 */
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { GUINEA_LABELS } from './guinea-labels';
import { buildMapHtml } from './map-html';
import type { MapActor } from './api';

export type MapStyleId = 'plan' | 'satellite';

export interface MapState {
  /** emoji : icône à la place de celle du rôle (ex. zone de livraison) ; dim : épingle grisée (zone non disponible). */
  actors: (Pick<MapActor, 'role' | 'lat' | 'lng' | 'approx' | 'precision'> & { key: string; emoji?: string; dim?: boolean })[];
  selectedKey: string | null;
  /** heading : direction du téléphone en degrés (cône bleu, écran Itinéraire). */
  me: { lat: number; lng: number; acc?: number | null; heading?: number | null } | null;
  /** Écran Itinéraire : rendu façon Google Maps ('preview' = aperçu, 'nav' = guidage en cours). */
  directions?: 'preview' | 'nav' | null;
  /** Épingle rouge d'arrivée (écran Itinéraire). */
  dest?: { lat: number; lng: number } | null;
  /** Tracé approximatif (ligne droite) : affiché en pointillés. */
  routeApprox?: boolean;
  place: { lat: number; lng: number } | null;
  /** Nom du lieu choisi — mis en évidence parmi les noms de la carte. */
  activePlace: string | null;
  radius: { lat: number; lng: number; km: number; color: string } | null;
  route: [number, number][] | null;
  style: MapStyleId;
  labelsOn: boolean;
}

export type CameraCommand =
  { kind: 'fly'; lat: number; lng: number; zoom: number } | { kind: 'follow'; lat: number; lng: number; zoom?: number } | { kind: 'fit'; points: [number, number][]; zoom?: number; padTop?: number; padBottom?: number } | { kind: 'zoom'; delta: number };

export interface MapViewHandle {
  camera: (c: CameraCommand) => void;
}

/* Pays voisins + référentiel des lieux, préparés une fois : doublons OSM/Shoneya
 * retirés (on garde la position OSM, celle des tuiles) — même règle que le site. */
const COUNTRIES: [string, number, number][] = [
  ['Guinée', 10.45, -11.3],
  ['Sénégal', 13.9, -14.6],
  ['Mali', 12.9, -8.6],
  ['Guinée-Bissau', 11.95, -15.0],
  ['Sierra Leone', 8.6, -11.8],
  ['Libéria', 6.7, -9.5],
  ["Côte d'Ivoire", 8.2, -6.4],
];
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
let preparedLabels: [string, string, number, number][] | null = null;
function labels() {
  if (preparedLabels) return preparedLabels;
  const osmKeys = new Set(GUINEA_LABELS.filter((l) => l[4] === 1).map((l) => `${l[1]}|${fold(l[0])}`));
  const out: [string, string, number, number][] = COUNTRIES.map(([n, la, ln]) => [n, 'p', la, ln]);
  for (const [name, kind, lat, lng, osm] of GUINEA_LABELS) {
    if (osm === 0 && osmKeys.has(`${kind}|${fold(name)}`)) continue;
    out.push([name, kind, lat, lng]);
  }
  preparedLabels = out;
  return out;
}

interface Props {
  state: MapState;
  initialCenter: { lat: number; lng: number };
  onSelect: (key: string) => void;
  /** Toucher la carte hors épingle, avec la position touchée. */
  onTap?: (at: { lat: number; lng: number }) => void;
  onError?: () => void;
  /** L'utilisateur fait glisser la carte. */
  onDrag?: () => void;
  /** Centre de la carte après chaque déplacement (et à l'ouverture). */
  onMoveEnd?: (center: { lat: number; lng: number }) => void;
  /** Zoom d'ouverture (13 par défaut). */
  initialZoom?: number;
  ref?: Ref<MapViewHandle>;
}

export function MapView({ state, initialCenter, initialZoom, onSelect, onTap, onError, onDrag, onMoveEnd, ref }: Props) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  /* Le document n'est construit qu'une fois : changer de centre ne doit pas recharger la carte. */
  const [html] = useState(() => buildMapHtml(initialCenter, initialZoom));

  const post = (msg: object) => {
    webRef.current?.injectJavaScript(`window.__shoneya && window.__shoneya(${JSON.stringify(msg)});true;`);
  };

  useImperativeHandle(ref, () => ({ camera: (c: CameraCommand) => post({ type: 'camera', ...c }) }), []);

  useEffect(() => {
    if (!ready) return;
    post({ type: 'state', ...state });
  }, [ready, state]);

  function onMessage(e: WebViewMessageEvent) {
    let msg: { type: string; key?: string; lat?: number; lng?: number };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      post({ type: 'labels', data: labels() });
      setReady(true);
    } else if (msg.type === 'select' && msg.key) onSelect(msg.key);
    else if (msg.type === 'tap') onTap?.({ lat: msg.lat ?? 0, lng: msg.lng ?? 0 });
    else if (msg.type === 'error') onError?.();
    else if (msg.type === 'drag') onDrag?.();
    else if (msg.type === 'move' && msg.lat != null && msg.lng != null) onMoveEnd?.({ lat: msg.lat, lng: msg.lng });
  }

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        /* baseUrl : les serveurs de tuiles voient une origine normale (Referer du site) */
        source={{ html, baseUrl: 'https://www.shoneya.com' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        overScrollMode="never"
        bounces={false}
        style={styles.web}
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#E9ECEF' },
});

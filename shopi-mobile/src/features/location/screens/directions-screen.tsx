/**
 * Itinéraire — comme Google Maps, dans l'appli :
 *
 *   APERÇU   carte plein écran (Plan / Satellite), point bleu avec cône de
 *            direction, épingle rouge d'arrivée, tracé bleu par les routes ;
 *            en haut « Votre position → destination » (⇅ inverse le sens) ;
 *            en bas : Voiture / Moto / À pied avec leur durée, « 12 min (3,4 km) »,
 *            Démarrer · Étapes · Partager · Google Maps.
 *   GUIDAGE  « Démarrer » : la carte suit le téléphone, bandeau vert de la
 *            prochaine manœuvre (« Dans 200 m, tournez à droite sur … »),
 *            temps restant, distance et heure d'arrivée ; itinéraire recalculé
 *            si l'on quitte la route ; écran maintenu allumé ; « Vous êtes arrivé ».
 *
 * Itinéraire calculé par le serveur (POST /location/route, par les routes) ;
 * s'il n'est pas joignable, tracé direct en pointillés, signalé comme tel.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQuery } from '@tanstack/react-query';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { qk } from '@/lib/query-keys';

import { fetchRoute, type RouteManeuver, type RouteProfile, type RouteResult } from '../api';
import { MapView, type MapState, type MapStyleId, type MapViewHandle } from '../MapView';
import { fmtDistance, fmtDuration, fmtEta, haversine, prepareRoute, progress, type LatLng } from '../nav-math';

const G = {
  blue: '#1A73E8',
  teal: '#0B6E73',
  tealSoft: '#D5EFF1',
  green: '#188038',
  navGreen: '#0F6B3A',
  red: '#D93025',
  text: '#202124',
  sub: '#5F6368',
  line: '#E0E0E0',
  chip: '#F1F3F4',
};

type MIcon = React.ComponentProps<typeof MaterialIcons>['name'];

const MODES: { id: RouteProfile; label: string; icon: MIcon; gmaps: string }[] = [
  { id: 'car', label: 'Voiture', icon: 'directions-car', gmaps: 'driving' },
  { id: 'moto', label: 'Moto', icon: 'two-wheeler', gmaps: 'two-wheeler' },
  { id: 'foot', label: 'À pied', icon: 'directions-walk', gmaps: 'walking' },
];

const MANEUVER_ICON: Record<RouteManeuver, MIcon> = {
  depart: 'navigation', arrive: 'flag', straight: 'straight',
  left: 'turn-left', right: 'turn-right', 'slight-left': 'turn-slight-left', 'slight-right': 'turn-slight-right',
  'sharp-left': 'turn-sharp-left', 'sharp-right': 'turn-sharp-right', uturn: 'u-turn-left',
  roundabout: 'roundabout-right', 'keep-left': 'fork-left', 'keep-right': 'fork-right',
};

/** Clé de départ arrondie (~110 m) : on ne recalcule pas l'itinéraire à chaque pas. */
const roundKey = (p: LatLng) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
const OFF_ROUTE_M = 50;
const ARRIVED_M = 30;

export default function DirectionsScreen() {
  const params = useLocalSearchParams<{ lat: string; lng: string; name?: string; address?: string }>();
  const dest: LatLng | null = useMemo(() => {
    const lat = Number(params.lat), lng = Number(params.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }, [params.lat, params.lng]);
  const destName = params.name?.trim() || 'Destination';
  const destAddress = params.address?.trim() || '';

  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapViewHandle>(null);

  /* ── Position et direction du téléphone ── */
  const [me, setMe] = useState<{ p: LatLng; acc: number | null; course: number | null; speed: number } | null>(null);
  const [compass, setCompass] = useState<number | null>(null);
  const [geo, setGeo] = useState<'asking' | 'ok' | 'denied'>('asking');
  /* Départ de l'itinéraire : première position reçue, puis position au moment d'un recalcul. */
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [rerouteNonce, setRerouteNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    let posSub: Location.LocationSubscription | null = null;
    let headSub: Location.LocationSubscription | null = null;
    void (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!alive) return;
      if (!perm.granted) { setGeo('denied'); return; }
      setGeo('ok');
      posSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3, timeInterval: 1500 },
        (l) => {
          const p: LatLng = [l.coords.latitude, l.coords.longitude];
          /* Départ de l'itinéraire : la première position reçue (pas recalculé à chaque pas). */
          setOrigin((o) => o ?? p);
          setMe({
          p,
          acc: l.coords.accuracy ?? null,
          course: l.coords.heading != null && l.coords.heading >= 0 ? l.coords.heading : null,
          speed: l.coords.speed ?? 0,
          });
        },
      );
      try {
        headSub = await Location.watchHeadingAsync((h) => {
          const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          setCompass((old) => (old == null || Math.abs(((v - old + 540) % 360) - 180) > 4 ? v : old));
        });
      } catch { /* pas de boussole : cône d'après le déplacement seulement */ }
      if (!alive) { posSub?.remove(); headSub?.remove(); }
    })();
    return () => { alive = false; posSub?.remove(); headSub?.remove(); };
  }, []);

  /* En roulant, le cap GPS est plus fiable que la boussole. */
  const heading = me && me.speed > 1.5 && me.course != null ? me.course : compass;

  /* ── Itinéraires (les 3 modes, pour afficher leurs durées) ── */
  const [profile, setProfile] = useState<RouteProfile>('car');
  const [reversed, setReversed] = useState(false);
  /* Départ figé à la première position connue (puis à chaque recalcul en guidage). */
  const start = origin ?? me?.p ?? null;
  const fromKey = start ? `${roundKey(start)}#${rerouteNonce}` : '';
  const toKey = dest ? roundKey(dest) : '';

  const routeQuery = (p: RouteProfile) => ({
    queryKey: qk.directions(reversed ? toKey : fromKey, reversed ? fromKey : toKey, p),
    queryFn: () => {
      const a = { latitude: start![0], longitude: start![1] };
      const b = { latitude: dest![0], longitude: dest![1] };
      return reversed ? fetchRoute(b, a, p) : fetchRoute(a, b, p);
    },
    enabled: !!start && !!dest,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const qCar = useQuery(routeQuery('car'));
  const qMoto = useQuery(routeQuery('moto'));
  const qFoot = useQuery(routeQuery('foot'));
  const byMode: Record<RouteProfile, typeof qCar> = { car: qCar, moto: qMoto, foot: qFoot };
  const current = byMode[profile];
  const route: RouteResult | undefined = current.data;
  /* (mémorisé automatiquement par le React Compiler) */
  const prepared = route ? prepareRoute(route) : null;
  const approx = route?.provider === 'straight-line-fallback';

  /* ── Guidage ── */
  const [nav, setNav] = useState(false);
  const [follow, setFollow] = useState(true);
  const [style, setStyle] = useState<MapStyleId>('satellite');
  const [showSteps, setShowSteps] = useState(false);
  const prog = nav && prepared && me ? progress(prepared, me.p) : null;
  const arrived = nav && !!me && !!dest && haversine(me.p, dest) < ARRIVED_M;

  /* Écran allumé pendant le guidage */
  useEffect(() => {
    if (!nav) return;
    void activateKeepAwakeAsync('itineraire');
    return () => { void deactivateKeepAwake('itineraire'); };
  }, [nav]);

  /* La carte suit le téléphone pendant le guidage */
  useEffect(() => {
    if (nav && follow && me) mapRef.current?.camera({ kind: 'follow', lat: me.p[0], lng: me.p[1], zoom: 18 });
  }, [nav, follow, me]);

  /* Hors de la route plusieurs fois de suite → nouvel itinéraire depuis ici */
  const offCount = useRef(0);
  const lastReroute = useRef(0);
  useEffect(() => {
    if (!nav || !prog || !me || approx || arrived) return;
    offCount.current = prog.offRouteM > OFF_ROUTE_M ? offCount.current + 1 : 0;
    if (offCount.current >= 3 && Date.now() - lastReroute.current > 15_000) {
      offCount.current = 0;
      lastReroute.current = Date.now();
      setOrigin(me.p);
      setRerouteNonce((n) => n + 1);
    }
  }, [nav, prog, me, approx, arrived]);

  /* Cadrer tout le trajet en aperçu */
  const sheetH = 300 + insets.bottom;
  const fitted = useRef('');
  useEffect(() => {
    if (nav || !route || route.polyline.length < 2) return;
    const key = `${profile}|${reversed}|${route.totalDistanceM}`;
    if (fitted.current === key) return;
    fitted.current = key;
    mapRef.current?.camera({ kind: 'fit', points: route.polyline, padTop: 170 + insets.top, padBottom: sheetH + 30 });
  }, [route, nav, profile, reversed, insets.top, sheetH]);

  // ── Actions ──────────────────────────────────────────────
  function startNav() {
    if (!me) { Alert.alert('Position indisponible', 'Activez la localisation pour démarrer le guidage.'); return; }
    if (reversed) { setReversed(false); }
    setOrigin(me.p);
    setFollow(true);
    setShowSteps(false);
    setNav(true);
  }

  function stopNav() {
    setNav(false);
    fitted.current = '';
  }

  function recenter() {
    if (!me) return;
    setFollow(true);
    mapRef.current?.camera(nav ? { kind: 'follow', lat: me.p[0], lng: me.p[1], zoom: 18 } : { kind: 'fly', lat: me.p[0], lng: me.p[1], zoom: 17 });
  }

  function share() {
    if (!dest) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest[0]},${dest[1]}`;
    const eta = route ? ` — ${fmtDuration(route.totalDurationS)} (${fmtDistance(route.totalDistanceM)}) en ${MODES.find((m) => m.id === profile)!.label.toLowerCase()}` : '';
    void Share.share({ message: `Itinéraire vers ${destName}${eta}\n${url}` });
  }

  function openGoogleMaps() {
    if (!dest) return;
    const mode = MODES.find((m) => m.id === profile)!.gmaps;
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest[0]},${dest[1]}&travelmode=${mode}`);
  }

  // ── État de la carte ─────────────────────────────────────
  const mapState: MapState = {
    actors: [],
    selectedKey: null,
    me: me ? { lat: me.p[0], lng: me.p[1], acc: nav ? null : me.acc, heading } : null,
    place: null,
    activePlace: null,
    radius: null,
    route: route?.polyline ?? null,
    routeApprox: approx,
    dest: dest ? { lat: dest[0], lng: dest[1] } : null,
    directions: nav ? 'nav' : 'preview',
    style,
    labelsOn: true,
  };

  if (!dest) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ThemedText>Destination inconnue.</ThemedText>
        <Pressable onPress={() => router.back()} style={styles.linkBtn}><ThemedText style={styles.linkText}>Retour</ThemedText></Pressable>
      </View>
    );
  }

  const modeLabel = MODES.find((m) => m.id === profile)!.label;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        state={mapState}
        initialCenter={{ lat: dest[0], lng: dest[1] }}
        onSelect={() => undefined}
        onDrag={() => setFollow(false)}
      />

      {/* ── Haut : trajet (aperçu) ou prochaine manœuvre (guidage) ── */}
      {nav ? (
        <View style={[styles.navBanner, { top: insets.top + 8 }]}>
          {arrived ? (
            <View style={styles.navRow}>
              <MaterialIcons name="flag" size={40} color="#fff" />
              <View style={styles.flex}>
                <ThemedText style={styles.navBig}>Vous êtes arrivé</ThemedText>
                <ThemedText style={styles.navSmall} numberOfLines={1}>{destName}</ThemedText>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.navRow}>
                <MaterialIcons name={MANEUVER_ICON[prog?.next?.maneuver ?? 'straight']} size={44} color="#fff" />
                <View style={styles.flex}>
                  <ThemedText style={styles.navBig}>{prog ? fmtDistance(prog.toNextM) : '…'}</ThemedText>
                  <ThemedText style={styles.navText} numberOfLines={2}>
                    {approx ? `Direction ${destName}` : prog?.next?.text ?? `Continuez vers ${destName}`}
                  </ThemedText>
                </View>
              </View>
              {prog?.then && prog.toNextM < 400 && prog.then.maneuver !== 'arrive' ? (
                <View style={styles.thenRow}>
                  <ThemedText style={styles.thenText}>Puis</ThemedText>
                  <MaterialIcons name={MANEUVER_ICON[prog.then.maneuver]} size={20} color="#fff" />
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : (
        <View style={[styles.topCard, { top: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour" style={styles.topBack}>
            <Ionicons name="arrow-back" size={22} color={G.text} />
          </Pressable>
          <View style={styles.flex}>
            <View style={styles.wpRow}>
              {reversed ? <MaterialIcons name="place" size={18} color={G.red} /> : <View style={styles.blueDot} />}
              <ThemedText numberOfLines={1} style={[styles.wpText, !reversed && { color: G.blue }]}>{reversed ? destName : 'Votre position'}</ThemedText>
            </View>
            <View style={styles.wpDots}><View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /></View>
            <View style={[styles.wpRow, styles.wpSep]}>
              {reversed ? <View style={styles.blueDot} /> : <MaterialIcons name="place" size={18} color={G.red} />}
              <ThemedText numberOfLines={1} style={[styles.wpText, reversed && { color: G.blue }]}>
                {reversed ? 'Votre position' : destAddress ? `${destName}, ${destAddress}` : destName}
              </ThemedText>
            </View>
          </View>
          <Pressable onPress={() => setReversed((r) => !r)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Inverser le départ et l’arrivée" style={styles.swap}>
            <MaterialIcons name="swap-vert" size={24} color={G.text} />
          </Pressable>
        </View>
      )}

      {/* ── Boutons flottants ── */}
      <Pressable
        onPress={() => setStyle((s) => (s === 'satellite' ? 'plan' : 'satellite'))}
        accessibilityRole="button"
        accessibilityLabel={style === 'satellite' ? 'Afficher le plan' : 'Afficher le satellite'}
        style={[styles.fab, styles.fabLayers, { top: insets.top + (nav ? 150 : 140) }]}>
        <MaterialIcons name="layers" size={24} color={G.teal} />
      </Pressable>
      {nav && !follow ? (
        <Pressable onPress={recenter} accessibilityRole="button" style={[styles.recenterPill, { bottom: 120 + insets.bottom }]}>
          <MaterialIcons name="navigation" size={18} color={G.blue} />
          <ThemedText style={styles.recenterText}>Recentrer</ThemedText>
        </Pressable>
      ) : null}
      {!nav ? (
        <Pressable onPress={recenter} accessibilityRole="button" accessibilityLabel="Ma position" style={[styles.fab, styles.fabMe, { bottom: sheetH + 16 }]}>
          <MaterialIcons name="my-location" size={24} color={me ? G.blue : G.sub} />
        </Pressable>
      ) : null}

      {/* ── Bas : aperçu ou guidage ── */}
      {nav ? (
        <View style={[styles.navBottom, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={stopNav} accessibilityRole="button" accessibilityLabel="Quitter le guidage" style={styles.exitBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <View style={styles.flex}>
            <ThemedText style={styles.navEta}>{arrived ? 'Arrivé' : prog ? fmtDuration(prog.remainingS) : '…'}</ThemedText>
            <ThemedText style={styles.navEtaSub}>
              {prog && !arrived ? `${fmtDistance(prog.remainingM)} · arrivée ${fmtEta(prog.remainingS)}` : destName}
            </ThemedText>
          </View>
          <Pressable onPress={() => setShowSteps((v) => !v)} accessibilityRole="button" accessibilityLabel="Étapes" style={styles.stepsBtn}>
            <MaterialIcons name="list" size={26} color={G.text} />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grip} />
          <View style={styles.modes}>
            {MODES.map((m) => {
              const q = byMode[m.id];
              const on = m.id === profile;
              return (
                <Pressable key={m.id} onPress={() => setProfile(m.id)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={[styles.mode, on && styles.modeOn]}>
                  <MaterialIcons name={m.icon} size={18} color={on ? G.teal : G.sub} />
                  <ThemedText style={[styles.modeText, on && { color: G.teal }]}>
                    {q.data ? fmtDuration(q.data.totalDurationS) : q.isError ? '—' : m.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sheetHead}>
            <View style={styles.flex}>
              {geo === 'denied' ? (
                <>
                  <ThemedText style={styles.title}>Position désactivée</ThemedText>
                  <ThemedText style={styles.sub}>Autorisez la localisation pour calculer l’itinéraire.</ThemedText>
                </>
              ) : !start || current.isPending ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={G.teal} />
                  <ThemedText style={styles.sub}>{start ? 'Calcul de l’itinéraire…' : 'Recherche de votre position…'}</ThemedText>
                </View>
              ) : current.isError || !route ? (
                <>
                  <ThemedText style={styles.title}>Itinéraire indisponible</ThemedText>
                  <Pressable onPress={() => void current.refetch()}><ThemedText style={styles.linkText}>Réessayer</ThemedText></Pressable>
                </>
              ) : (
                <>
                  <ThemedText style={styles.title}>
                    <ThemedText style={[styles.title, { color: approx ? G.text : G.green }]}>{fmtDuration(route.totalDurationS)}</ThemedText>
                    <ThemedText style={styles.titleDist}> ({fmtDistance(route.totalDistanceM)})</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.sub} numberOfLines={2}>
                    {approx
                      ? 'Tracé direct : le détail des routes n’est pas disponible pour ce trajet.'
                      : `${modeLabel} · arrivée vers ${fmtEta(route.totalDurationS)}${profile === 'moto' ? ' · estimation moto' : ''}`}
                  </ThemedText>
                </>
              )}
            </View>
            <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer" style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={G.text} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
            <Pressable onPress={startNav} disabled={!route || reversed} accessibilityRole="button"
              style={({ pressed }) => [styles.startBtn, (!route || reversed) && styles.disabled, pressed && styles.pressed]}>
              <MaterialIcons name="navigation" size={20} color="#fff" />
              <ThemedText style={styles.startText}>Démarrer</ThemedText>
            </Pressable>
            {route && route.steps.length ? (
              <Chip icon="format-list-bulleted" label="Étapes" onPress={() => setShowSteps((v) => !v)} />
            ) : null}
            <Chip icon="share" label="Partager" onPress={share} />
            <Chip icon="map" label="Google Maps" onPress={openGoogleMaps} />
          </ScrollView>
          {reversed ? <ThemedText style={[styles.sub, styles.reversedNote]}>Aperçu du retour — le guidage part toujours de votre position.</ThemedText> : null}
        </View>
      )}

      {/* ── Liste des étapes ── */}
      {showSteps && route ? (
        <View style={[styles.stepsPanel, { top: insets.top + (nav ? 140 : 130), bottom: (nav ? 100 : sheetH) + insets.bottom }]}>
          <View style={styles.stepsHead}>
            <ThemedText style={styles.stepsTitle}>Étapes · {fmtDistance(route.totalDistanceM)}</ThemedText>
            <Pressable onPress={() => setShowSteps(false)} hitSlop={8}><Ionicons name="close" size={20} color={G.text} /></Pressable>
          </View>
          <ScrollView>
            {route.steps.map((s, i) => (
              <View key={`${i}-${s.text}`} style={styles.stepRow}>
                <MaterialIcons name={MANEUVER_ICON[s.maneuver]} size={22} color={G.sub} />
                <View style={styles.flex}>
                  <ThemedText style={styles.stepText}>{s.text}</ThemedText>
                  {s.distanceM > 0 ? <ThemedText style={styles.stepDist}>{fmtDistance(s.distanceM)}</ThemedText> : null}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function Chip({ icon, label, onPress }: { icon: MIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
      <MaterialIcons name={icon} size={18} color={G.teal} />
      <ThemedText style={styles.chipText}>{label}</ThemedText>
    </Pressable>
  );
}

const shadow = { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 5 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E9ECEF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#fff' },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },

  topCard: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 12, ...shadow },
  topBack: { padding: 4 },
  wpRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  wpSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: G.line },
  wpText: { flex: 1, fontSize: 16, color: G.text },
  wpDots: { marginLeft: 8, gap: 3, paddingVertical: 1 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: G.sub },
  blueDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: G.blue, borderWidth: 3, borderColor: '#D2E3FC' },
  swap: { padding: 6 },

  fab: { position: 'absolute', right: 14, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', ...shadow },
  fabLayers: { backgroundColor: '#C9EDF0' },
  fabMe: { backgroundColor: '#fff', borderRadius: 16 },
  recenterPill: { position: 'absolute', left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, ...shadow },
  recenterText: { color: G.blue, fontWeight: '700' },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 8, ...shadow },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADCE0', marginBottom: 10 },
  modes: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: G.chip },
  modeOn: { backgroundColor: G.tealSoft },
  modeText: { fontSize: 14, fontWeight: '600', color: G.sub },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, gap: 10, minHeight: 74 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: G.text },
  titleDist: { fontSize: 18, lineHeight: 30, fontWeight: '400', color: G.sub },
  sub: { fontSize: 14, lineHeight: 19, color: G.sub },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: G.chip, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: G.teal, borderRadius: 26, paddingHorizontal: 24, paddingVertical: 13 },
  startText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: G.tealSoft, borderRadius: 26, paddingHorizontal: 18, paddingVertical: 13 },
  chipText: { color: G.teal, fontSize: 15, fontWeight: '600' },
  reversedNote: { paddingHorizontal: 20, paddingBottom: 4 },
  linkBtn: { padding: 10 },
  linkText: { color: G.blue, fontWeight: '700', paddingTop: 4 },

  navBanner: { position: 'absolute', left: 10, right: 10, backgroundColor: G.navGreen, borderRadius: 18, padding: 16, ...shadow },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  navBig: { color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  navText: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '600' },
  navSmall: { color: 'rgba(255,255,255,.85)', fontSize: 15 },
  thenRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,.22)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  thenText: { color: '#fff', fontWeight: '600' },
  navBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 14, borderTopLeftRadius: 22, borderTopRightRadius: 22, ...shadow },
  exitBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: G.red, alignItems: 'center', justifyContent: 'center' },
  navEta: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: G.green },
  navEtaSub: { fontSize: 14, color: G.sub },
  stepsBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: G.chip, alignItems: 'center', justifyContent: 'center' },

  stepsPanel: { position: 'absolute', left: 12, right: 12, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingTop: 12, ...shadow },
  stepsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  stepsTitle: { fontSize: 16, fontWeight: '700', color: G.text },
  stepRow: { flexDirection: 'row', gap: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: G.line },
  stepText: { fontSize: 15, color: G.text },
  stepDist: { fontSize: 13, color: G.sub, marginTop: 2 },
});

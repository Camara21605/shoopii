/**
 * Localisation — retrouver une entreprise, un livreur ou un correspondant et
 * voir où il se trouve : un POINT ROUGE marque son emplacement. Même page que
 * le bouton 📍 du site (/mes-adresses → ActorMapExplorer.tsx), en natif :
 *
 *   - recherche à la frappe (nom, quartier, commune, ville — tolérante aux
 *     accents et fautes, côté serveur), filtres par type avec compteurs ;
 *   - LIEUX : les quartiers, communes et villes correspondant à la saisie —
 *     en choisir un vole dessus et liste ce qui se trouve autour ;
 *   - « Autour de moi » dans un rayon de 5 à 50 km (position du téléphone) ;
 *   - fiche de l'acteur choisi : quartier, ville, distance, note, disponibilité,
 *     précision de la position ; Voir le profil · Itinéraire (tracé sur la
 *     carte) · Partager · Ouvrir dans Maps ;
 *   - fonds Plan / Satellite, noms des lieux, « Ma position », zoom.
 *
 * Fond blanc, comme le reste de l'app ; la carte occupe tout l'écran, la liste
 * est un panneau en bas à trois hauteurs (réduit, normal, agrandi).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, LayoutAnimation, Linking, Pressable, ScrollView, Share,
  StyleSheet, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { openShop, openSite } from '@/features/catalog/open';
import {
  ALL_ROLES, fetchRoute, formatDistance, locatePlace,
  type MapActor, type MapActorRole, type MapPlace, type RouteResult,
} from '@/features/location/api';
import { useActorMapSearch, useMyPosition, usePlaceSuggestions } from '@/features/location/hooks';
import { MapView, type MapState, type MapStyleId, type MapViewHandle } from '@/features/location/MapView';
import { useTheme } from '@/hooks/use-theme';

const ROLE: Record<MapActorRole, { label: string; plural: string; emoji: string }> = {
  vendor:        { label: 'Entreprise',    plural: 'Entreprises',    emoji: '🏪' },
  delivery:      { label: 'Livreur',       plural: 'Livreurs',       emoji: '🛵' },
  correspondent: { label: 'Correspondant', plural: 'Correspondants', emoji: '📦' },
};
const RADII = [5, 10, 25, 50];
const PRECISION_LABEL: Record<MapActor['precision'], string> = {
  exact: 'Position exacte', quartier: 'Position approximative (quartier)',
  commune: 'Position approximative (commune)', ville: 'Position approximative (ville)',
};
/** Centre de Conakry — carte avant d'avoir la position du téléphone (même valeur que le site). */
const DEFAULT_CENTER = { lat: 9.537, lng: -13.6773 };

interface ActivePlace { name: string; label: string; lat: number; lng: number; kind: MapPlace['type'] | 'libre' }
const PLACE_ZOOM:   Record<ActivePlace['kind'], number> = { quartier: 16, commune: 14, ville: 12, libre: 16 };
const PLACE_RADIUS: Record<ActivePlace['kind'], number> = { quartier: 3, commune: 8, ville: 25, libre: 3 };

type Sheet = 'min' | 'mid' | 'max';

const keyOf = (a: Pick<MapActor, 'role' | 'id'>) => `${a.role}:${a.id}`;

function placeLine(a: MapActor): string {
  const q = a.quartier?.trim();
  const v = a.ville?.trim();
  if (q && v && q.toLowerCase() !== v.toLowerCase()) return `${q} · ${v}`;
  return q || v || a.localisation || '—';
}

export default function LocalisationScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const mapRef = useRef<MapViewHandle>(null);
  const geo = useMyPosition();
  const me = geo.position;

  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<MapActorRole[]>(ALL_ROLES);
  const [nearby, setNearby] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [selKey, setSelKey] = useState<string | null>(null);
  const [place, setPlace] = useState<ActivePlace | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyleId>('plan');
  const [labelsOn, setLabelsOn] = useState(true);
  /* Itinéraire rattaché à l'acteur pour lequel il a été tracé : sélectionner
   * quelqu'un d'autre le fait disparaître de lui-même (état dérivé, pas d'effet). */
  const [routeState, setRouteState] = useState<{ key: string; result: RouteResult } | null>(null);
  const [routing, setRouting] = useState(false);
  const [sheet, setSheet] = useState<Sheet>('mid');
  const [mapError, setMapError] = useState(false);

  /* Autour d'un lieu choisi, les distances se comptent depuis LE LIEU ; sinon depuis le téléphone */
  const origin = useMemo(() => (place ? { latitude: place.lat, longitude: place.lng } : me), [place, me]);
  const search = useActorMapSearch({ query, types, origin, nearby, radiusKm });
  const placeSuggestions = usePlaceSuggestions(query);
  const { results, meta } = search;
  const selected = useMemo(() => results.find(r => keyOf(r) === selKey) ?? null, [results, selKey]);
  const route = routeState && routeState.key === selKey ? routeState.result : null;
  const trimmed = query.trim();
  const idle = !trimmed && !nearby && !place;

  const sheetHeight = sheet === 'min' ? 86 + insets.bottom : sheet === 'mid' ? Math.round(winH * 0.4) : Math.round(winH * 0.72);
  const TOP_PANEL = 150;

  function changeSheet(next: Sheet) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSheet(next);
  }

  /* ── Caméra : nouveaux résultats → on cadre toutes les épingles ── */
  const resultsKey = results.map(keyOf).join(',');
  useEffect(() => {
    if (!results.length) return;
    mapRef.current?.camera({
      kind: 'fit', points: results.map(r => [r.lat, r.lng]), zoom: results[0].approx ? 14 : 16,
      padTop: TOP_PANEL, padBottom: sheetHeight + 20,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey]);

  /* Sélection → on vole vers l'épingle */
  useEffect(() => {
    if (selected) mapRef.current?.camera({ kind: 'fly', lat: selected.lat, lng: selected.lng, zoom: selected.approx ? 14 : 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  /* Lieu choisi → on vole dessus */
  useEffect(() => {
    if (place) mapRef.current?.camera({ kind: 'fly', lat: place.lat, lng: place.lng, zoom: PLACE_ZOOM[place.kind] });
  }, [place]);

  /* Première position connue : on centre dessus si l'écran n'affiche encore rien d'autre */
  const centeredOnMe = useRef(false);
  useEffect(() => {
    if (!me || centeredOnMe.current) return;
    centeredOnMe.current = true;
    if (idle) mapRef.current?.camera({ kind: 'fly', lat: me.latitude, lng: me.longitude, zoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // ── Actions ─────────────────────────────────────────────────

  function clearAll() {
    setQuery(''); setNearby(false); setSelKey(null); setRouteState(null); setPlace(null);
  }

  function toggleType(t: MapActorRole) {
    setTypes(cur => cur.includes(t) ? (cur.length > 1 ? cur.filter(x => x !== t) : cur) : [...cur, t]);
    setSelKey(null);
  }

  async function toggleNearby() {
    if (!nearby && !me) {
      const ok = await geo.request();
      if (!ok) {
        Alert.alert('Position indisponible', 'Autorisez la localisation pour voir ce qui se trouve autour de vous.');
        return;
      }
    }
    setPlace(null);
    setSelKey(null);
    setNearby(n => !n);
  }

  async function goToMe() {
    if (!me) {
      const ok = await geo.request();
      if (!ok) Alert.alert('Position indisponible', 'Autorisez la localisation pour vous situer sur la carte.');
      return; // la première position reçue recentre la carte (voir plus haut)
    }
    mapRef.current?.camera({ kind: 'fly', lat: me.latitude, lng: me.longitude, zoom: 16 });
  }

  async function goToPlace(input: { nom: string; type: MapPlace['type'] | 'libre'; commune?: string | null; ville?: string | null; label: string }) {
    setPlaceBusy(true);
    try {
      const pos = await locatePlace(input);
      if (!pos) { Alert.alert('Lieu introuvable', `Aucun lieu trouvé pour « ${input.nom} ».`); return; }
      setPlace({ name: input.nom, label: pos.label ?? input.label, lat: pos.lat, lng: pos.lng, kind: input.type });
      setQuery('');
      setSelKey(null);
      setRadiusKm(PLACE_RADIUS[input.type]);
      setNearby(true);
    } catch {
      Alert.alert('Erreur', 'Impossible de localiser ce lieu pour le moment.');
    } finally {
      setPlaceBusy(false);
    }
  }

  function select(a: MapActor) {
    setSelKey(keyOf(a));
    if (sheet === 'min') changeSheet('mid');
  }

  async function showRoute(a: MapActor) {
    if (!me) {
      const ok = await geo.request();
      Alert.alert(
        ok ? 'Localisation en cours' : 'Position indisponible',
        ok ? 'Réessayez dans un instant, le temps de trouver votre position.' : 'Autorisez la localisation pour tracer l’itinéraire.',
      );
      return;
    }
    setRouting(true);
    try {
      const r = await fetchRoute(me, { latitude: a.lat, longitude: a.lng });
      setRouteState({ key: keyOf(a), result: r });
      mapRef.current?.camera({ kind: 'fit', points: r.polyline, padTop: TOP_PANEL, padBottom: sheetHeight + 20 });
    } catch {
      Alert.alert('Itinéraire indisponible', 'Réessayez dans un instant.');
    } finally {
      setRouting(false);
    }
  }

  function openProfile(a: MapActor) {
    if (a.role === 'vendor') openShop(a.id);
    else openSite(a.profilePath);
  }

  function share(a: MapActor) {
    const url = `https://www.shoneya.com/mes-adresses?${new URLSearchParams({ q: a.name, focus: keyOf(a) })}`;
    void Share.share({ message: `${a.name} — ${ROLE[a.role].label} sur Shoneya\n${url}` });
  }

  function openInMaps(a: MapActor) {
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`);
  }

  // ── État envoyé à la carte ─────────────────────────────────────

  const mapState: MapState = useMemo(() => ({
    actors: results.map(r => ({ key: keyOf(r), role: r.role, lat: r.lat, lng: r.lng, approx: r.approx, precision: r.precision })),
    selectedKey: selKey,
    me: me ? { lat: me.latitude, lng: me.longitude, acc: geo.accuracy } : null,
    place: place ? { lat: place.lat, lng: place.lng } : null,
    activePlace: place?.name ?? null,
    radius: nearby && origin ? { lat: origin.latitude, lng: origin.longitude, km: radiusKm, color: place ? '#1F1F1F' : '#1F1F1F' } : null,
    route: route?.polyline ?? null,
    style: mapStyle,
    labelsOn,
  }), [results, selKey, me, geo.accuracy, place, nearby, origin, radiusKm, route, mapStyle, labelsOn]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* ── Carte plein écran ── */}
      <MapView
        ref={mapRef}
        state={mapState}
        initialCenter={me ? { lat: me.latitude, lng: me.longitude } : DEFAULT_CENTER}
        onSelect={key => { setSelKey(key); if (sheet === 'min') changeSheet('mid'); }}
        onTap={() => { if (sheet === 'max') changeSheet('mid'); }}
        onError={() => setMapError(true)}
      />
      {mapError ? (
        <View style={[styles.mapError, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="cloud-offline-outline" size={36} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.center}>Carte indisponible — vérifiez votre connexion.</ThemedText>
        </View>
      ) : null}

      {/* ── En-tête : retour + recherche + filtres ── */}
      <SafeAreaView edges={['top']} style={styles.topWrap} pointerEvents="box-none">
        <View style={[styles.searchRow]}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8}
            style={[styles.roundBtn, styles.shadow, { backgroundColor: theme.background }]}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={[styles.search, styles.shadow, { backgroundColor: theme.background }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={v => {
                setQuery(v);
                setSelKey(null);
                if (place) { setPlace(null); setNearby(false); }
                if (v.trim() && sheet === 'min') changeSheet('mid');
              }}
              placeholder="Entreprise, livreur, quartier, ville…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => { if (results[0]) select(results[0]); }}
              maxLength={80}
              accessibilityLabel="Rechercher une entreprise, un livreur ou un correspondant"
            />
            {search.loading ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
            {query || nearby || place ? (
              <Pressable onPress={clearAll} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
                <Ionicons name="close-circle" size={19} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {ALL_ROLES.map(r => {
            const on = types.includes(r);
            return (
              <Pressable
                key={r}
                onPress={() => toggleType(r)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[styles.chip, styles.shadow, on ? styles.chipOn : { backgroundColor: theme.background }]}>
                <ThemedText style={styles.chipEmoji}>{ROLE[r].emoji}</ThemedText>
                <ThemedText type="smallBold" style={on ? styles.chipTextOn : undefined}>{ROLE[r].plural}</ThemedText>
                {search.searched ? (
                  <View style={[styles.count, on ? styles.countOn : { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText style={[styles.countText, on && { color: Brand.primary }]}>{meta.byRole[r]}</ThemedText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => void toggleNearby()}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: nearby }}
            style={[styles.chip, styles.shadow, nearby ? styles.chipGeoOn : { backgroundColor: theme.background }]}>
            <Ionicons name="locate" size={15} color={nearby ? Brand.primaryInk : '#1F1F1F'} />
            <ThemedText type="smallBold" style={nearby ? styles.chipTextOn : { color: '#1F1F1F' }}>
              {place ? `Autour de ${place.name}` : 'Autour de moi'}
            </ThemedText>
          </Pressable>
        </ScrollView>

        {nearby ? (
          <View style={styles.radiusRow}>
            {RADII.map(r => (
              <Pressable
                key={r}
                onPress={() => setRadiusKm(r)}
                accessibilityRole="radio"
                accessibilityState={{ selected: radiusKm === r }}
                style={[styles.radius, styles.shadow, radiusKm === r ? styles.radiusOn : { backgroundColor: theme.background }]}>
                <ThemedText style={[styles.radiusText, radiusKm === r && { color: Brand.primaryInk }]}>{r} km</ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </SafeAreaView>

      {/* ── Boutons flottants : fond, noms, ma position, zoom ── */}
      <View style={[styles.fabs, { bottom: sheetHeight + 14 }]} pointerEvents="box-none">
        <Fab icon={mapStyle === 'plan' ? 'earth' : 'map'} label={mapStyle === 'plan' ? 'Satellite' : 'Plan'} onPress={() => setMapStyle(s => (s === 'plan' ? 'satellite' : 'plan'))} />
        <Fab icon="text" label="Noms des lieux" active={labelsOn} onPress={() => setLabelsOn(v => !v)} />
        <Fab icon="add" label="Zoomer" onPress={() => mapRef.current?.camera({ kind: 'zoom', delta: 1 })} />
        <Fab icon="remove" label="Dézoomer" onPress={() => mapRef.current?.camera({ kind: 'zoom', delta: -1 })} />
        <Fab icon={geo.status === 'locating' ? 'hourglass-outline' : 'navigate'} label="Ma position" color="#1F1F1F" onPress={() => void goToMe()} />
      </View>

      {/* ── Panneau du bas ── */}
      <View style={[styles.sheet, styles.sheetShadow, { height: sheetHeight, backgroundColor: theme.background, paddingBottom: insets.bottom }]}>
        <Pressable
          onPress={() => changeSheet(sheet === 'min' ? 'mid' : sheet === 'mid' ? 'max' : 'mid')}
          accessibilityRole="button"
          accessibilityLabel={sheet === 'max' ? 'Réduire la liste' : 'Agrandir la liste'}
          style={styles.handleZone}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.sheetHead}>
            <ThemedText style={styles.sheetTitle} numberOfLines={1}>
              {selected
                ? selected.name
                : results.length
                  ? `${meta.total} résultat${meta.total > 1 ? 's' : ''}${place ? ` autour de ${place.name}` : nearby ? ' autour de vous' : ''}`
                  : place
                    ? place.name
                    : 'Où se trouve… ?'}
            </ThemedText>
            {sheet !== 'min' ? (
              <Pressable onPress={() => changeSheet('min')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Réduire">
                <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-up" size={20} color={theme.textSecondary} />
            )}
          </View>
        </Pressable>

        {sheet !== 'min' ? (
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {/* Bandeau : itinéraire / position approximative / lieu actif */}
            {route ? (
              <View style={[styles.hud, { backgroundColor: '#FFF1F2' }]}>
                <Ionicons name="trail-sign" size={16} color="#E11D48" />
                <ThemedText style={[styles.hudText, { color: '#9F1239' }]}>{route.totalDistanceTxt} · {route.totalDurationTxt}</ThemedText>
                <Pressable onPress={() => setRouteState(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer l'itinéraire">
                  <Ionicons name="close" size={16} color="#9F1239" />
                </Pressable>
              </View>
            ) : null}

            {selected ? (
              <ActorDetail
                a={selected}
                fromLabel={place ? `de ${place.name}` : 'de vous'}
                routing={routing}
                onBack={() => setSelKey(null)}
                onProfile={() => openProfile(selected)}
                onRoute={() => void showRoute(selected)}
                onShare={() => share(selected)}
                onMaps={() => openInMaps(selected)}
              />
            ) : (
              <>
                {idle ? (
                  <View style={styles.state}>
                    <View style={[styles.stateIcon, { backgroundColor: '#FFF1F2' }]}>
                      <Ionicons name="location" size={30} color="#E11D48" />
                    </View>
                    <ThemedText themeColor="textSecondary" style={styles.center}>
                      Tapez le nom d’une entreprise, d’un livreur ou d’un correspondant, ou un quartier : le point rouge apparaît sur la carte.
                    </ThemedText>
                    <Pressable onPress={() => void toggleNearby()} accessibilityRole="button" style={styles.primaryBtn}>
                      <Ionicons name="locate" size={16} color={Brand.primaryInk} />
                      <ThemedText type="smallBold" style={styles.primaryBtnText}>Voir autour de moi</ThemedText>
                    </Pressable>
                  </View>
                ) : null}

                {/* LIEUX correspondant à la saisie */}
                {trimmed.length >= 2 ? (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>LIEUX</ThemedText>
                    {placeSuggestions.map(pl => (
                      <Pressable
                        key={pl.key}
                        disabled={placeBusy}
                        onPress={() => void goToPlace({ nom: pl.name, type: pl.type, commune: pl.commune, ville: pl.ville, label: pl.label })}
                        style={({ pressed }) => [styles.placeRow, pressed && { backgroundColor: theme.backgroundElement }]}>
                        <View style={[styles.placeIcon, { backgroundColor: '#EEF2FF' }]}>
                          <Ionicons name="location-outline" size={17} color="#1F1F1F" />
                        </View>
                        <View style={styles.flex}>
                          <ThemedText numberOfLines={1} style={styles.placeName}>
                            {pl.name} <ThemedText type="small" themeColor="textSecondary">{pl.type === 'ville' ? 'Ville' : pl.type === 'commune' ? 'Commune' : 'Quartier'}</ThemedText>
                          </ThemedText>
                          <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">{pl.label}</ThemedText>
                        </View>
                      </Pressable>
                    ))}
                    {trimmed.length >= 3 ? (
                      <Pressable
                        disabled={placeBusy}
                        onPress={() => void goToPlace({ nom: trimmed, type: 'libre', label: trimmed })}
                        style={({ pressed }) => [styles.placeRow, pressed && { backgroundColor: theme.backgroundElement }]}>
                        <View style={[styles.placeIcon, { backgroundColor: theme.backgroundSelected }]}>
                          {placeBusy ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="search" size={16} color={Brand.primary} />}
                        </View>
                        <View style={styles.flex}>
                          <ThemedText numberOfLines={1} style={styles.placeName}>Chercher « {trimmed} » sur la carte</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">Rue, point de repère, quartier…</ThemedText>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {!idle && search.loading && !results.length ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}

                {!idle && search.error && !search.loading ? (
                  <View style={styles.state}>
                    <Ionicons name="warning-outline" size={30} color={theme.textSecondary} />
                    <ThemedText themeColor="textSecondary" style={styles.center}>{search.error}</ThemedText>
                    <Pressable onPress={search.retry} accessibilityRole="button">
                      <ThemedText type="smallBold" style={{ color: Brand.primary }}>Réessayer</ThemedText>
                    </Pressable>
                  </View>
                ) : null}

                {!idle && nearby && !trimmed && !me && !place && geo.status !== 'ok' ? (
                  <View style={styles.state}>
                    <Ionicons name="locate-outline" size={30} color={theme.textSecondary} />
                    <ThemedText themeColor="textSecondary" style={styles.center}>
                      {geo.status === 'locating' ? 'Localisation en cours…' : 'Autorisez la localisation pour voir ce qui se trouve autour de vous.'}
                    </ThemedText>
                  </View>
                ) : null}

                {!idle && !search.error && search.searched && !search.loading && results.length === 0 ? (
                  <View style={styles.state}>
                    <Ionicons name="storefront-outline" size={30} color={theme.textSecondary} />
                    <ThemedText style={styles.stateTitle}>Aucun résultat{trimmed ? ` pour « ${trimmed} »` : ''}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.center}>
                      Vérifiez l’orthographe, essayez un quartier ou une ville, ou élargissez le rayon.
                    </ThemedText>
                  </View>
                ) : null}

                {results.length > 0 ? (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>
                      {meta.total} RÉSULTAT{meta.total > 1 ? 'S' : ''}
                      {meta.truncated ? ` — ${results.length} AFFICHÉS` : ''}
                    </ThemedText>
                    {results.map(a => (
                      <ResultRow key={keyOf(a)} a={a} onPress={() => select(a)} />
                    ))}
                    {meta.approx > 0 ? (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.approxNote}>
                        Pointillés = position approximative ({meta.approx}) : l’acteur n’a pas partagé de GPS, il est situé d’après son quartier ou sa ville.
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────

function Fab({ icon, label, onPress, active, color }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean; color?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active !== undefined ? { selected: active } : undefined}
      style={({ pressed }) => [styles.fab, styles.shadow, { backgroundColor: active ? Brand.primarySoft : theme.background }, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={active ? Brand.primaryInk : (color ?? theme.text)} />
    </Pressable>
  );
}

function Avatar({ a, size }: { a: MapActor; size: number }) {
  const theme = useTheme();
  const img = thumb(a.image, size * 3);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.backgroundSelected }]}>
      {img
        ? <Image source={{ uri: img }} style={styles.fill} contentFit="cover" />
        : a.role === 'vendor'
          ? <ThemedText style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials(a.name)}</ThemedText>
          : <ThemedText style={{ fontSize: size * 0.45 }}>{ROLE[a.role].emoji}</ThemedText>}
    </View>
  );
}

function ResultRow({ a, onPress }: { a: MapActor; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${a.name}, ${ROLE[a.role].label}, ${placeLine(a)}`}
      style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Avatar a={a} size={46} />
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.rowName}>{a.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{ROLE[a.role].emoji} {ROLE[a.role].label}</ThemedText>
        <View style={styles.rowLoc}>
          <Ionicons name="location" size={12} color="#E11D48" />
          <ThemedText numberOfLines={1} type="small" style={styles.flex}>{placeLine(a)}</ThemedText>
        </View>
        <View style={styles.badges}>
          {a.distanceKm != null ? <Badge text={formatDistance(a.distanceKm)} icon="navigate-outline" /> : null}
          {a.rating != null && a.rating > 0 ? <Badge text={`★ ${a.rating.toFixed(1)}`} color="#B45309" bg="#FEF3C7" /> : null}
          {a.available === true ? <Badge text="Disponible" color="#047857" bg="#D1FAE5" /> : null}
          {a.available === false ? <Badge text="Indisponible" color="#6B7280" bg="#F3F4F6" /> : null}
          {a.approx ? <Badge text="Approximatif" color="#9F1239" bg="#FFF1F2" /> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

function Badge({ text, icon, color = '#1F1F1F', bg = 'rgba(0,0,0,0.05)' }: { text: string; icon?: React.ComponentProps<typeof Ionicons>['name']; color?: string; bg?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <ThemedText style={[styles.badgeText, { color }]}>{text}</ThemedText>
    </View>
  );
}

function ActorDetail({ a, fromLabel, routing, onBack, onProfile, onRoute, onShare, onMaps }: {
  a: MapActor; fromLabel: string; routing: boolean;
  onBack: () => void; onProfile: () => void; onRoute: () => void; onShare: () => void; onMaps: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.detail}>
      <Pressable onPress={onBack} accessibilityRole="button" style={styles.detailBack} hitSlop={8}>
        <Ionicons name="arrow-back" size={16} color={Brand.primary} />
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>Tous les résultats</ThemedText>
      </Pressable>

      <View style={styles.detailHead}>
        <Avatar a={a} size={58} />
        <View style={styles.flex}>
          <ThemedText style={styles.detailName} numberOfLines={2}>{a.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {ROLE[a.role].emoji} {ROLE[a.role].label}{a.rating != null && a.rating > 0 ? `  ·  ★ ${a.rating.toFixed(1)}` : ''}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement }]}>
        <InfoLine icon="location" color="#E11D48" text={placeLine(a)} bold />
        {a.address ? <InfoLine icon="home-outline" text={a.address} /> : null}
        {a.distanceKm != null ? <InfoLine icon="navigate-outline" text={`À ${formatDistance(a.distanceKm)} ${fromLabel}`} /> : null}
        <InfoLine icon={a.approx ? 'help-circle-outline' : 'checkmark-circle-outline'} color={a.approx ? '#9F1239' : '#047857'} text={PRECISION_LABEL[a.precision]} />
        {a.available != null ? (
          <InfoLine icon="ellipse" color={a.available ? '#10B981' : '#9CA3AF'} text={a.available ? 'Disponible maintenant' : 'Indisponible pour le moment'} />
        ) : null}
      </View>

      <View style={styles.actions}>
        <ActionBtn icon="person-circle-outline" label="Profil" onPress={onProfile} primary />
        <ActionBtn icon="trail-sign-outline" label={routing ? '…' : 'Itinéraire'} onPress={onRoute} disabled={routing} />
        <ActionBtn icon="share-social-outline" label="Partager" onPress={onShare} />
        <ActionBtn icon="map-outline" label="Maps" onPress={onMaps} />
      </View>
    </View>
  );
}

function InfoLine({ icon, text, color, bold }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; color?: string; bold?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={15} color={color ?? theme.textSecondary} />
      <ThemedText type="small" style={[styles.flex, bold && { fontWeight: '800' }]}>{text}</ThemedText>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, primary, disabled }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; primary?: boolean; disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        primary ? { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine } : { backgroundColor: theme.backgroundSelected },
        (pressed || disabled) && styles.pressed,
      ]}>
      {disabled ? <ActivityIndicator size="small" color={primary ? Brand.primaryInk : Brand.primary} /> : <Ionicons name={icon} size={20} color={primary ? Brand.primaryInk : Brand.primary} />}
      <ThemedText style={[styles.actionText, { color: primary ? Brand.primaryInk : Brand.primary }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
  loader: { marginVertical: Spacing.four },
  shadow: { shadowColor: '#1F1F1F', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 3 },
  mapError: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 10, padding: Spacing.four },

  topWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  roundBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  chips: { gap: 8, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, height: 36 },
  chipOn: { backgroundColor: Brand.primarySoft },
  chipGeoOn: { backgroundColor: '#1F1F1F' },
  chipEmoji: { fontSize: 14, lineHeight: 18 },
  chipTextOn: { color: Brand.primaryInk },
  count: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  countOn: { backgroundColor: '#fff' },
  countText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  radiusRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.three },
  radius: { borderRadius: 999, paddingHorizontal: 12, height: 30, alignItems: 'center', justifyContent: 'center' },
  radiusOn: { backgroundColor: '#1F1F1F' },
  radiusText: { fontSize: 12.5, lineHeight: 16, fontWeight: '700' },

  fabs: { position: 'absolute', right: Spacing.three, gap: 10 },
  fab: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetShadow: { shadowColor: '#1F1F1F', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 12 },
  handleZone: { paddingTop: 8, paddingHorizontal: Spacing.three, paddingBottom: 6 },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  sheetBody: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four },

  hud: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  hudText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '700' },

  state: { alignItems: 'center', gap: 10, paddingVertical: Spacing.four, paddingHorizontal: Spacing.two },
  stateIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 16, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
  primaryBtnText: { color: Brand.primaryInk },

  section: { marginTop: 6, marginBottom: 6 },
  sectionTitle: { fontSize: 11.5, lineHeight: 16, fontWeight: '800', letterSpacing: 1.3, color: Brand.primary, marginBottom: 6, marginTop: 4 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 12 },
  placeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  placeName: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  rowName: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  rowLoc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  approxNote: { marginTop: 10, lineHeight: 18 },

  avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', color: Brand.primary },

  detail: { gap: 12, paddingTop: 2 },
  detailBack: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailName: { fontSize: 18, lineHeight: 23, fontWeight: '800' },
  infoCard: { borderRadius: 14, padding: 12, gap: 8 },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 14, paddingVertical: 10 },
  actionText: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
});

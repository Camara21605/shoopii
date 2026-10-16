/**
 * Épingler l'adresse sur la carte : toucher la carte place l'épingle,
 * « Ma position » la met là où se trouve le téléphone. Sans épingle, la carte
 * se cadre sur le quartier / la commune / la ville choisis (lieu localisé par
 * le serveur, comme la carte du site). Sur le web : coordonnées seulement.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { locatePlace } from '@/features/location/api';
import { MapView, type MapState, type MapViewHandle } from '@/features/location/MapView';
import { useTheme } from '@/hooks/use-theme';

const CONAKRY = { lat: 9.6412, lng: -13.5784 };
const round6 = (n: number) => Number(n.toFixed(6));

export type Pin = { lat: number; lng: number } | null;

export function MapPin({
  pin,
  onChange,
  place,
  onMessage,
}: {
  pin: Pin;
  onChange: (p: Pin) => void;
  /** Lieu choisi dans le formulaire : sert à cadrer la carte tant qu'il n'y a pas d'épingle. */
  place: { ville: string; commune: string; quartier: string };
  onMessage: (text: string, error?: boolean) => void;
}) {
  const theme = useTheme();
  const mapRef = useRef<MapViewHandle>(null);
  const [locating, setLocating] = useState(false);
  const [initial] = useState(() => pin ?? CONAKRY);
  /* Épingle posée ici (toucher, « Ma position ») vs venue d'ailleurs (« Utiliser ma
   * position GPS ») : dans le second cas, la carte va la montrer. */
  const lastKey = useRef<string | null>(pin ? `${pin.lat},${pin.lng}` : null);
  const place_ = (p: { lat: number; lng: number }) => {
    lastKey.current = `${p.lat},${p.lng}`;
    onChange(p);
  };
  useEffect(() => {
    if (pin?.lat == null || pin?.lng == null) return;
    const key = `${pin.lat},${pin.lng}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    mapRef.current?.camera({ kind: 'fly', lat: pin.lat, lng: pin.lng, zoom: 17 });
  }, [pin?.lat, pin?.lng]);

  const state = useMemo<MapState>(
    () => ({
      actors: pin ? [{ key: 'adresse', role: 'correspondent', lat: pin.lat, lng: pin.lng, approx: false, precision: 'exact', emoji: '📍' }] : [],
      selectedKey: null,
      me: null,
      place: null,
      activePlace: place.quartier || place.commune || null,
      radius: null,
      route: null,
      style: 'plan',
      labelsOn: true,
    }),
    [pin, place.quartier, place.commune],
  );

  /* Cadrer sur le lieu choisi (seulement sans épingle : ne jamais déplacer la vue d'une adresse déjà placée). */
  const hasPin = !!pin;
  useEffect(() => {
    if (hasPin || !place.ville) return;
    const nom = place.quartier || place.commune || place.ville;
    const type = place.quartier ? 'quartier' : place.commune ? 'commune' : 'ville';
    let alive = true;
    locatePlace({ nom, type, commune: place.commune || null, ville: place.ville })
      .then((pos) => {
        if (alive && pos) mapRef.current?.camera({ kind: 'fly', lat: pos.lat, lng: pos.lng, zoom: place.quartier ? 16 : place.commune ? 14 : 12 });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [hasPin, place.ville, place.commune, place.quartier]);

  async function locateMe() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return onMessage('Autorisez la localisation pour utiliser votre position.', true);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const p = { lat: round6(pos.coords.latitude), lng: round6(pos.coords.longitude) };
      place_(p);
      mapRef.current?.camera({ kind: 'fly', lat: p.lat, lng: p.lng, zoom: 17 });
      onMessage('Épingle placée sur votre position');
    } catch {
      onMessage('Position introuvable. Réessayez à l’extérieur ou touchez la carte.', true);
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={styles.wrap}>
      {Platform.OS !== 'web' ? (
        <View style={[styles.map, { borderColor: theme.border }]}>
          <MapView ref={mapRef} initialCenter={initial} state={state} onSelect={() => undefined} onTap={(at) => place_({ lat: round6(at.lat), lng: round6(at.lng) })} />
          {!pin ? (
            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.overlayPill}>
                <Ionicons name="hand-left-outline" size={14} color="#fff" />
                <ThemedText style={styles.overlayText}>Touchez la carte pour épingler</ThemedText>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.status, { backgroundColor: pin ? '#0F9D5812' : '#B4530912' }]}>
        <Ionicons name={pin ? 'checkmark-circle' : 'alert-circle-outline'} size={16} color={pin ? Brand.success : '#B45309'} />
        <ThemedText style={[styles.statusText, { color: pin ? Brand.success : '#B45309' }]}>
          {pin ? `Épinglée · ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : 'Facultatif, mais le livreur vous trouvera plus vite.'}
        </ThemedText>
      </View>

      <View style={styles.row}>
        <Pressable
          onPress={() => void locateMe()}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Utiliser ma position actuelle"
          style={({ pressed }) => [styles.btn, styles.btnMain, pressed && styles.pressed]}>
          {locating ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="locate" size={17} color="#fff" />}
          <ThemedText style={styles.btnMainText}>{locating ? 'Localisation…' : 'Ma position actuelle'}</ThemedText>
        </Pressable>
        {pin ? (
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel="Retirer l’épingle"
            style={({ pressed }) => [styles.btn, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
            <Ionicons name="close-circle-outline" size={17} color={theme.text} />
            <ThemedText style={styles.btnText}>Retirer</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  map: { height: 230, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' },
  overlayPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(31,31,31,0.85)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  overlayText: { color: '#fff', fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  statusText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, minHeight: 44, paddingHorizontal: 14 },
  btnMain: { flex: 1, backgroundColor: Brand.primary },
  btnMainText: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  btnText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});

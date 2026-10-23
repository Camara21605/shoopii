/**
 * Position de la boutique — directement dans l'appli (avant : renvoi vers le site).
 *
 *   · carte (satellite par défaut) avec une ÉPINGLE FIXE au centre : on déplace
 *     la carte pour poser l'épingle sur l'entrée de la boutique ;
 *   · « Ma position » : GPS du téléphone, en gardant la mesure la plus précise
 *     pendant quelques secondes (± m affiché, alerte au-delà de 100 m) — à faire
 *     depuis la boutique ;
 *   · adresse lisible du point choisi (OpenStreetMap) : complète la ville, la
 *     commune et le quartier s'ils sont vides ; adresse et repère modifiables ;
 *   · « Enregistrer » : PATCH /dashboard/entreprise/parametres/localisation
 *     (adresse + position en un seul appel, comme le site) — les clients voient
 *     alors la vraie distance et les livreurs trouvent la boutique.
 *
 * Droit requis : boutique.edit (propriétaire ou collaborateur autorisé).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { usePermissions } from '@/features/company/hooks';
import { MapView, type MapState, type MapStyleId, type MapViewHandle } from '@/features/location/MapView';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { useSettings } from '../hooks';

/** Centre de Conakry — carte avant toute position connue. */
const CONAKRY = { lat: 9.537, lng: -13.6773 };
const IMPRECISE_M = 100;

type Fix = { lat: number; lng: number; acc: number };
type Place = { quartier: string | null; commune: string | null; ville: string | null; label: string | null };

/** Adresse lisible d'un point (OpenStreetMap / Nominatim, sans clé). */
async function reverseGeocode(lat: number, lng: number, signal: AbortSignal): Promise<Place | null> {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=fr&zoom=18`, {
    headers: { 'User-Agent': 'Shoneya/1.0 (contact@shoneya.com)' },
    signal,
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { display_name?: string; address?: Record<string, string> };
  const a = d.address ?? {};
  const quartier = a.neighbourhood || a.suburb || a.quarter || a.hamlet || a.village || null;
  const commune = a.city_district || a.municipality || a.town || null;
  const ville = a.city || a.town || a.state_district || a.county || null;
  const label = [a.road, quartier, commune !== ville ? commune : null, ville].filter(Boolean).join(', ') || d.display_name || null;
  return { quartier, commune, ville, label };
}

/** Meilleure mesure GPS en ~10 s (s'arrête dès ± 15 m). */
async function bestFix(onUpdate: (f: Fix) => void): Promise<Fix | null> {
  let best: Fix | null = null;
  return new Promise((resolve) => {
    let sub: Location.LocationSubscription | null = null;
    const done = () => { sub?.remove(); resolve(best); };
    const timer = setTimeout(done, 10_000);
    void Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 }, (l) => {
      const f = { lat: l.coords.latitude, lng: l.coords.longitude, acc: l.coords.accuracy ?? 999 };
      if (!best || f.acc < best.acc) { best = f; onUpdate(f); }
      if (f.acc <= 15) { clearTimeout(timer); done(); }
    }).then((s) => { sub = s; }).catch(() => { clearTimeout(timer); resolve(best); });
  });
}

export default function PositionScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { height } = useWindowDimensions();
  const settings = useSettings();
  const perms = usePermissions();
  const canEdit = perms.isOwner || perms.can('boutique', 'edit');
  const mapRef = useRef<MapViewHandle>(null);

  const s = settings.data;
  const saved = s?.latitude != null && s?.longitude != null ? { lat: s.latitude, lng: s.longitude } : null;

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [style, setStyle] = useState<MapStyleId>('satellite');
  const [place, setPlace] = useState<Place | null>(null);
  const [form, setForm] = useState<{ ville: string; commune: string; quartier: string; adresse: string; repere: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Formulaire prérempli avec l'adresse enregistrée (une fois les paramètres chargés). */
  const values = form ?? {
    ville: s?.ville ?? '', commune: s?.commune ?? '', quartier: s?.quartier ?? '', adresse: s?.adresse ?? '', repere: s?.repere ?? '',
  };
  const set = (k: keyof typeof values, v: string) => setForm({ ...values, [k]: v });

  async function locate() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Localisation refusée', 'Autorisez la localisation dans les réglages du téléphone, ou déplacez la carte pour placer l’épingle.');
      return;
    }
    setLocating(true);
    setError(null);
    const f = await bestFix((p) => {
      setFix(p);
      mapRef.current?.camera({ kind: 'fly', lat: p.lat, lng: p.lng, zoom: 19 });
    });
    setLocating(false);
    if (!f) setError('Position introuvable : sortez à découvert ou déplacez la carte pour placer l’épingle.');
  }

  /* Pas encore de position enregistrée : on localise tout de suite (on vient ici pour ça). */
  const autoLocated = useRef(false);
  useEffect(() => {
    if (autoLocated.current || !settings.data || saved) return;
    autoLocated.current = true;
    void locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.data]);

  /* Adresse lisible du point visé (après 700 ms d'immobilité). */
  useEffect(() => {
    if (!center) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      reverseGeocode(center.lat, center.lng, ctrl.signal)
        .then((p) => {
          if (!p) return;
          setPlace(p);
          /* Complète seulement les champs vides (jamais ce que la boutique a écrit). */
          setForm((f) => {
            const cur = f ?? { ville: s?.ville ?? '', commune: s?.commune ?? '', quartier: s?.quartier ?? '', adresse: s?.adresse ?? '', repere: s?.repere ?? '' };
            return {
              ...cur,
              ville: cur.ville || p.ville || '',
              commune: cur.commune || p.commune || '',
              quartier: cur.quartier || p.quartier || '',
            };
          });
        })
        .catch(() => undefined);
    }, 700);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [center, s?.ville, s?.commune, s?.quartier, s?.adresse, s?.repere]);

  async function save() {
    if (!center || !s) return;
    if (!values.ville.trim()) { setError('Indiquez la ville de la boutique.'); return; }
    setSaving(true);
    setError(null);
    try {
      const pays = (s as { pays?: string | null }).pays || 'Guinée';
      await apiFetch('/dashboard/entreprise/parametres/localisation', {
        method: 'PATCH',
        body: {
          pays,
          ville: values.ville.trim(),
          commune: values.commune.trim() || null,
          quartier: values.quartier.trim() || null,
          adresse: values.adresse.trim() || null,
          repere: values.repere.trim() || null,
          latitude: Number(center.lat.toFixed(6)),
          longitude: Number(center.lng.toFixed(6)),
        },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.company.settings }),
        qc.invalidateQueries({ queryKey: qk.company.position }),
        qc.invalidateQueries({ queryKey: qk.company.identity }),
      ]);
      Alert.alert('Position enregistrée', 'Les clients voient maintenant la vraie distance jusqu’à votre boutique, et les livreurs la trouvent sur la carte.', [
        { text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/entreprise')) },
      ]);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const mapState: MapState = {
    actors: [], selectedKey: null, place: null, activePlace: null, radius: null, route: null,
    me: fix ? { lat: fix.lat, lng: fix.lng, acc: fix.acc, heading: null } : null,
    directions: 'preview',
    style, labelsOn: true,
  };

  const header = (
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/entreprise'))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour">
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </Pressable>
      <View style={styles.flex}>
        <ThemedText style={styles.title}>Position de la boutique</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{s?.companyName ?? ''}</ThemedText>
      </View>
    </View>
  );

  if (settings.isPending || perms.loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        {header}
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }
  if (!canEdit) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        {header}
        <View style={styles.blocked}>
          <Ionicons name="lock-closed-outline" size={34} color={Brand.primary} />
          <ThemedText style={styles.bold}>Accès réservé</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>Seul le propriétaire (ou un collaborateur autorisé à modifier la boutique) peut définir sa position.</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const initial = saved ?? CONAKRY;
  const imprecise = fix != null && fix.acc > IMPRECISE_M;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* ── Carte avec épingle fixe au centre ── */}
        <View style={{ height: Math.round(height * 0.46) }}>
          <MapView
            ref={mapRef}
            state={mapState}
            initialCenter={initial}
            initialZoom={saved ? 18 : 13}
            onSelect={() => undefined}
            onMoveEnd={(c) => setCenter(c)}
          />
          <View pointerEvents="none" style={styles.pinWrap}>
            <MaterialIcons name="place" size={46} color="#EA4335" style={styles.pin} />
            <View style={styles.pinShadow} />
          </View>
          <Pressable onPress={() => setStyle((v) => (v === 'satellite' ? 'plan' : 'satellite'))} accessibilityRole="button"
            accessibilityLabel={style === 'satellite' ? 'Afficher le plan' : 'Afficher le satellite'} style={[styles.fab, styles.fabTop]}>
            <MaterialIcons name="layers" size={22} color="#0B6E73" />
          </Pressable>
          <Pressable onPress={() => void locate()} disabled={locating} accessibilityRole="button" accessibilityLabel="Ma position" style={[styles.myPos]}>
            {locating ? <ActivityIndicator color="#fff" size="small" /> : <MaterialIcons name="my-location" size={20} color="#fff" />}
            <ThemedText style={styles.myPosText}>{locating ? 'Localisation…' : 'Ma position'}</ThemedText>
          </Pressable>
        </View>

        {/* ── Adresse ── */}
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={[styles.near, { backgroundColor: theme.backgroundElement }]}>
            <MaterialIcons name="place" size={18} color="#EA4335" />
            <View style={styles.flex}>
              <ThemedText style={styles.bold} numberOfLines={2}>{place?.label ?? (center ? 'Point choisi sur la carte' : 'Déplacez la carte pour placer l’épingle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {fix
                  ? `GPS du téléphone · précision ± ${Math.round(fix.acc)} m`
                  : center ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` : '—'}
              </ThemedText>
            </View>
          </View>
          {imprecise ? (
            <View style={[styles.warn]}>
              <Ionicons name="warning-outline" size={16} color="#B45309" />
              <ThemedText type="small" style={styles.warnText}>
                Position peu précise (± {Math.round(fix!.acc)} m). Rapprochez-vous d’une fenêtre ou de l’extérieur et touchez à nouveau « Ma position », ou ajustez la carte à la main.
              </ThemedText>
            </View>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            Le mieux : touchez « Ma position » depuis la boutique, puis déplacez la carte si l’épingle n’est pas exactement sur l’entrée.
          </ThemedText>

          <Field label="Ville *" value={values.ville} onChangeText={(v) => set('ville', v)} placeholder="Ex. Conakry" />
          <View style={styles.row2}>
            <View style={styles.flex}><Field label="Commune" value={values.commune} onChangeText={(v) => set('commune', v)} placeholder="Ex. Kaloum" /></View>
            <View style={styles.flex}><Field label="Quartier" value={values.quartier} onChangeText={(v) => set('quartier', v)} placeholder="Ex. Almamya" /></View>
          </View>
          <Field label="Adresse (rue, immeuble…)" value={values.adresse} onChangeText={(v) => set('adresse', v)} placeholder="Ex. Avenue de la République" />
          <Field label="Repère" value={values.repere} onChangeText={(v) => set('repere', v)} placeholder="Ex. En face de la pharmacie, portail bleu" />

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable onPress={() => void save()} disabled={!center || saving} accessibilityRole="button"
            style={({ pressed }) => [styles.saveBtn, (!center || saving) && styles.disabled, pressed && styles.pressed]}>
            {saving ? <ActivityIndicator color="#fff" /> : <MaterialIcons name="check" size={20} color="#fff" />}
            <ThemedText style={styles.saveText}>{saved ? 'Mettre à jour la position' : 'Enregistrer la position'}</ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>{label}</ThemedText>
      <TextInput
        {...props}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '800' },
  loader: { marginTop: 60 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  pinWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  /* La pointe de l'épingle est exactement au centre de la carte. */
  pin: { marginBottom: 44 },
  pinShadow: { position: 'absolute', width: 10, height: 4, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.35)' },
  fab: { position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C9EDF0', elevation: 4 },
  fabTop: { right: 12, top: 12 },
  myPos: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1A73E8', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 11, elevation: 4 },
  myPosText: { color: '#fff', fontWeight: '700' },
  form: { padding: 16, gap: 12 },
  near: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 14, padding: 12 },
  warn: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 10 },
  warnText: { flex: 1, color: '#92400E' },
  row2: { flexDirection: 'row', gap: 10 },
  field: { gap: 4 },
  fieldLabel: { fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  error: { color: '#D93025', fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.primary, borderRadius: 999, paddingVertical: 14, marginTop: 4 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

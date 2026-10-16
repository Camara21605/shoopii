/**
 * « Utiliser ma position GPS » : un toucher lit la position du téléphone, la
 * rattache au référentiel du super admin (GET /geo/locate → pays, ville,
 * commune, quartier) et montre ce qui a été trouvé. Le client vérifie puis
 * touche « Utiliser ces informations » : tout est rempli d'un coup (lieu,
 * rue lue par le téléphone si le champ est vide, épingle exacte sur la carte).
 * Rien n'est modifié sans son accord.
 *
 * `pin` : une épingle déjà posée à la main sur la carte peut servir de point
 * de départ (« Remplir depuis l'épingle »), sans relire le GPS.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GpsError, locateInReferential, prettyGeoName, readGpsFix, type GeoLocateResult } from '../geo';
import { paysValue } from './place-fields';

export type GpsFill = {
  pays: string | null;
  ville: string | null;
  commune: string | null;
  quartier: string | null;
  rue: string | null;
  pin: { lat: number; lng: number };
};

type Found = { fill: GpsFill; accuracyM: number | null; precision: GeoLocateResult['precision']; fromPin: boolean };

export function GpsFillCard({
  pin,
  onApply,
  onMessage,
}: {
  pin: { lat: number; lng: number } | null;
  onApply: (fill: GpsFill) => void;
  onMessage: (text: string, error?: boolean) => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState<null | 'gps' | 'pin'>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [denied, setDenied] = useState(false);

  async function resolve(lat: number, lng: number, hints: string[], street: string | null, accuracyM: number | null, fromPin: boolean) {
    let ref: GeoLocateResult | null = null;
    try {
      ref = await locateInReferential(lat, lng, hints);
    } catch {
      /* serveur injoignable : on garde au moins l'épingle et la rue */
    }
    setFound({
      fromPin,
      accuracyM,
      precision: ref?.precision ?? null,
      fill: {
        pays: ref?.pays ? paysValue(ref.pays) : null,
        ville: ref?.ville ? prettyGeoName(ref.ville.nom) : null,
        commune: ref?.commune ? prettyGeoName(ref.commune.nom) : null,
        quartier: ref?.quartier ? prettyGeoName(ref.quartier.nom) : null,
        rue: street,
        pin: { lat, lng },
      },
    });
  }

  async function fromGps() {
    setBusy('gps');
    setDenied(false);
    try {
      const fix = await readGpsFix();
      await resolve(fix.lat, fix.lng, fix.hints, fix.street, fix.accuracyM, false);
    } catch (e) {
      if (e instanceof GpsError && e.reason === 'permission') setDenied(true);
      onMessage(e instanceof GpsError ? e.message : 'Position introuvable. Réessayez dans un instant.', true);
    } finally {
      setBusy(null);
    }
  }

  async function fromPin() {
    if (!pin) return;
    setBusy('pin');
    try {
      await resolve(pin.lat, pin.lng, [], null, null, true);
    } finally {
      setBusy(null);
    }
  }

  if (found) {
    const f = found.fill;
    const nothing = !f.ville && !f.commune && !f.quartier;
    return (
      <View style={[styles.card, { borderColor: Brand.primary, backgroundColor: theme.backgroundElement }]} accessibilityLiveRegion="polite">
        <View style={styles.head}>
          <Ionicons name={nothing ? 'help-circle' : 'checkmark-circle'} size={20} color={nothing ? '#B45309' : Brand.success} />
          <View style={styles.flex}>
            <ThemedText style={styles.title}>{found.fromPin ? 'Lieu de l’épingle' : 'Position trouvée'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {nothing
                ? 'Ce lieu n’est pas encore dans nos listes : l’épingle sera placée, choisissez la ville et le quartier.'
                : found.accuracyM != null
                  ? `Précision du GPS : ± ${found.accuracyM} m. Vérifiez avant d’utiliser.`
                  : 'Vérifiez avant d’utiliser.'}
            </ThemedText>
          </View>
        </View>

        <View style={styles.rows}>
          <Row label="Ville" value={f.ville} />
          <Row label="Commune" value={f.commune} />
          <Row label="Quartier" value={f.quartier} hint={found.precision && found.precision !== 'quartier' && f.ville ? 'à choisir' : undefined} />
          {f.rue ? <Row label="Rue / repère" value={f.rue} /> : null}
          <Row label="Épingle" value={`${f.pin.lat.toFixed(5)}, ${f.pin.lng.toFixed(5)}`} />
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => setFound(null)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btn, { backgroundColor: theme.background }, pressed && styles.pressed]}>
            <ThemedText style={styles.btnText}>Ignorer</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              onApply(f);
              setFound(null);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btn, styles.btnMain, pressed && styles.pressed]}>
            <Ionicons name="checkmark" size={17} color="#fff" />
            <ThemedText style={styles.btnMainText}>Utiliser ces informations</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => void fromGps()}
        disabled={!!busy}
        accessibilityRole="button"
        accessibilityLabel="Remplir l’adresse avec ma position GPS"
        style={({ pressed }) => [styles.gpsBtn, { borderColor: Brand.primary }, pressed && styles.pressed]}>
        <View style={styles.gpsIcon}>
          {busy === 'gps' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="navigate" size={18} color="#fff" />}
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.gpsTitle}>{busy === 'gps' ? 'Recherche de votre position…' : 'Utiliser ma position GPS'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ville, commune, quartier et épingle remplis en un toucher.
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Pressable>

      {denied ? (
        <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button" hitSlop={6}>
          <ThemedText type="small" style={styles.link}>
            Ouvrir les réglages de localisation
          </ThemedText>
        </Pressable>
      ) : null}

      {pin ? (
        <Pressable onPress={() => void fromPin()} disabled={!!busy} accessibilityRole="button" hitSlop={6} style={styles.pinLink}>
          {busy === 'pin' ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="pin-outline" size={14} color={Brand.primary} />}
          <ThemedText type="small" style={styles.link}>
            Remplir depuis l’épingle de la carte
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function Row({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.rowValue, !value && styles.rowMissing]} numberOfLines={2}>
        {value ?? hint ?? 'à choisir'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  gpsIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  gpsTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  link: { color: Brand.primary, fontWeight: '800', textDecorationLine: 'underline' },
  pinLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 10 },
  head: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  rows: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowLabel: { width: 96 },
  rowValue: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  rowMissing: { fontWeight: '500', fontStyle: 'italic', opacity: 0.6 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, minHeight: 44, paddingHorizontal: 14 },
  btnMain: { flex: 1, backgroundColor: Brand.primary },
  btnMainText: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  btnText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
});

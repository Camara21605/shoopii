/**
 * « Où livrer » — l'adresse du client telle qu'il l'a choisie à la commande :
 * quartier, commune, ville (référentiel du super admin), rue / repère,
 * consignes, et son épingle GPS exacte quand il l'a posée.
 *   - Itinéraire : vers l'épingle exacte (Google Maps, navigation), sinon vers
 *     le lieu écrit ;
 *   - Appeler / WhatsApp : seulement une fois la mission acceptée (le numéro du
 *     client n'est pas montré avant).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DeliveryAddress = {
  nom: string | null;
  rue: string | null;
  quartier: string | null;
  commune: string | null;
  ville: string | null;
  instructions: string | null;
  telephone: string | null;
  lat: number | null;
  lng: number | null;
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const uniq = (xs: (string | null | undefined)[]) =>
  xs.filter((v, i, a): v is string => !!v && !!v.trim() && a.findIndex((x) => x?.trim().toLowerCase() === v.trim().toLowerCase()) === i);

/** Lien Google Maps : navigation vers l'épingle exacte, sinon recherche du lieu écrit. */
export function directionsUrl(a: Pick<DeliveryAddress, 'lat' | 'lng' | 'rue' | 'quartier' | 'commune' | 'ville'>): string | null {
  if (a.lat != null && a.lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`;
  const q = uniq([a.rue, a.quartier, a.commune, a.ville]).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q}, Guinée`)}` : null;
}

export function DeliveryAddressBox({ a, contactAllowed, onMap }: { a: DeliveryAddress; contactAllowed: boolean; onMap?: () => void }) {
  const theme = useTheme();
  const exact = a.lat != null && a.lng != null;
  const place = uniq([a.quartier, a.commune, a.ville]);
  const nav = directionsUrl(a);
  const phone = a.telephone?.replace(/\s+/g, '') || null;

  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.caps} themeColor="textSecondary">
        Où livrer
      </ThemedText>
      {a.nom ? <ThemedText style={styles.bold}>👤 {a.nom}</ThemedText> : null}

      <View style={styles.grid}>
        <Field label="Quartier" value={a.quartier} strong />
        <Field label="Commune" value={a.commune} />
        <Field label="Ville" value={a.ville} />
        {a.rue && !place.some((p) => p.toLowerCase() === a.rue!.trim().toLowerCase()) ? <Field label="Rue / repère" value={a.rue} /> : null}
      </View>

      {a.instructions ? (
        <View style={[styles.note, { backgroundColor: theme.background }]}>
          <Ionicons name="chatbox-ellipses-outline" size={15} color={Brand.primary} />
          <ThemedText type="small" style={styles.flex}>
            {a.instructions}
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.gps, { backgroundColor: exact ? '#0F9D5812' : '#B4530912' }]}>
        <Ionicons name={exact ? 'locate' : 'alert-circle-outline'} size={15} color={exact ? Brand.success : '#B45309'} />
        <ThemedText type="small" style={[styles.flex, { color: exact ? Brand.success : '#B45309', fontWeight: '700' }]}>
          {exact ? 'Position GPS exacte du client — l’itinéraire mène devant sa porte.' : 'Pas d’épingle GPS : appelez le client en approchant du quartier.'}
        </ThemedText>
      </View>

      <View style={styles.row}>
        {nav ? <Action icon="navigate" label="Itinéraire" main onPress={() => void Linking.openURL(nav)} /> : null}
        {contactAllowed && phone ? <Action icon="call-outline" label="Appeler" onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
        {contactAllowed && phone ? <Action icon="logo-whatsapp" label="WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${phone.replace(/[^\d]/g, '')}`)} /> : null}
        {onMap ? <Action icon="map-outline" label="Carte" onPress={onMap} /> : null}
      </View>
      {!contactAllowed && phone ? (
        <ThemedText type="small" themeColor="textSecondary">
          Le numéro du client s’affiche une fois la mission acceptée.
        </ThemedText>
      ) : null}
    </View>
  );
}

function Field({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.fieldValue, strong && styles.strong, !value && styles.missing]}>{value || 'non précisé'}</ThemedText>
    </View>
  );
}

function Action({ icon, label, onPress, main }: { icon: IconName; label: string; onPress: () => void; main?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.act, main ? styles.actMain : { borderColor: theme.border, backgroundColor: theme.background }, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={main ? '#fff' : icon === 'logo-whatsapp' ? '#25D366' : Brand.primary} />
      <ThemedText type="smallBold" style={main ? styles.actMainText : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, padding: 14, gap: 10 },
  caps: { fontSize: 11.5, lineHeight: 15, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  bold: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  flex: { flex: 1 },
  grid: { gap: 6 },
  field: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  fieldLabel: { width: 96 },
  fieldValue: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  strong: { fontWeight: '800' },
  missing: { fontStyle: 'italic', opacity: 0.55, fontWeight: '500' },
  note: { flexDirection: 'row', gap: 8, borderRadius: 10, padding: 10, alignItems: 'flex-start' },
  gps: { flexDirection: 'row', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40 },
  actMain: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  actMainText: { color: '#fff' },
  pressed: { opacity: 0.85 },
});

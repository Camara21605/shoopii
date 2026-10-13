/**
 * Petits éléments partagés par les onglets du profil entreprise :
 * étoiles, état vide, pastille de filtre, bouton S'abonner, appel, lieu, « nouveau ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { capitalize } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { ShopProduct } from '../api';
import { isNouveau } from '../filters';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ── Petits éléments partagés ───────────────────────────────────────── */

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <View style={s.row}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Ionicons
          key={v}
          name={value >= v ? 'star' : value >= v - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={value >= v - 0.5 ? '#F59E0B' : '#D4D4D4'}
        />
      ))}
    </View>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  const theme = useTheme();
  return (
    <View style={s.empty}>
      <View style={[s.emptyIco, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name={icon} size={28} color={theme.textSecondary} />
      </View>
      <ThemedText style={s.emptyTitle}>{title}</ThemedText>
      {text ? (
        <ThemedText type="small" themeColor="textSecondary" style={s.center}>
          {text}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: IconName }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[s.chip, active ? { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine } : { borderColor: theme.border }]}>
      {icon ? <Ionicons name={icon} size={14} color={active ? Brand.primaryInk : theme.text} /> : null}
      <ThemedText type="small" style={[s.chipText, active && { color: Brand.primaryInk }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function FollowPill({ followed, loading, onPress }: { followed: boolean; loading?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ selected: followed, busy: !!loading }}
      style={[s.followPill, followed ? { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine } : { borderColor: theme.border }]}>
      {loading ? (
        <ActivityIndicator size="small" color={followed ? Brand.primaryInk : Brand.primary} />
      ) : (
        <ThemedText type="smallBold" style={followed ? { color: Brand.primaryInk } : undefined}>
          {followed ? 'Abonné' : 'S’abonner'}
        </ThemedText>
      )}
    </Pressable>
  );
}

export const call = (phone?: string | null) => {
  if (!phone) return Alert.alert('Téléphone', 'Numéro non renseigné.');
  void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
};

export const place = (a: { localisation?: string | null; quartier?: string | null; commune?: string | null; ville?: string | null; zone?: string | null }) =>
  [a.quartier || a.localisation, a.commune, a.ville].filter((v): v is string => !!v).map(capitalize).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') || a.zone || '';

/** « Nouveau » = publié depuis moins de 14 jours (règle commune, voir ../filters.ts). */
export const isNew = (p: ShopProduct) => isNouveau(p);

const s = StyleSheet.create({
  row: { flexDirection: 'row' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 16 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', textAlign: 'center' },
  center: { textAlign: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34 },
  chipText: { fontWeight: '600' },
  followPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, minWidth: 92, alignItems: 'center', justifyContent: 'center' },
});

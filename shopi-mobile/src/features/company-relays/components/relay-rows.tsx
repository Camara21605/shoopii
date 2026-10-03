/**
 * Lignes de liste « Mes correspondants » :
 *   · TeamRelayRow    correspondant de l'équipe (type, ville · quartier, note,
 *                     missions du mois / total, statut) ; Message / Appel si suivi ;
 *   · NetworkRelayRow correspondant de la plateforme (photo, lieu, type, en ligne,
 *                     note, missions) + S'abonner.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { Pill } from '@/features/company-drivers/components';
import { useTheme } from '@/hooks/use-theme';

import { NETWORK_TYPE, STATUS, TYPE, place, type NetworkRelay, type Relay } from '../api';

export function TypeBadge({ t }: { t: Relay['type'] }) {
  return (
    <View style={[styles.pill, { backgroundColor: Brand.primarySoft }]}>
      <Ionicons name={TYPE[t].icon} size={11} color={Brand.primaryInk} />
      <ThemedText style={[styles.pillText, { color: Brand.primaryInk }]}>{TYPE[t].label}</ThemedText>
    </View>
  );
}

export const statusColor = (s: Relay['status']) => (s === 'active' ? Brand.success : s === 'pending' ? Brand.primaryInk : Brand.danger);

export function RelayAvatar({ emoji, status, size = 50 }: { emoji: string; status: Relay['status']; size?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.ava, { width: size, height: size, borderRadius: size / 2, backgroundColor: Brand.primarySoft }]}>
      <ThemedText style={{ fontSize: size * 0.46, lineHeight: size * 0.6 }}>{emoji}</ThemedText>
      <View style={[styles.dot, { backgroundColor: statusColor(status), borderColor: theme.background, width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} />
    </View>
  );
}

export function TeamRelayRow({ r, busy, onPress, onMessage, onCall }: {
  r: Relay; busy: string | null; onPress: () => void; onMessage: () => void; onCall: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${r.fullName}, ${TYPE[r.type].label}`}
      style={({ pressed }) => [styles.row, { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.background }, r.status === 'suspended' && styles.muted]}>
      <RelayAvatar emoji={r.avatarEmoji} status={r.status} />
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.name}>{r.fullName}</ThemedText>
        <View style={styles.meta}>
          <Meta icon="location-outline" text={place(r)} />
        </View>
        <View style={styles.meta}>
          <Meta icon="star" iconColor="#F5A524" text={r.averageRating > 0 ? r.averageRating.toFixed(1) : 'N/A'} />
          <Meta icon="cube-outline" text={`${r.thisMonth} ce mois`} />
          <Meta text={`${r.totalMissions} au total`} />
        </View>
        <View style={styles.badges}>
          <TypeBadge t={r.type} />
          {r.status !== 'active' ? <Pill label={STATUS[r.status]} color={statusColor(r.status)} soft /> : null}
          {r.isSuivi ? <Pill label="Suivi" color={theme.textSecondary} soft /> : null}
        </View>
      </View>
      <View style={styles.actions}>
        {r.isSuivi ? <IconBtn icon="chatbubble-ellipses-outline" label={`Écrire à ${r.fullName}`} busy={busy === `msg:${r.id}`} onPress={onMessage} /> : null}
        {r.isSuivi ? <IconBtn icon="call-outline" label={`Appeler ${r.fullName}`} busy={busy === `call:${r.id}`} onPress={onCall} /> : null}
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

export function NetworkRelayRow({ r, pending, onToggle, onPress }: { r: NetworkRelay; pending: boolean; onToggle: () => void; onPress: () => void }) {
  const theme = useTheme();
  const photo = r.profilePicture?.startsWith('http') ? thumb(r.profilePicture, 150) : undefined;
  const lieu = r.localisation || [r.quartier, r.ville].filter(Boolean).join(', ') || 'Lieu non défini';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.background }]}>
      <View style={[styles.ava, { width: 50, height: 50, borderRadius: 25, backgroundColor: Brand.primarySoft }]}>
        <View style={styles.clip}>
          {photo ? <Image source={{ uri: photo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.initials}>{initials(r.fullName)}</ThemedText>}
        </View>
        {r.online ? <View style={[styles.dot, { backgroundColor: Brand.success, borderColor: theme.background, width: 15, height: 15, borderRadius: 8 }]} /> : null}
      </View>
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.name}>{r.fullName}</ThemedText>
        <View style={styles.meta}>
          <Meta icon="location-outline" text={lieu} />
        </View>
        <View style={styles.meta}>
          {r.typeCorrespondant ? <Meta text={NETWORK_TYPE[r.typeCorrespondant] ?? r.typeCorrespondant} /> : null}
          <Meta icon="star" iconColor="#F5A524" text={r.averageRating > 0 ? r.averageRating.toFixed(1) : 'N/A'} />
          <Meta text={`${r.totalMissions} mission${r.totalMissions > 1 ? 's' : ''}`} />
          <Meta icon="ellipse" iconColor={r.online ? Brand.success : '#A3A3A3'} text={r.online ? 'En ligne' : 'Hors ligne'} />
        </View>
      </View>
      <Pressable onPress={onToggle} disabled={pending} accessibilityRole="button" accessibilityLabel={r.isSuivi ? 'Ne plus suivre' : 'S’abonner'}
        style={[styles.follow, r.isSuivi ? { backgroundColor: theme.backgroundElement } : { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine, borderWidth: 1 }]}>
        {pending ? <ActivityIndicator size="small" color={Brand.primary} /> : (
          <ThemedText style={[styles.followText, { color: r.isSuivi ? theme.textSecondary : Brand.primaryInk }]}>{r.isSuivi ? 'Suivi' : 'S’abonner'}</ThemedText>
        )}
      </Pressable>
    </Pressable>
  );
}

function Meta({ icon, iconColor, text }: { icon?: React.ComponentProps<typeof Ionicons>['name']; iconColor?: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.metaItem}>
      {icon ? <Ionicons name={icon} size={icon === 'ellipse' ? 8 : 13} color={iconColor ?? theme.textSecondary} /> : null}
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{text}</ThemedText>
    </View>
  );
}

function IconBtn({ icon, label, busy, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={busy} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} style={[styles.iconBtn, { backgroundColor: Brand.primarySoft }]}>
      {busy ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name={icon} size={18} color={Brand.primaryInk} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 3 },
  fill: { width: '100%', height: '100%' },
  muted: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12 },
  ava: { alignItems: 'center', justifyContent: 'center' },
  clip: { width: '100%', height: '100%', borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: Brand.primaryInk },
  dot: { position: 'absolute', right: -1, bottom: -1, borderWidth: 2 },
  name: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  actions: { alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  follow: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, minWidth: 86, alignItems: 'center' },
  followText: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
});

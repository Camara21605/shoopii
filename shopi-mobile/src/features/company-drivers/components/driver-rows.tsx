/**
 * Lignes de liste « Mes livreurs » :
 *   · TeamRow    livreur de l'équipe (avatar véhicule + point de disponibilité,
 *                zone, véhicule, note, courses, statut) ; Message / Appel
 *                seulement si l'entreprise le suit, comme sur le site ;
 *   · NetworkRow livreur de la plateforme (photo, zone, dispo, note) + S'abonner.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { initials } from '@/components/catalog';
import { AvatarPhoto } from '@/components/avatar-photo';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import { AVAIL, STATUS, VEHICLE, type Driver, type NetworkDriver } from '../api';

export function Pill({ label, color, soft }: { label: string; color: string; soft?: boolean }) {
  return (
    <View style={[styles.pill, { backgroundColor: soft ? `${color}1A` : color }]}>
      <ThemedText style={[styles.pillText, { color: soft ? color : '#fff' }]}>{label}</ThemedText>
    </View>
  );
}

export function AvailBadge({ a }: { a: Driver['availability'] }) {
  const v = AVAIL[a];
  return (
    <View style={[styles.pill, { backgroundColor: `${v.color}1A` }]}>
      <View style={[styles.dotSm, { backgroundColor: v.color }]} />
      <ThemedText style={[styles.pillText, { color: v.color }]}>{v.label}</ThemedText>
    </View>
  );
}

export function DriverAvatar({ emoji, photo, availability, size = 50 }: { emoji: string; photo?: string | null; availability: Driver['availability']; size?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.ava, { width: size, height: size, borderRadius: size / 2, backgroundColor: Brand.primarySoft }]}>
      {photo ? <AvatarPhoto uri={photo} size={size} /> : <ThemedText style={{ fontSize: size * 0.48, lineHeight: size * 0.62 }}>{emoji}</ThemedText>}
      <View style={[styles.dot, { backgroundColor: AVAIL[availability].color, borderColor: theme.background, width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }]} />
    </View>
  );
}

export function TeamRow({ d, canContact, busy, onPress, onMessage, onCall }: {
  d: Driver; canContact: boolean; busy: string | null; onPress: () => void; onMessage: () => void; onCall: () => void;
}) {
  const theme = useTheme();
  const muted = d.status === 'suspended' || d.status === 'banned';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${d.fullName}, ${AVAIL[d.availability].label}`}
      style={({ pressed }) => [styles.row, { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.background }, muted && styles.muted]}>
      <DriverAvatar emoji={d.avatarEmoji || d.vehicleEmoji} photo={d.photo} availability={d.availability} />
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.name}>{d.fullName}</ThemedText>
        <View style={styles.meta}>
          <Meta icon="location-outline" text={d.zone ?? 'Zone non définie'} />
          <Meta text={`${d.vehicleEmoji} ${VEHICLE[d.vehicleType] ?? d.vehicleType}`} />
        </View>
        <View style={styles.meta}>
          <Meta icon="star" iconColor="#F5A524" text={d.averageRating > 0 ? d.averageRating.toFixed(1) : 'N/A'} />
          <Meta icon="cube-outline" text={`${d.totalDeliveries} course${d.totalDeliveries > 1 ? 's' : ''}`} />
          {d.todayDeliveries ? <Meta icon="today-outline" text={`${d.todayDeliveries} auj.`} /> : null}
        </View>
        <View style={styles.badges}>
          <AvailBadge a={d.availability} />
          {d.status !== 'active' ? <Pill label={STATUS[d.status]} color={d.status === 'pending' ? Brand.primaryInk : Brand.danger} soft /> : null}
          {d.isSuivi ? <Pill label="Suivi" color={theme.textSecondary} soft /> : null}
        </View>
      </View>
      <View style={styles.actions}>
        {canContact && d.isSuivi ? (
          <IconBtn icon="chatbubble-ellipses-outline" label={`Écrire à ${d.fullName}`} busy={busy === `msg:${d.id}`} onPress={onMessage} />
        ) : null}
        {d.isSuivi ? <IconBtn icon="call-outline" label={`Appeler ${d.fullName}`} busy={busy === `call:${d.id}`} onPress={onCall} /> : null}
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

export function NetworkRow({ d, pending, onToggle, onPress }: { d: NetworkDriver; pending: boolean; onToggle: () => void; onPress: () => void }) {
  const theme = useTheme();
  const photo = d.profilePicture?.startsWith('http') ? thumb(d.profilePicture, 150) : undefined;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.background }]}>
      <View style={[styles.ava, { width: 50, height: 50, borderRadius: 25, backgroundColor: Brand.primarySoft }]}>
        <View style={styles.photoClip}>
          {photo ? <Image source={{ uri: photo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.initials}>{initials(d.fullName)}</ThemedText>}
        </View>
        {d.disponible ? <View style={[styles.dot, { backgroundColor: AVAIL.available.color, borderColor: theme.background, width: 15, height: 15, borderRadius: 8 }]} /> : null}
      </View>
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.name}>{d.fullName}</ThemedText>
        <View style={styles.meta}>
          <Meta icon="location-outline" text={(d.zone || 'Zone non définie').split('·')[0].trim()} />
          {d.vehicule ? <Meta text={d.vehicule} /> : null}
        </View>
        <View style={styles.meta}>
          {d.averageRating != null ? <Meta icon="star" iconColor="#F5A524" text={d.averageRating > 0 ? d.averageRating.toFixed(1) : 'N/A'} /> : null}
          {d.totalLivraisons != null ? <Meta text={`${d.totalLivraisons} livraison${d.totalLivraisons > 1 ? 's' : ''}`} /> : null}
          <Meta icon="ellipse" iconColor={d.disponible ? AVAIL.available.color : AVAIL.offline.color} text={d.disponible ? 'Disponible' : 'Indisponible'} />
        </View>
      </View>
      <Pressable onPress={onToggle} disabled={pending} accessibilityRole="button" accessibilityLabel={d.isSuivi ? 'Ne plus suivre' : 'S’abonner'}
        style={[styles.follow, d.isSuivi ? { backgroundColor: theme.backgroundElement } : { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine, borderWidth: 1 }]}>
        {pending ? <ActivityIndicator size="small" color={Brand.primary} /> : (
          <ThemedText style={[styles.followText, { color: d.isSuivi ? theme.textSecondary : Brand.primaryInk }]}>{d.isSuivi ? 'Suivi' : 'S’abonner'}</ThemedText>
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
  photoClip: { width: '100%', height: '100%', borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: Brand.primaryInk },
  dot: { position: 'absolute', right: -1, bottom: -1, borderWidth: 2 },
  dotSm: { width: 7, height: 7, borderRadius: 4 },
  name: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  actions: { alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  follow: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, minWidth: 86, alignItems: 'center' },
  followText: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
});

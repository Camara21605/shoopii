/**
 * Accueil — rangées « Livreurs » et « Points relais », comme les blocs
 * Livreurs / Correspondants de l'accueil du site (RandomBloc.tsx) :
 *   GET /suivis/livreurs        (public, connexion facultative → isSuivi)
 *   GET /suivis/correspondants  (idem)
 * Carte au format des cartes boutique (fond gris, sans contour) : badge du rôle,
 * photo ou initiales (point vert = disponible / en ligne), nom, véhicule ou type
 * de relais, lieu, « S'abonner ». Toucher la carte = profil : écran natif pour
 * un point relais (features/relay-public), site pour un livreur (pas encore natif).
 * La rangée ne s'affiche pas tant qu'elle est vide (comme « Boutiques »).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { capitalize, FollowButton, initials, SectionHeader } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchDrivers, fetchRelays, type Actor } from '@/features/catalog/api';
import { useToggleFollow } from '@/features/catalog/follow';
import { thumb } from '@/features/catalog/format';
import { openDriver, openRelay } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

type Kind = 'livreur' | 'relais';

const VEHICULES: Record<string, string> = { moto: 'Moto', voiture: 'Voiture', pickup: 'Pick-up', velo: 'Vélo', tricycle: 'Tricycle', camion: 'Camion' };
const RELAIS: Record<string, string> = {
  regional: 'Relais régional',
  zonal: 'Relais zonal',
  national: 'Relais national',
  entreprise: 'Relais d’entreprise',
  company: 'Relais d’entreprise',
  livreur: 'Relais de livreur',
  delivery: 'Relais de livreur',
};

/** Véhicule lisible : « vehiculeType » (moto) de préférence au libellé avec emoji (« 🛵 moto »). */
function vehicleOf(a: Actor) {
  const raw = (typeof a.vehiculeType === 'string' && a.vehiculeType) || a.vehicule || '';
  const clean = raw.replace(/^[^A-Za-zÀ-ÿ]+/, '').trim();
  return clean ? (VEHICULES[clean.toLowerCase()] ?? capitalize(clean)) : 'Livreur';
}

const placeOf = (a: Actor) => a.localisation || a.zone || a.region || [a.quartier, a.commune].filter(Boolean).join(', ') || 'Guinée';

function ActorCard({ actor, kind, following, onFollow }: { actor: Actor; kind: Kind; following: boolean; onFollow: () => void }) {
  const theme = useTheme();
  const photo = thumb(actor.profilePicture, 160);
  const online = kind === 'livreur' ? (actor.disponible ?? actor.online) : (actor.online ?? actor.disponible);
  const subtitle =
    kind === 'livreur'
      ? vehicleOf(actor)
      : actor.typeCorrespondant
        ? (RELAIS[actor.typeCorrespondant.toLowerCase()] ?? capitalize(actor.typeCorrespondant))
        : 'Point relais';
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        onPress={() => (kind === 'livreur' ? openDriver(actor.id) : openRelay(actor.id))}
        accessibilityRole="button"
        accessibilityLabel={`${actor.fullName}, ${subtitle}`}
        style={({ pressed }) => [styles.tap, pressed && styles.pressed]}>
        <View style={styles.badge}>
          <Ionicons name={kind === 'livreur' ? 'bicycle' : 'location'} size={11} color={Brand.primary} />
          <ThemedText style={styles.badgeText}>{kind === 'livreur' ? 'LIVREUR' : 'POINT RELAIS'}</ThemedText>
        </View>
        <View>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected, borderColor: theme.background }]}>
            {photo ? <Image source={{ uri: photo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.avatarText}>{initials(actor.fullName)}</ThemedText>}
          </View>
          {online ? <View style={[styles.dot, { borderColor: theme.backgroundElement }]} accessibilityLabel={kind === 'livreur' ? 'Disponible' : 'En ligne'} /> : null}
        </View>
        <ThemedText numberOfLines={2} style={styles.name}>
          {actor.fullName}
        </ThemedText>
        <View style={styles.row}>
          <Ionicons name={kind === 'livreur' ? 'bicycle-outline' : 'cube-outline'} size={13} color={theme.textSecondary} />
          <ThemedText numberOfLines={1} style={styles.sub} themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>
        <View style={styles.row}>
          <Ionicons name="location" size={13} color={Brand.primary} />
          <ThemedText numberOfLines={1} style={styles.place}>
            {placeOf(actor).toUpperCase()}
          </ThemedText>
        </View>
      </Pressable>
      <FollowButton followed={!!actor.isSuivi} loading={following} onPress={onFollow} compact />
    </View>
  );
}

export function HomeActors({ kind }: { kind: Kind }) {
  const key = kind === 'livreur' ? 'livreurs' : 'correspondants';
  const list = useQuery({ queryKey: qk.homeActors(key), queryFn: () => (kind === 'livreur' ? fetchDrivers() : fetchRelays()), staleTime: 60_000 });
  const follow = useToggleFollow(key);
  if (!list.data?.length) return null;
  return (
    <View style={styles.section}>
      <SectionHeader
        title={kind === 'livreur' ? 'Livreurs' : 'Points relais'}
        action={kind === 'livreur' ? 'Tous les livreurs' : 'Tous les points relais'}
        onAction={() => router.push(kind === 'livreur' ? '/livreurs' : '/correspondants')}
      />
      <FlatList
        horizontal
        data={list.data.slice(0, 15)}
        keyExtractor={(a) => a.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hList}
        renderItem={({ item }) => <ActorCard actor={item} kind={kind} following={follow.pending === item.id} onFollow={() => follow.toggle(item.id)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 28 },
  hList: { paddingHorizontal: Spacing.three, gap: 12 },
  card: { width: 160, alignItems: 'center', borderRadius: 18, padding: 8, paddingBottom: 12, gap: 4 },
  tap: { alignSelf: 'stretch', alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.85 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.92)' },
  badgeText: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', letterSpacing: 0.6, color: Brand.primary },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  fill: { width: '100%', height: '100%' },
  avatarText: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: Brand.primary },
  dot: { position: 'absolute', right: 4, bottom: 4, width: 16, height: 16, borderRadius: 8, borderWidth: 3, backgroundColor: Brand.success },
  name: { fontSize: 14, lineHeight: 19, fontWeight: '800', textAlign: 'center', minHeight: 38, textAlignVertical: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  sub: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  place: { fontSize: 11, lineHeight: 15, fontWeight: '800', flexShrink: 1 },
});

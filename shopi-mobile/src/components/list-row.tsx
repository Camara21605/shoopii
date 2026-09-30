/**
 * Ligne de liste commune aux onglets Boutiques, Livreurs et Points relais —
 * affichage EN LISTE (une fiche par ligne), même gabarit pour les trois :
 *   [logo / photo + point en ligne]  Nom ✔
 *                                    activité · véhicule · type de relais
 *                                    📍 quartier   ⭐ note   N abonnés      [S'abonner]
 * Toucher la ligne ouvre la fiche (boutique / profil) ; le bouton
 * « S'abonner » est À CÔTÉ de la zone touchable (jamais imbriqué).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type ListRowData = {
  name: string;
  image?: string | null;
  verified?: boolean;
  /** Ligne 2 : activité (boutique), véhicule (livreur), type (relais) */
  subtitle?: string | null;
  subtitleIcon?: IconName;
  place?: string | null;
  rating?: number | null;
  reviews?: number | null;
  /** Ex. « 12 abonnés », « 40 livraisons » */
  stat?: string | null;
  /** true = en ligne (point vert), false = hors ligne (gris), undefined = pas de point */
  online?: boolean;
};

export function ListRow({
  data,
  onPress,
  followed,
  following,
  onFollow,
}: {
  data: ListRowData;
  onPress: () => void;
  followed?: boolean;
  following?: boolean;
  onFollow?: () => void;
}) {
  const theme = useTheme();
  const img = thumb(data.image, 140);
  const rating = data.rating && data.rating > 0 ? data.rating : null;

  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={data.name}
        style={({ pressed }) => [styles.tap, pressed && styles.pressed]}>
        <View style={styles.avatar}>
          {/* Photo coupée en cercle ; le point « en ligne » reste visible par-dessus */}
          <View style={[styles.avatarClip, { backgroundColor: theme.backgroundSelected }]}>
            {img ? (
              <Image source={{ uri: img }} style={styles.fill} contentFit="cover" />
            ) : (
              <ThemedText style={styles.initials}>{initials(data.name)}</ThemedText>
            )}
          </View>
          {data.online !== undefined ? (
            <View
              style={[styles.dot, { backgroundColor: data.online ? Brand.success : '#9AA6B8', borderColor: theme.background }]}
              accessibilityLabel={data.online ? 'En ligne' : 'Hors ligne'}
            />
          ) : null}
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <ThemedText numberOfLines={1} style={styles.name}>
              {data.name}
            </ThemedText>
            {data.verified ? <Ionicons name="checkmark-circle" size={15} color={Brand.primary} /> : null}
          </View>
          {data.subtitle ? (
            <View style={styles.metaRow}>
              {data.subtitleIcon ? <Ionicons name={data.subtitleIcon} size={13} color={theme.textSecondary} /> : null}
              <ThemedText numberOfLines={1} style={styles.subtitle} themeColor="textSecondary">
                {data.subtitle}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            {data.place ? (
              <View style={styles.chunk}>
                <Ionicons name="location" size={13} color={Brand.primary} />
                <ThemedText numberOfLines={1} style={styles.place}>
                  {data.place}
                </ThemedText>
              </View>
            ) : null}
            {rating ? (
              <View style={styles.chunkFixed}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <ThemedText style={styles.small}>
                  {rating.toFixed(1)}
                  {data.reviews ? <ThemedText style={styles.small} themeColor="textSecondary"> ({data.reviews})</ThemedText> : null}
                </ThemedText>
              </View>
            ) : null}
          </View>
          {data.stat ? (
            <ThemedText style={styles.small} themeColor="textSecondary" numberOfLines={1}>
              {data.stat}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>

      {onFollow ? (
        <Pressable
          onPress={onFollow}
          disabled={following}
          accessibilityRole="button"
          accessibilityLabel={followed ? `Se désabonner de ${data.name}` : `S’abonner à ${data.name}`}
          accessibilityState={{ selected: !!followed, busy: !!following }}
          style={[styles.follow, followed ? { backgroundColor: Brand.primary, borderColor: Brand.primary } : { borderColor: theme.border }]}>
          {following ? (
            <ActivityIndicator size="small" color={followed ? '#fff' : Brand.primary} />
          ) : (
            <>
              <Ionicons name={followed ? 'checkmark' : 'add'} size={15} color={followed ? '#fff' : theme.text} />
              <ThemedText style={[styles.followText, followed ? { color: '#fff' } : undefined]}>{followed ? 'Abonné' : 'Suivre'}</ThemedText>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingLeft: 12, paddingRight: 10, gap: 8 },
  tap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 58, height: 58 },
  avatarClip: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 19, lineHeight: 24, fontWeight: '800', color: Brand.primary },
  dot: { position: 'absolute', right: 0, bottom: 1, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 15.5, lineHeight: 20, fontWeight: '800', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chunk: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  chunkFixed: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  subtitle: { fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
  place: { fontSize: 12.5, lineHeight: 17, fontWeight: '700', flexShrink: 1 },
  small: { fontSize: 12, lineHeight: 16 },
  follow: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, minWidth: 90, justifyContent: 'center' },
  followText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
});

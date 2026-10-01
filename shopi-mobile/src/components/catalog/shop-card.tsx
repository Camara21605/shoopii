/**
 * Carte boutique compacte : couverture, logo, nom, activité, quartier, « S'abonner ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import type { Shop } from '@/features/catalog/api';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import { initials } from './text';

/** Carte boutique — badge ENTREPRISE, logo (ou initiales), nom, activité, quartier, « S'abonner ». */
export function ShopCard({
  shop,
  followed,
  following,
  onPress,
  onFollow,
  width = 172,
}: {
  shop: Shop;
  followed?: boolean;
  following?: boolean;
  onPress: () => void;
  onFollow?: () => void;
  width?: number;
}) {
  const theme = useTheme();
  const logo = thumb(shop.logo, 160);
  const place =
    shop.quartier ||
    shop.commune ||
    shop.localisation ||
    shop.ville ||
    "Guinée";
  const cover = thumb(shop.coverImage, 600);
  /* Carte SANS contour : image de couverture en haut, logo qui la chevauche,
   * puis nom / activité / lieu. Zone cliquable (ouvre la boutique) + bouton
   * « S'abonner » À CÔTÉ, jamais imbriqué (un bouton dans un bouton ne reçoit
   * pas le toucher). */
  return (
    <View style={[styles.shopCard, { width, backgroundColor: theme.backgroundElement }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={shop.companyName}
        style={({ pressed }) => [styles.shopTap, pressed && styles.pressed]}
      >
        <View style={[styles.cover, { backgroundColor: theme.backgroundSelected }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" transition={150} />
          ) : (
            <ThemedText style={styles.coverEmoji}>{shop.domaineIcon || "🏪"}</ThemedText>
          )}
          <View style={styles.coverBadge}>
            <Ionicons name="storefront" size={11} color={Brand.primary} />
            <ThemedText style={styles.badgeText}>ENTREPRISE</ThemedText>
          </View>
        </View>
        <View
          style={[styles.avatar, { backgroundColor: theme.backgroundSelected, borderColor: theme.backgroundElement }]}
        >
          {logo ? (
            <Image
              source={{ uri: logo }}
              style={styles.fill}
              contentFit="cover"
            />
          ) : (
            <ThemedText style={styles.avatarText}>
              {initials(shop.companyName)}
            </ThemedText>
          )}
        </View>
        <View style={styles.nameRow}>
          <ThemedText numberOfLines={2} style={styles.shopName}>
            {shop.companyName}
          </ThemedText>
          {shop.verified ? (
            <Ionicons name="checkmark-circle" size={16} color={Brand.primary} />
          ) : null}
        </View>
        <ThemedText
          numberOfLines={1}
          style={styles.shopDomain}
          themeColor="textSecondary"
        >
          {(shop.domaine ?? "").toUpperCase() || " "}
        </ThemedText>
        <View style={styles.placeRow}>
          <Ionicons name="location" size={13} color={Brand.primary} />
          <ThemedText numberOfLines={1} style={styles.shopPlace}>
            {place.toUpperCase()}
          </ThemedText>
        </View>
      </Pressable>
      {onFollow ? (
        <FollowButton
          followed={!!followed}
          loading={following}
          onPress={onFollow}
          compact
        />
      ) : null}
    </View>
  );
}

function FollowButton({
  followed,
  loading,
  onPress,
  compact,
}: {
  followed: boolean;
  loading?: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ selected: followed, busy: !!loading }}
      style={[
        styles.follow,
        compact && styles.followCompact,
        followed
          ? { backgroundColor: Brand.primary, borderColor: Brand.primary }
          : { borderColor: theme.border },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={followed ? "#fff" : Brand.primary}
        />
      ) : (
        <>
          <Ionicons
            name={followed ? "checkmark" : "add"}
            size={16}
            color={followed ? "#fff" : theme.text}
          />
          <ThemedText
            type="smallBold"
            style={followed ? { color: "#fff" } : undefined}
          >
            {followed ? "Abonné" : "S’abonner"}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* Cadre gris léger (theme.backgroundElement), sans contour, format compact. */
  shopCard: { alignItems: "center", borderRadius: 18, padding: 8, paddingBottom: 12, gap: 4 },
  shopTap: { alignSelf: "stretch", alignItems: "center", gap: 6 },
  pressed: { opacity: 0.85 },
  cover: { alignSelf: "stretch", height: 78, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  fill: { width: "100%", height: "100%" },
  coverEmoji: { fontSize: 32, lineHeight: 40, opacity: 0.6 },
  coverBadge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: "rgba(255,255,255,0.92)" },
  badgeText: { fontSize: 10.5, lineHeight: 14, fontWeight: "800", letterSpacing: 0.6, color: Brand.primary },
  avatar: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, overflow: "hidden", alignItems: "center", justifyContent: "center", marginTop: -29 },
  avatarText: { fontSize: 19, lineHeight: 24, fontWeight: "800", color: Brand.primary },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, minHeight: 38, justifyContent: "center" },
  shopName: { fontSize: 14, lineHeight: 19, fontWeight: "800", textAlign: "center", flexShrink: 1 },
  shopDomain: { fontSize: 10, lineHeight: 13, letterSpacing: 0.5 },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  shopPlace: { fontSize: 11, lineHeight: 15, fontWeight: "800", flexShrink: 1 },
  follow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderRadius: 999, minHeight: 40, paddingHorizontal: 18, marginTop: 6, minWidth: 130 },
  followCompact: { minWidth: 0, alignSelf: "stretch", paddingHorizontal: 12, minHeight: 34, marginTop: 6, backgroundColor: "#fff" },
});

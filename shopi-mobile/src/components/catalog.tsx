/**
 * Éléments visuels du catalogue — même organisation que l'accueil mobile du
 * site (www.shoneya.com sur téléphone), en thème clair :
 *   titre de section « — TYPES DE BOUTIQUES     Tout le catalogue → »,
 *   cartes de type (photo + nombre de boutiques), cartes de catégorie
 *   (icône + nombre de sous-catégories), carte boutique (badge ENTREPRISE,
 *   logo ou initiales, nom, activité, quartier, « S'abonner »),
 *   carte produit « l'image d'abord ».
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Brand, Spacing } from "@/constants/theme";
import type {
  Actor,
  Category,
  CompanyType,
  Product,
  Shop,
} from "@/features/catalog/api";
import {
  discountPercent,
  firstImage,
  formatPrice,
  thumb,
} from "@/features/catalog/format";
import { useTheme } from "@/hooks/use-theme";
import { toUserMessage } from "@/lib/api/errors";

/** « — TYPES DE BOUTIQUES          Tout le catalogue → » */
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionLeft}>
        <View style={styles.dash} />
        <ThemedText style={styles.sectionTitle} accessibilityRole="header">
          {title.toUpperCase()}
        </ThemedText>
      </View>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.sectionLink}
        >
          <ThemedText type="smallBold" style={{ color: Brand.primary }}>
            {action}
          </ThemedText>
          <Ionicons name="arrow-forward" size={15} color={Brand.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Carte « type de boutique » : vignette, nom en capitales, nombre de boutiques. */
export function TypeCard({
  type,
  selected,
  onPress,
}: {
  type: CompanyType;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const img = thumb(type.imageUrl, 160);
  const n = type.nbEntreprises ?? 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tileCard,
        {
          borderColor: selected ? Brand.primary : theme.border,
          backgroundColor: selected
            ? theme.backgroundSelected
            : theme.background,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.tileThumb,
          {
            backgroundColor: type.couleur
              ? `${type.couleur}22`
              : theme.backgroundElement,
          },
        ]}
      >
        {img ? (
          <Image source={{ uri: img }} style={styles.fill} contentFit="cover" />
        ) : (
          <ThemedText style={styles.tileEmoji}>{type.icone || "🏪"}</ThemedText>
        )}
      </View>
      <ThemedText
        numberOfLines={2}
        style={[styles.tileName, selected && { color: Brand.primary }]}
      >
        {type.nom.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.tileMeta} themeColor="textSecondary">
        {n > 0 ? `${n} boutique${n > 1 ? "s" : ""}` : "—"}
      </ThemedText>
    </Pressable>
  );
}

/** Carte « catégorie » : icône, nom, nombre de sous-catégories. */
export function CategoryCard({
  category,
  selected,
  onPress,
}: {
  category: Category;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const n = category.subCategories?.length ?? 0;
  const img = thumb(category.imageUrl, 120);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tileCard,
        {
          borderColor: selected ? Brand.primary : theme.border,
          backgroundColor: selected
            ? theme.backgroundSelected
            : theme.background,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.catIconBox,
          { backgroundColor: theme.backgroundElement },
        ]}
      >
        {img ? (
          <Image source={{ uri: img }} style={styles.fill} contentFit="cover" />
        ) : (
          <ThemedText style={styles.catEmoji}>
            {category.icone || "🏷️"}
          </ThemedText>
        )}
      </View>
      <ThemedText
        numberOfLines={2}
        style={[
          styles.tileName,
          styles.catName,
          selected && { color: Brand.primary },
        ]}
      >
        {capitalize(category.nom)}
      </ThemedText>
      <ThemedText style={styles.tileMeta} themeColor="textSecondary">
        {n > 0 ? `${n} sous-cat${n > 1 ? "s" : ""}` : "—"}
      </ThemedText>
    </Pressable>
  );
}

/** Carte boutique — badge ENTREPRISE, logo (ou initiales), nom, activité, quartier, « S'abonner ». */
export function ShopCard({
  shop,
  followed,
  following,
  onPress,
  onFollow,
  width = 240,
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
  /* Carte = zone cliquable (ouvre la boutique) + bouton « S'abonner » À CÔTÉ,
   * jamais imbriqué (un bouton dans un bouton ne reçoit pas le toucher). */
  return (
    <View style={[styles.shopCard, { width, borderColor: theme.border }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={shop.companyName}
        style={({ pressed }) => [styles.shopTap, pressed && styles.pressed]}
      >
        <View
          style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}
        >
          <Ionicons name="storefront" size={11} color={Brand.primary} />
          <ThemedText style={styles.badgeText}>ENTREPRISE</ThemedText>
        </View>
        <View
          style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}
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
        />
      ) : null}
    </View>
  );
}

/** Carte livreur / point relais (même gabarit que la carte boutique). */
export function ActorCard({
  actor,
  kind,
  followed,
  following,
  onFollow,
}: {
  actor: Actor;
  kind: "livreur" | "relais";
  followed?: boolean;
  following?: boolean;
  onFollow?: () => void;
}) {
  const theme = useTheme();
  const photo = thumb(actor.profilePicture, 160);
  const place = actor.localisation || actor.zone || actor.region || "—";
  const online = actor.disponible ?? actor.online;
  return (
    <View style={[styles.actorCard, { borderColor: theme.border }]}>
      <View
        style={[
          styles.actorAvatar,
          { backgroundColor: theme.backgroundSelected },
        ]}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.fill}
            contentFit="cover"
          />
        ) : (
          <ThemedText style={styles.avatarText}>
            {initials(actor.fullName)}
          </ThemedText>
        )}
        {online !== undefined ? (
          <View
            style={[
              styles.dot,
              {
                backgroundColor: online ? Brand.success : "#9AA6B8",
                borderColor: theme.background,
              },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.actorName}>
          {actor.fullName}
        </ThemedText>
        <View style={styles.placeRow}>
          <Ionicons
            name={kind === "livreur" ? "bicycle" : "location"}
            size={13}
            color={Brand.primary}
          />
          <ThemedText
            numberOfLines={1}
            type="small"
            themeColor="textSecondary"
            style={styles.flex}
          >
            {place}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          ⭐ {(actor.averageRating ?? 0).toFixed(1)} ·{" "}
          {kind === "livreur"
            ? `${actor.totalLivraisons ?? 0} livraisons`
            : `${actor.totalMissions ?? 0} missions`}
        </ThemedText>
      </View>
      {onFollow ? (
        <FollowButton
          compact
          followed={!!followed}
          loading={following}
          onPress={onFollow}
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

/** Carte produit — largeur imposée par la grille ou la rangée horizontale. */
export function ProductCard({
  product,
  width,
  onPress,
}: {
  product: Product;
  width: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const img = thumb(firstImage(product.images), 400);
  const promo = discountPercent(product.prix, product.prixAncien);
  const gros =
    product.venteEnGros && product.moq ? `Dès ${product.moq} unités` : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.nom}, ${formatPrice(product.prix)}`}
      style={({ pressed }) => [
        styles.pCard,
        { width, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[styles.pImgBox, { backgroundColor: theme.backgroundElement }]}
      >
        {img ? (
          <Image
            source={{ uri: img }}
            style={styles.fill}
            contentFit="cover"
            transition={150}
            recyclingKey={product.id}
          />
        ) : (
          <ThemedText style={styles.pEmoji}>
            {product.category?.icone || "📦"}
          </ThemedText>
        )}
        {promo ? (
          <View style={styles.promo}>
            <ThemedText style={styles.promoText}>−{promo}%</ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.pBody}>
        <ThemedText numberOfLines={2} style={styles.pName}>
          {product.nom}
        </ThemedText>
        <ThemedText numberOfLines={1} style={styles.pPrice}>
          {formatPrice(product.prix)}
        </ThemedText>
        {promo && product.prixAncien ? (
          <ThemedText
            numberOfLines={1}
            themeColor="textSecondary"
            style={styles.pOld}
          >
            {formatPrice(product.prixAncien)}
          </ThemedText>
        ) : gros ? (
          <ThemedText
            numberOfLines={1}
            themeColor="textSecondary"
            style={styles.pOld}
          >
            {gros}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Message d'erreur lisible + « Réessayer ». */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <View style={styles.state}>
      <ThemedText themeColor="textSecondary" style={styles.centerText}>
        {toUserMessage(error)}
      </ThemedText>
      <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>
          Réessayer
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** Bloc vide / erreur / chargement, pour qu'une section ne soit jamais « blanche ». */
export function SectionState({ children }: { children: ReactNode }) {
  return <View style={styles.state}>{children}</View>;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** « VÊTEMENTS & MODES » → « Vêtements & modes » (saisis en majuscules). */
export function capitalize(s: string) {
  if (s !== s.toUpperCase()) return s.charAt(0).toUpperCase() + s.slice(1);
  const low = s.toLocaleLowerCase("fr");
  return low.charAt(0).toUpperCase() + low.slice(1);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: "100%", height: "100%" },
  pressed: { opacity: 0.85 },
  // Titre de section
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    marginBottom: 12,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  dash: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: Brand.primary,
  },
  sectionTitle: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: Brand.primary,
  },
  sectionLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  // Cartes type / catégorie
  tileCard: {
    width: 104,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
  },
  tileThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  tileEmoji: { fontSize: 22, lineHeight: 28 },
  tileName: {
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "800",
    textAlign: "center",
    minHeight: 28,
  },
  tileMeta: { fontSize: 10.5, lineHeight: 13 },
  catIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  catEmoji: { fontSize: 20, lineHeight: 26 },
  catName: { fontWeight: "700" },
  // Boutique
  shopCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    alignItems: "center",
  },
  shopTap: { alignSelf: "stretch", alignItems: "center", gap: 6 },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: Brand.primary,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  avatarText: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: Brand.primary,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    minHeight: 44,
    justifyContent: "center",
  },
  shopName: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1,
  },
  shopDomain: { fontSize: 11.5, lineHeight: 15, letterSpacing: 0.5 },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  shopPlace: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "800",
    flexShrink: 1,
  },
  follow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 18,
    marginTop: 6,
    minWidth: 130,
  },
  followCompact: {
    minWidth: 0,
    paddingHorizontal: 12,
    minHeight: 36,
    marginTop: 0,
  },
  // Livreur / relais
  actorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  actorAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
  },
  actorName: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  dot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  // Produit
  pCard: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  pImgBox: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pEmoji: { fontSize: 40, lineHeight: 48 },
  promo: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: Brand.danger,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  promoText: { color: "#fff", fontSize: 11, lineHeight: 15, fontWeight: "800" },
  pBody: { padding: 10, gap: 2 },
  pName: { fontSize: 13.5, lineHeight: 18, fontWeight: "600", minHeight: 36 },
  pPrice: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: Brand.primary,
  },
  pOld: { fontSize: 12, lineHeight: 16, textDecorationLine: "line-through" },
  centerText: { textAlign: "center" },
  state: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    alignItems: "center",
    gap: Spacing.two,
  },
});

/**
 * Tuiles « type de boutique » et « catégorie » (fond gris léger, sélection en bleu).
 */
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import type { Category, CompanyType } from '@/features/catalog/api';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import { capitalize } from './text';

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
          borderColor: selected ? Brand.primary : "transparent",
          backgroundColor: selected
            ? theme.backgroundSelected
            : theme.backgroundElement,
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
              : theme.background,
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
          borderColor: selected ? Brand.primary : "transparent",
          backgroundColor: selected
            ? theme.backgroundSelected
            : theme.backgroundElement,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.catIconBox,
          { backgroundColor: theme.background },
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

const styles = StyleSheet.create({
  /* Cartes type / catégorie */
  tileCard: { width: 104, borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", gap: 6 },
  pressed: { opacity: 0.85 },
  tileThumb: { width: 44, height: 44, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  fill: { width: "100%", height: "100%" },
  tileEmoji: { fontSize: 22, lineHeight: 28 },
  tileName: { fontSize: 11.5, lineHeight: 14, fontWeight: "800", textAlign: "center", minHeight: 28 },
  tileMeta: { fontSize: 10.5, lineHeight: 13 },
  catIconBox: { width: 40, height: 40, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  catEmoji: { fontSize: 20, lineHeight: 26 },
  catName: { fontWeight: "700" },
});

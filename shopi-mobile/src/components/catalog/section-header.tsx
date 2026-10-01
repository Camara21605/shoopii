/**
 * Titre de section « — TYPES DE BOUTIQUES          Tout le catalogue → ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';

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

const styles = StyleSheet.create({
  /* Titre de section */
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.three, marginBottom: 12 },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  dash: { width: 18, height: 3, borderRadius: 2, backgroundColor: Brand.primary },
  sectionTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: "800", letterSpacing: 1.6, color: Brand.primary },
  sectionLink: { flexDirection: "row", alignItems: "center", gap: 4 },
});

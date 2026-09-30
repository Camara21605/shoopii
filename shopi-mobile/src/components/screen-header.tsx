/** Barre de titre d'un écran ouvert par-dessus les onglets : ← Titre. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { borderBottomColor: theme.border }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="Retour"
        hitSlop={10}
        style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </Pressable>
      <ThemedText style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </ThemedText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { padding: 4 },
  title: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: '800' },
});

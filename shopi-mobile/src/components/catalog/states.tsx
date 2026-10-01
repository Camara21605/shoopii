/**
 * États d'une section : erreur lisible + « Réessayer », bloc vide / chargement.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { toUserMessage } from '@/lib/api/errors';

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

const styles = StyleSheet.create({
  state: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.four, alignItems: "center", gap: Spacing.two },
  centerText: { textAlign: "center" },
});

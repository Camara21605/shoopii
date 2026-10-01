/**
 * Bloc numéroté de l'écran de commande (1 Articles · 2 Adresse · 3 Livraison · 4 Paiement).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Section({ step, title, subtitle, right, children }: { step: number; title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.head}>
        <View style={styles.step}>
          <ThemedText style={styles.stepText}>{step}</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {right}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 6 },
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontWeight: '900', fontSize: 14, lineHeight: 18 },
  flex: { flex: 1 },
  title: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  body: { padding: 14, paddingTop: 8, gap: 10 },
});

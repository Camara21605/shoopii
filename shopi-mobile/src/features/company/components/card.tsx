/**
 * Carte de tableau de bord : titre avec icône, action ou pastille à droite, contenu.
 * Aussi : ligne de synthèse (« Bénéfice net… ») et état vide.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function DashCard({ icon, title, right, children }: { icon: IconName; title: string; right?: ReactNode; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.head}>
        <View style={[styles.ico, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name={icon} size={16} color={Brand.primary} />
        </View>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {right}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

export function CardAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.action} accessibilityRole="button">
      <ThemedText type="smallBold" style={{ color: Brand.primary }}>
        {label}
      </ThemedText>
      <Ionicons name="arrow-forward" size={14} color={Brand.primary} />
    </Pressable>
  );
}

export function CardPill({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.pillText}>{label}</ThemedText>
    </View>
  );
}

/** Ligne de synthèse au-dessus d'un onglet (bénéfice net, retours du mois). */
export function SummaryLine({ icon, label, value, sub }: { icon: IconName; label: string; value: string; sub?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.line, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={18} color={Brand.primary} />
      <View style={styles.flex}>
        <ThemedText>
          {label} : <ThemedText style={styles.bold}>{value}</ThemedText>
        </ThemedText>
        {sub ? (
          <ThemedText type="small" themeColor="textSecondary">
            {sub}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

export function EmptyLine({ text }: { text: string }) {
  return (
    <ThemedText themeColor="textSecondary" style={styles.empty}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  ico: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  body: { padding: 14, paddingTop: 10, gap: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800', color: '#6B6B6B' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12 },
  flex: { flex: 1 },
  bold: { fontWeight: '900' },
  empty: { textAlign: 'center', paddingVertical: 14 },
});

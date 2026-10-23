/** Petits éléments partagés par les écrans Analytics et SEO & Marketing. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CARD = 'rgba(0,0,0,0.04)';

export function Box({ children }: { children: React.ReactNode }) {
  return <View style={styles.box}>{children}</View>;
}

export function Head({ icon, title, right }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.head}>
      <Ionicons name={icon} size={17} color={Brand.primary} />
      <ThemedText style={styles.headTitle}>{title}</ThemedText>
      {right}
    </View>
  );
}

export function Kpi({ icon, value, label }: { icon: string; value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.kpiIcon}>{icon}</ThemedText>
      <ThemedText style={styles.kpiV}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{label}</ThemedText>
    </View>
  );
}

export function Locked({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
      <ThemedText style={styles.h2}>Accès non autorisé</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headTitle: { flex: 1, fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  kpi: { flexBasis: '47%', flexGrow: 1, borderRadius: 14, padding: 12, gap: 1 },
  kpiIcon: { fontSize: 18, lineHeight: 24 },
  kpiV: { fontSize: 19, lineHeight: 25, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
});

/**
 * Onglet « Activité » de la Vue d'ensemble : fil des derniers événements
 * (commandes, avis…) en frise, partie importante en gras — texte échappé,
 * jamais interprété (il peut contenir un nom saisi librement par un client).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Overview } from '../api';
import { DashCard, EmptyLine } from './card';

/** Icônes Font Awesome du serveur → Ionicons. */
const ICON: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  'fa-box': { icon: 'cube', color: Brand.primary },
  'fa-star': { icon: 'star', color: '#D97706' },
  'fa-rotate-left': { icon: 'return-down-back', color: '#7C3AED' },
  'fa-heart': { icon: 'heart', color: '#DB2777' },
  'fa-user-plus': { icon: 'person-add', color: Brand.success },
};

function Highlighted({ txt, highlight }: { txt: string; highlight?: string }) {
  const i = highlight ? txt.indexOf(highlight) : -1;
  if (!highlight || i < 0) return <ThemedText style={styles.txt}>{txt}</ThemedText>;
  return (
    <ThemedText style={styles.txt}>
      {txt.slice(0, i)}
      <ThemedText style={[styles.txt, styles.bold]}>{highlight}</ThemedText>
      {txt.slice(i + highlight.length)}
    </ThemedText>
  );
}

export function ActivityTab({ data, loading }: { data: Overview; loading: boolean }) {
  const theme = useTheme();
  return (
    <DashCard icon="time-outline" title="Activité récente">
      {data.activite.length === 0 && !loading ? <EmptyLine text="Aucune activité récente." /> : null}
      {data.activite.map((a, i) => {
        const meta = ICON[a.icon] ?? { icon: 'ellipse' as const, color: Brand.primary };
        const last = i === data.activite.length - 1;
        return (
          <View key={`${a.time}${i}`} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: `${meta.color}1A` }]}>
                <Ionicons name={meta.icon} size={14} color={meta.color} />
              </View>
              {!last ? <View style={[styles.line, { backgroundColor: theme.border }]} /> : null}
            </View>
            <View style={styles.content}>
              <Highlighted txt={a.txt} highlight={a.highlight} />
              <ThemedText type="small" themeColor="textSecondary">
                {a.time}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </DashCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 30 },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 14, marginVertical: 2 },
  content: { flex: 1, paddingBottom: 14, gap: 2 },
  txt: { fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '800' },
});

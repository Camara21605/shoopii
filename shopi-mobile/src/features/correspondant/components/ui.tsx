/**
 * Briques des écrans correspondant : cadre d'écran (en-tête + barre du bas),
 * chiffre clé, encadré, état vide, pastille de statut, filtres à compteurs et
 * carte de colis (ouvre le détail du colis, où se valide la réception).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Snack, type SnackMsg } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { COLIS_STATUS, gnf, type Colis, type Tone } from '../api';
import { CorrespondantBottomNav } from './correspondant-bottom-nav';
import { CorrespondantHeader } from './correspondant-header';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const CARD = 'rgba(0,0,0,0.04)';

export function CorrespondantScreen({ title, subtitle, tab, children, snack }: { title: string; subtitle?: string; tab?: string; children: React.ReactNode; snack?: SnackMsg }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CorrespondantHeader title={title} subtitle={subtitle} />
      <View style={styles.flex}>{children}</View>
      <CorrespondantBottomNav active={tab} />
      {snack !== undefined ? <Snack msg={snack} bottom={96} /> : null}
    </SafeAreaView>
  );
}

export function Kpi({ icon, value, label, sub, onPress }: { icon: string; value: string; label: string; sub?: string; onPress?: () => void }) {
  const body = (
    <>
      <ThemedText style={styles.kpiIcon}>{icon}</ThemedText>
      <ThemedText style={styles.kpiV} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {label}
      </ThemedText>
      {sub ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {sub}
        </ThemedText>
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} : ${value}`} style={({ pressed }) => [styles.kpi, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.kpi} accessible accessibilityLabel={`${label} : ${value}`}>
      {body}
    </View>
  );
}

export function Box({ icon, title, action, onAction, children }: { icon: IconName; title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.box}>
      <View style={styles.boxHead}>
        <Ionicons name={icon} size={17} color={Brand.primary} />
        <ThemedText style={[styles.boxTitle, styles.flex]}>{title}</ThemedText>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={action} style={styles.boxAction}>
            <ThemedText type="smallBold">{action}</ThemedText>
            <Ionicons name="chevron-forward" size={14} color={Brand.primary} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Empty({ emoji, title, text }: { emoji: string; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <ThemedText style={styles.emptyEmoji}>{emoji}</ThemedText>
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      {text ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {text}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function Pill({ tone }: { tone: Tone }) {
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <ThemedText style={[styles.pillText, { color: tone.color }]}>{tone.label}</ThemedText>
    </View>
  );
}

/** Filtres horizontaux avec compteur (« Tous 12 · À réceptionner 3 … »). */
export function Filters<T extends string>({ items, value, onChange }: { items: { id: T; label: string; n?: number }[]; value: T; onChange: (v: T) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filtersBar}>
      {items.map((f) => {
        const on = f.id === value;
        return (
          <Pressable
            key={f.id}
            onPress={() => onChange(f.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={f.n != null ? `${f.label}, ${f.n}` : f.label}
            style={[styles.filter, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
            <ThemedText type="smallBold" style={{ color: on ? theme.text : theme.textSecondary }}>
              {f.label}
              {f.n != null ? ` · ${f.n}` : ''}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Carte d'un colis (liste Colis, Transferts, Retours, Vue d'ensemble) → détail du colis. */
export function ColisCard({ c }: { c: Colis }) {
  const theme = useTheme();
  const open = () => (c.uuid ? router.push({ pathname: '/correspondant/colis/[id]', params: { id: c.uuid } }) : undefined);
  return (
    <Pressable
      onPress={open}
      disabled={!c.uuid}
      accessibilityRole="button"
      accessibilityLabel={`Colis ${c.id}, ${c.nm}, ${COLIS_STATUS[c.status].label}${c.urgent ? ', urgent' : ''}. Ouvrir`}
      style={({ pressed }) => [styles.card, c.urgent && styles.cardUrgent, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIco, { backgroundColor: theme.background }]}>
          <ThemedText style={styles.emoji}>📦</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            {c.id} · {c.date}
          </ThemedText>
          <ThemedText style={styles.cardTitle} numberOfLines={1}>
            {c.nm}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            🏪 {c.boutique} · 👤 {c.client}
          </ThemedText>
        </View>
        <ThemedText style={styles.value}>{gnf(c.valeur)}</ThemedText>
      </View>
      <View style={styles.cardFoot}>
        <Pill tone={COLIS_STATUS[c.status]} />
        {c.urgent ? <Pill tone={{ label: '⚠ En attente depuis trop longtemps', color: Brand.danger, bg: '#FDECEC' }} /> : null}
        {c.livreur ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
            🛵 {c.livreur}
          </ThemedText>
        ) : null}
      </View>
      {c.motif ? (
        <ThemedText type="small" style={styles.motif}>
          Motif : {c.motif}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.85 },
  kpi: { flexBasis: '47%', flexGrow: 1, backgroundColor: CARD, borderRadius: 16, padding: 12, gap: 1 },
  kpiIcon: { fontSize: 18, lineHeight: 24 },
  kpiV: { fontSize: 21, lineHeight: 27, fontWeight: '900' },
  box: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 10 },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  boxTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  boxAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 36, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 40, lineHeight: 48 },
  emptyTitle: { fontSize: 16.5, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  pillText: { fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
  filtersBar: { flexGrow: 0 },
  filters: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filter: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  card: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 10 },
  cardUrgent: { borderWidth: 1.5, borderColor: '#F5C2C0' },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardIco: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22, lineHeight: 28 },
  cardTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  value: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  motif: { color: Brand.danger, fontWeight: '700' },
});

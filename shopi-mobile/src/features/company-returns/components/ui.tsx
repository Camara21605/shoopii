/**
 * Briques des écrans Retours & SAV : pastille colorée, rangée de puces de
 * filtre, carte retour, carte ticket SAV, sélecteur de priorité.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { formatDate, gnf, PRIORITIES, REASONS, RETURN_TYPES, SAV_STATUS, STATUS, type Priority, type ReturnSummary, type SavTicket } from '../api';

/** Fond des cartes : gris transparent (règle de l'application). */
export const CARD = 'rgba(0,0,0,0.04)';

export function Pill({ tone, small }: { tone: { label: string; color: string; bg: string }; small?: boolean }) {
  return (
    <View style={[styles.pill, small && styles.pillSmall, { backgroundColor: tone.bg }]}>
      <ThemedText style={[styles.pillText, small && styles.pillTextSmall, { color: tone.color }]}>{tone.label}</ThemedText>
    </View>
  );
}

export function FilterChips<T extends string>({ options, value, onChange, label }: { options: { value: T | undefined; label: string; count?: number }[]; value: T | undefined; onChange: (v: T | undefined) => void; label: string }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value ?? 'all'}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
            <ThemedText style={[styles.chipText, on && styles.chipOn]}>
              {o.label}
              {o.count != null ? ` (${o.count})` : ''}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ReturnCard({ r, onPress }: { r: ReturnSummary; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Retour ${r.reference}, ${r.productName}, ${STATUS[r.status].label}. Ouvrir`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        {r.productImage ? (
          <Image source={{ uri: r.productImage }} style={styles.thumb} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: theme.background }]}>
            <ThemedText style={styles.emoji}>📦</ThemedText>
          </View>
        )}
        <View style={styles.flex}>
          <View style={styles.topLine}>
            <ThemedText style={styles.ref}>{r.reference}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDate(r.createdAt)}
            </ThemedText>
          </View>
          <ThemedText style={styles.title} numberOfLines={1}>
            {r.productName}
            {r.quantity > 1 ? ` × ${r.quantity}` : ''}
          </ThemedText>
          {r.productVariant ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {r.productVariant}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {r.clientName} · {REASONS[r.reason]}
          </ThemedText>
        </View>
      </View>
      <View style={styles.tags}>
        <Pill tone={STATUS[r.status]} small />
        {r.priority !== 'normal' ? <Pill tone={PRIORITIES[r.priority]} small /> : null}
        <View style={[styles.pill, styles.pillSmall, { backgroundColor: theme.background }]}>
          <ThemedText style={[styles.pillTextSmall, { color: theme.textSecondary }]}>{RETURN_TYPES[r.returnType] ?? r.returnType}</ThemedText>
        </View>
        {r.evidenceCount ? (
          <View style={styles.evid}>
            <Ionicons name="images-outline" size={13} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {r.evidenceCount}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={[styles.money, { borderTopColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          Demandé
        </ThemedText>
        <ThemedText style={styles.amount}>{gnf(r.montantDemande)}</ThemedText>
      </View>
      {r.montantAccorde != null && r.montantAccorde !== r.montantDemande ? (
        <ThemedText type="small" style={styles.granted}>
          Accordé : {gnf(r.montantAccorde)}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

export function TicketCard({ t, onPress }: { t: SavTicket; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Ticket ${t.reference}, ${t.subject}${t.unreadCount ? `, ${t.unreadCount} non lus` : ''}. Ouvrir`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topLine}>
        <ThemedText style={styles.ref}>{t.reference}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(t.createdAt)}
        </ThemedText>
      </View>
      <ThemedText style={styles.title} numberOfLines={2}>
        {t.subject}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {t.clientName}
        {t.productName ? ` · ${t.productName}` : ''}
      </ThemedText>
      <View style={styles.tags}>
        <Pill tone={SAV_STATUS[t.status]} small />
        {t.priority !== 'normal' ? <Pill tone={PRIORITIES[t.priority]} small /> : null}
        <View style={styles.evid}>
          <Ionicons name="chatbubble-ellipses-outline" size={13} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {t.messageCount}
          </ThemedText>
        </View>
        {t.unreadCount > 0 ? (
          <View style={styles.unread}>
            <ThemedText style={styles.unreadText}>{t.unreadCount} non lu{t.unreadCount > 1 ? 's' : ''}</ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function PriorityPicker({ value, onChange, busy, disabled }: { value: Priority; onChange: (p: Priority) => void; busy?: boolean; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.prio} accessibilityRole="radiogroup" accessibilityLabel="Priorité">
      {(Object.keys(PRIORITIES) as Priority[]).map((p) => {
        const on = p === value;
        const tone = PRIORITIES[p];
        return (
          <Pressable
            key={p}
            onPress={() => !on && onChange(p)}
            disabled={disabled || busy}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: disabled || busy }}
            style={[styles.prioBtn, { borderColor: on ? tone.color : theme.border, backgroundColor: on ? tone.bg : theme.background }, (disabled || busy) && !on && styles.dim]}>
            <ThemedText type="small" style={{ color: on ? tone.color : theme.text, fontWeight: on ? '800' : '600' }}>
              {tone.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  dim: { opacity: 0.5 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillSmall: { paddingHorizontal: 8, paddingVertical: 1 },
  pillText: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  pillTextSmall: { fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipOn: { color: Brand.primaryInk, fontWeight: '800' },
  card: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24, lineHeight: 30 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ref: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  evid: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  money: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  amount: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  granted: { color: Brand.success, fontWeight: '700', textAlign: 'right' },
  unread: { backgroundColor: Brand.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  unreadText: { color: '#fff', fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
  prio: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prioBtn: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});

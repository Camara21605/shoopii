/**
 * Briques du réseau du livreur :
 *   · FollowControl  « S'abonner » ; une fois abonné, badge « Suivi(e) » + menu ⋮
 *                    (Se désabonner, Masquer des listes, Supprimer de la liste),
 *                    comme FollowButton du site (son propre compte n'est jamais listé) ;
 *   · ActorRow       ligne de liste (avatar, nom, lieu, note, compteur, statut) ;
 *   · Chips, SearchBox, Card (encadré de profil), InfoRow, KpiGrid, Tabs,
 *     EmptyCard, Avatar.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { initials } from '../api';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const CARD = 'rgba(0,0,0,0.04)';
const OK = { fg: '#047857', bg: '#ECFDF5' };

/* ── Avatar ────────────────────────────────────────────────────────── */

export function Avatar({ name, photo, size = 44, online, text }: { name: string; photo?: string | null; size?: number; online?: boolean; text?: string }) {
  const theme = useTheme();
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.ava, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.backgroundSelected }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <ThemedText style={[styles.avaText, { fontSize: size * 0.34, lineHeight: size * 0.44 }]}>{text ?? initials(name)}</ThemedText>
        )}
      </View>
      {online ? <View style={[styles.dot, { width: size * 0.27, height: size * 0.27, borderRadius: size }]} accessibilityLabel="En ligne" /> : null}
    </View>
  );
}

/* ── Abonnement ────────────────────────────────────────────────────── */

export function FollowControl({
  name,
  kindLabel,
  suivi,
  busy,
  onToggle,
  onHide,
  onRemove,
  large,
}: {
  name: string;
  /** « ce livreur », « ce correspondant » */
  kindLabel: string;
  suivi: boolean;
  busy?: boolean;
  onToggle: () => void;
  onHide: () => void;
  /** Absent sur un profil (il n'y a pas de liste d'où retirer la carte). */
  onRemove?: () => void;
  large?: boolean;
}) {
  const theme = useTheme();
  const [menu, setMenu] = useState(false);
  if (busy) return <ActivityIndicator color={Brand.primary} style={styles.busy} />;
  if (!suivi)
    return (
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={`S’abonner à ${name}`} style={[styles.follow, large && styles.followLarge]}>
        <Ionicons name="add" size={15} color="#fff" />
        <ThemedText style={styles.followText}>S’abonner</ThemedText>
      </Pressable>
    );
  return (
    <View style={styles.followed}>
      <View style={[styles.badge, { backgroundColor: OK.bg }, large && styles.followLarge]}>
        <Ionicons name="checkmark" size={14} color={OK.fg} />
        <ThemedText style={[styles.badgeText, { color: OK.fg }]}>Suivi(e)</ThemedText>
      </View>
      <Pressable onPress={() => setMenu(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Options d’abonnement — ${name}`} style={[styles.more, { borderColor: theme.border }]}>
        <Ionicons name="ellipsis-vertical" size={16} color={theme.text} />
      </Pressable>
      {menu ? (
        <BottomSheet title={name} onClose={() => setMenu(false)}>
          <MenuItem icon="person-remove-outline" label="Se désabonner" sub="Vous ne recevrez plus ses nouveautés." onPress={() => (setMenu(false), onToggle())} />
          <MenuItem icon="eye-off-outline" label="Masquer des listes" sub={`Vous restez abonné, mais ${kindLabel} n’apparaît plus dans les listes.`} onPress={() => (setMenu(false), onHide())} />
          {onRemove ? <MenuItem icon="trash-outline" label="Supprimer" sub="Se désabonner et retirer la carte de cette liste." danger onPress={() => (setMenu(false), onRemove())} /> : null}
        </BottomSheet>
      ) : null}
    </View>
  );
}

function MenuItem({ icon, label, sub, onPress, danger }: { icon: IconName; label: string; sub: string; onPress: () => void; danger?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}. ${sub}`} style={({ pressed }) => [styles.menuItem, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={20} color={danger ? Brand.danger : Brand.primary} />
      <View style={styles.flex}>
        <ThemedText style={[styles.bold, danger && { color: Brand.danger }]}>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {sub}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/* ── Ligne de liste ────────────────────────────────────────────────── */

export function ActorRow({
  name,
  photo,
  online,
  meta,
  status,
  onOpen,
  right,
}: {
  name: string;
  photo?: string | null;
  online?: boolean;
  meta: string[];
  status?: string;
  onOpen: () => void;
  right: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${name}. ${meta.join(', ')}. Voir le profil`} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
        <Avatar name={name} photo={photo} online={online} />
        <View style={styles.flex}>
          <ThemedText style={styles.rowName} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {meta.filter(Boolean).join(' · ')}
          </ThemedText>
          {status ? (
            <View style={[styles.status, { backgroundColor: OK.bg }]}>
              <ThemedText style={[styles.statusText, { color: OK.fg }]}>{status}</ThemedText>
            </View>
          ) : null}
        </View>
      </Pressable>
      {right}
    </View>
  );
}

/* ── Recherche + filtres ───────────────────────────────────────────── */

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: CARD }]}>
      <Ionicons name="search" size={17} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[styles.searchInput, { color: theme.text }]}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
          <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chips<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Pressable
            key={it.id}
            onPress={() => onChange(it.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? Brand.primary : CARD, borderColor: on ? Brand.primary : theme.border }]}>
            <ThemedText style={[styles.chipText, on && { color: '#fff' }]}>{it.label}</ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ── Profil : encadrés, lignes, chiffres, onglets ──────────────────── */

export function Card({ icon, title, right, children }: { icon: IconName; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name={icon} size={17} color={Brand.primary} />
        <ThemedText style={[styles.cardTitle, styles.flex]}>{title}</ThemedText>
        {right}
      </View>
      {children}
    </View>
  );
}

export function InfoRow({ icon, label, value, sub, last, action }: { icon: IconName; label: string; value: string; sub?: string; last?: boolean; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.info, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <View style={[styles.infoIco, { backgroundColor: theme.background }]}>
        <Ionicons name={icon} size={16} color={Brand.primary} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText style={styles.bold} selectable>
          {value}
        </ThemedText>
        {sub ? (
          <ThemedText type="small" themeColor="textSecondary">
            {sub}
          </ThemedText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function KpiGrid({ items }: { items: { v: string; l: string; badge?: string }[] }) {
  /* 2 ou 4 chiffres : grille 2 × 2 (en 3 colonnes, le 4e occupait seul toute une ligne) */
  const pairs = items.length === 2 || items.length === 4;
  return (
    <View style={styles.kpis}>
      {items.map((k) => (
        <View key={k.l} style={[styles.kpi, pairs && styles.kpiHalf]} accessible accessibilityLabel={`${k.l} : ${k.v}`}>
          {k.badge ? <ThemedText style={styles.kpiBadge}>{k.badge}</ThemedText> : null}
          <ThemedText style={styles.kpiV} numberOfLines={1} adjustsFontSizeToFit>
            {k.v}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {k.l}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon: IconName }[]; value: T; onChange: (t: T) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <Pressable key={t.id} onPress={() => onChange(t.id)} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }} style={[styles.tab, on && { borderBottomColor: Brand.primary }]}>
            <Ionicons name={t.icon} size={15} color={on ? Brand.primary : theme.textSecondary} />
            <ThemedText style={[styles.tabText, { color: on ? Brand.primary : theme.textSecondary }]}>{t.label}</ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function EmptyCard({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={28} color={theme.textSecondary} />
      <ThemedText style={styles.bold}>{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {text}
      </ThemedText>
    </View>
  );
}

export function Chip({ icon, label }: { icon?: IconName; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tag, { borderColor: theme.border }]}>
      {icon ? <Ionicons name={icon} size={12} color={Brand.primary} /> : null}
      <ThemedText style={styles.tagText}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  bold: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  fill: { width: '100%', height: '100%' },
  ava: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avaText: { fontWeight: '900', color: Brand.primary },
  dot: { position: 'absolute', right: 0, bottom: 0, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff' },
  busy: { width: 96 },
  follow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.primary, borderRadius: 999, paddingHorizontal: 12, minHeight: 34 },
  followLarge: { minHeight: 42, paddingHorizontal: 16 },
  followText: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  followed: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, minHeight: 32 },
  badgeText: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  more: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderRadius: 18, padding: 12 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowName: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  status: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, marginTop: 3 },
  statusText: { fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 34, justifyContent: 'center' },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  card: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  infoIco: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '31.5%', flexGrow: 1, backgroundColor: CARD, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  kpiHalf: { width: '48%' },
  kpiBadge: { fontSize: 10, lineHeight: 13, fontWeight: '900', color: '#047857' },
  kpiV: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  tabs: { gap: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  emptyCard: { backgroundColor: CARD, borderRadius: 18, padding: 24, alignItems: 'center', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
});

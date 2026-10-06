/**
 * Briques des écrans livreur : cadre d'écran (en-tête + barre du bas + liste
 * qui cache la barre en défilant), chiffre clé, encadré, état vide, carte de
 * mission (comme MissionCard du site), feuille « Refuser la mission ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { Snack, type SnackMsg } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { gnf, MISSION_STATUS, REFUSE_REASONS, type Mission } from '../api';
import { LivreurBottomNav } from './livreur-bottom-nav';
import { LivreurHeader } from './livreur-header';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const CARD = 'rgba(0,0,0,0.04)';

export function LivreurScreen({ title, subtitle, tab, children, snack }: { title: string; subtitle?: string; tab?: string; children: React.ReactNode; snack?: SnackMsg }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <LivreurHeader title={title} subtitle={subtitle} />
      <View style={styles.flex}>{children}</View>
      <LivreurBottomNav active={tab} />
      {snack !== undefined ? <Snack msg={snack} bottom={96} /> : null}
    </SafeAreaView>
  );
}

export function Kpi({ icon, value, label, sub }: { icon: string; value: string; label: string; sub?: string }) {
  return (
    <View style={styles.kpi} accessible accessibilityLabel={`${label} : ${value}`}>
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
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" style={styles.boxAction}>
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

export function Pill({ tone }: { tone: { label: string; color: string; bg: string } }) {
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <ThemedText style={[styles.pillText, { color: tone.color }]}>{tone.label}</ThemedText>
    </View>
  );
}

export function MissionCard({ m, onOpen, onAccept, onRefuse, busy }: { m: Mission; onOpen: () => void; onAccept: () => void; onRefuse: () => void; busy?: boolean }) {
  const theme = useTheme();
  const pickup = (m.status === 'new' || m.status === 'prep') && (m.companyAdresse || m.companyRepere || m.companyTelephone);
  /* Boutons À CÔTÉ de la zone qui ouvre le détail (pas dedans) : deux boutons
   * imbriqués sont invalides sur le web et gênent les lecteurs d'écran. */
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Mission ${m.id}, ${m.nm}, ${m.shop}. Ouvrir`} style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIco, { backgroundColor: theme.background }]}>
          <ThemedText style={styles.emoji}>📦</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            {m.id} · {m.date}
          </ThemedText>
          <ThemedText style={styles.cardTitle} numberOfLines={1}>
            {m.nm}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            🏪 {m.shop} · {m.client}
          </ThemedText>
        </View>
        <Pill tone={MISSION_STATUS[m.status]} />
      </View>

      <View style={styles.route}>
        <View style={[styles.dot, { backgroundColor: Brand.success }]} />
        <ThemedText type="small" numberOfLines={1} style={styles.routeText}>
          {m.from || 'Boutique'}
        </ThemedText>
        <Ionicons name="arrow-forward" size={13} color={theme.textSecondary} />
        <ThemedText type="small" numberOfLines={1} style={styles.routeText}>
          {m.to}
        </ThemedText>
        <View style={[styles.dot, { backgroundColor: Brand.danger }]} />
      </View>
      </Pressable>

      {pickup ? (
        <View style={[styles.pickup, { backgroundColor: theme.background }]}>
          <ThemedText type="smallBold">🏪 Où récupérer le colis</ThemedText>
          {m.companyAdresse ? <ThemedText type="small">{m.companyAdresse}</ThemedText> : null}
          {m.companyRepere ? (
            <ThemedText type="small">
              <ThemedText type="smallBold">Repère : </ThemedText>
              {m.companyRepere}
            </ThemedText>
          ) : null}
          {m.companyTelephone ? (
            <Pressable onPress={() => void Linking.openURL(`tel:${m.companyTelephone!.replace(/\s+/g, '')}`)} accessibilityRole="button" style={styles.call}>
              <Ionicons name="call-outline" size={14} color={Brand.primary} />
              <ThemedText type="smallBold">Appeler la boutique · {m.companyTelephone}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.actions, { borderTopColor: theme.border }]}>
        {m.status === 'new' ? (
          <>
            <Pressable onPress={onAccept} disabled={busy} accessibilityRole="button" accessibilityLabel={`Accepter la mission ${m.id}`} style={[styles.btn, styles.btnMain]}>
              {busy ? <ActivityIndicator color={Brand.primaryInk} /> : <Ionicons name="checkmark" size={17} color={Brand.primaryInk} />}
              <ThemedText type="smallBold">Accepter</ThemedText>
            </Pressable>
            <Pressable onPress={onRefuse} disabled={busy} accessibilityRole="button" accessibilityLabel={`Refuser la mission ${m.id}`} style={[styles.btn, styles.btnDanger]}>
              <Ionicons name="close" size={17} color={Brand.danger} />
            </Pressable>
          </>
        ) : (
          <Pressable onPress={onOpen} accessibilityRole="button" style={[styles.btn, styles.btnMain]}>
            <Ionicons name="cube-outline" size={17} color={Brand.primaryInk} />
            <ThemedText type="smallBold">{m.status === 'prep' ? 'Récupérer le colis' : 'Voir la commande'}</ThemedText>
          </Pressable>
        )}
        <ThemedText style={styles.fee}>{gnf(m.fee)}</ThemedText>
      </View>
    </View>
  );
}

/** Motif obligatoire, comme RefuseMissionModal du site. */
export function RefuseSheet({ m, onClose, onConfirm }: { m: Mission; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const theme = useTheme();
  const [choice, setChoice] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);
  const reason = choice === 'Autre' ? detail.trim() : (choice ?? '');
  const confirm = async () => {
    setSaving(true);
    try {
      await onConfirm(reason);
    } finally {
      setSaving(false);
    }
  };
  return (
    <BottomSheet title={`Refuser la mission ${m.id}`} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <ThemedText type="small" themeColor="textSecondary">
          {m.shop} · {m.client}
        </ThemedText>
        <View style={styles.warn}>
          <ThemedText type="small">La boutique devra choisir un autre livreur. Indiquez pourquoi vous refusez.</ThemedText>
        </View>
        <ThemedText type="smallBold">Motif</ThemedText>
        <View style={styles.reasons} accessibilityRole="radiogroup">
          {REFUSE_REASONS.map((r) => {
            const on = choice === r;
            return (
              <Pressable key={r} onPress={() => setChoice(r)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.reason, { borderColor: on ? Brand.danger : theme.border, backgroundColor: on ? '#FDECEC' : theme.background }]}>
                <ThemedText type="smallBold" style={on ? { color: Brand.danger } : undefined}>
                  {r}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {choice === 'Autre' ? (
          <TextInput value={detail} onChangeText={setDetail} placeholder="Précisez le motif…" placeholderTextColor={theme.textSecondary} maxLength={300} multiline autoFocus style={[styles.input, { color: theme.text, borderColor: theme.border }]} accessibilityLabel="Motif du refus" />
        ) : null}
        <Pressable onPress={() => void confirm()} disabled={!reason || saving} accessibilityRole="button" style={[styles.confirm, (!reason || saving) && styles.dim]}>
          {saving ? <ActivityIndicator color={Brand.danger} /> : <ThemedText style={styles.confirmText}>Confirmer le refus</ThemedText>}
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.85 },
  dim: { opacity: 0.45 },
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
  card: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 10 },
  cardMain: { gap: 10 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardIco: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22, lineHeight: 28 },
  cardTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  route: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeText: { flexShrink: 1, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pickup: { borderRadius: 12, padding: 10, gap: 3 },
  call: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, minHeight: 42, paddingHorizontal: 14, borderWidth: 1 },
  btnMain: { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine },
  btnDanger: { borderColor: '#F5C2C0', backgroundColor: '#FDECEC', width: 42, paddingHorizontal: 0 },
  fee: { marginLeft: 'auto', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  sheet: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  warn: { backgroundColor: '#FDECEC', borderRadius: 12, padding: 12 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reason: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 15 },
  confirm: { alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 999, borderWidth: 1, borderColor: '#F5C2C0', backgroundColor: '#FDECEC' },
  confirmText: { color: Brand.danger, fontWeight: '800' },
});

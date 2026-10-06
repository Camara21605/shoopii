/**
 * Briques des écrans Clients : avatar, pastille de segment, pastille de source,
 * carte client (reprend les colonnes du tableau du site), feuille du bas.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { gnf, initials, relative, SEGMENTS, type ClientRow, type Segment } from '../api';

export function ClientAvatar({ name, photo, size = 46 }: { name: string; photo?: string | null; size?: number }) {
  return photo ? (
    <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityIgnoresInvertColors />
  ) : (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
      <ThemedText style={[styles.initialsText, { fontSize: size * 0.34, lineHeight: size * 0.44 }]}>{initials(name)}</ThemedText>
    </View>
  );
}

export function SegmentPill({ seg, big }: { seg: Segment; big?: boolean }) {
  const m = SEGMENTS[seg];
  return (
    <View style={[styles.pill, big && styles.pillBig, { backgroundColor: m.bg }]}>
      <ThemedText style={[styles.pillText, big && styles.pillTextBig, { color: m.color }]}>
        {m.emoji} {m.label}
      </ThemedText>
    </View>
  );
}

/** Acheteur, abonné ou les deux — même badge que la colonne « Source » du site. */
export function SourcePill({ isSuivi, totalOrders }: { isSuivi: boolean; totalOrders: number }) {
  const theme = useTheme();
  const label = totalOrders > 0 && isSuivi ? '🛒 Acheteur · 👁️ Abonné' : totalOrders > 0 ? '🛒 Acheteur' : '👁️ Abonné';
  return (
    <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={[styles.pillText, { color: theme.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

export function ClientCard({ c, onPress, onMessage, messaging }: { c: ClientRow; onPress: () => void; onMessage?: () => void; messaging?: boolean }) {
  const theme = useTheme();
  /* Le bouton « Message » est posé À CÔTÉ de la carte (et non dedans) : deux
   * boutons imbriqués sont invalides sur le web et gênent les lecteurs d'écran. */
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${c.fullName}, ${SEGMENTS[c.segment].label}. Ouvrir le profil`}
        style={({ pressed }) => [styles.card, { borderColor: theme.border, backgroundColor: theme.background }, pressed && styles.pressed]}>
        <View style={[styles.top, onMessage && styles.topWithMsg]}>
          <ClientAvatar name={c.fullName} photo={c.profilePicture} />
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {c.fullName}
              </ThemedText>
              {c.isSuivi ? <Ionicons name="checkmark-circle" size={15} color={Brand.success} accessibilityLabel="Abonné" /> : null}
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {c.email}
            </ThemedText>
          </View>
        </View>

        <View style={styles.tags}>
          <SegmentPill seg={c.segment} />
          <SourcePill isSuivi={c.isSuivi} totalOrders={c.totalOrders} />
        </View>

        <View style={[styles.metrics, { borderTopColor: theme.border }]}>
          <Metric label="Commandes" value={c.totalOrders > 0 ? String(c.totalOrders) : '—'} />
          <Metric label="Total dépensé" value={c.totalSpent > 0 ? gnf(c.totalSpent) : '—'} />
          <Metric label="Dernière cmd" value={relative(c.lastOrderAt)} />
        </View>
      </Pressable>
      {onMessage ? (
        <Pressable onPress={onMessage} disabled={messaging} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Écrire à ${c.fullName}`} style={[styles.msg, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Brand.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <ThemedText style={styles.metricV} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

const TALL = Math.round(Dimensions.get('window').height * 0.85);

export function Sheet({ title, icon, onClose, children, footer }: { title: string; icon?: React.ComponentProps<typeof Ionicons>['name']; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" accessibilityRole="button" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.background }]} accessibilityViewIsModal>
            <View style={[styles.grip, { backgroundColor: theme.border }]} />
            <View style={styles.head}>
              {icon ? (
                <View style={styles.headIco}>
                  <Ionicons name={icon} size={18} color={Brand.primary} />
                </View>
              ) : null}
              <ThemedText style={styles.title} numberOfLines={1} accessibilityRole="header">
                {title}
              </ThemedText>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer" style={[styles.close, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            {children}
            {footer ? <View style={[styles.footer, { borderTopColor: theme.border }]}>{footer}</View> : null}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  initials: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: Brand.primaryInk, fontWeight: '800' },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  pillBig: { paddingHorizontal: 11, paddingVertical: 4 },
  pillText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  pillTextBig: { fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 15.5, lineHeight: 20, fontWeight: '800', flexShrink: 1 },
  topWithMsg: { paddingRight: 48 },
  msg: { position: 'absolute', top: 17, right: 14, width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metrics: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  metric: { flex: 1, gap: 1 },
  metricV: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, maxHeight: TALL },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  headIco: { width: 36, height: 36, borderRadius: 12, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
});

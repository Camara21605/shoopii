/**
 * Carte d'une commande dans la liste : vignettes des articles (jusqu'à 3 +N),
 * numéro, date, client, articles, total, statut et livreur (assigner /
 * en attente de sa réponse / refusé — à réassigner).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import { gnf, STATUS, type Order, type OrderStatus } from '../api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function StatusPill({ status, long }: { status: OrderStatus; long?: boolean }) {
  const s = STATUS[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon as IconName} size={11} color={s.color} />
      <ThemedText style={[styles.pillText, { color: s.color }]}>{long ? s.label : s.short}</ThemedText>
    </View>
  );
}

export function Thumbs({ order, size = 52 }: { order: Pick<Order, 'items' | 'imageUrl'>; size?: number }) {
  const theme = useTheme();
  const items = order.items.length ? order.items : [{ nm: '', imageUrl: order.imageUrl, vt: null, qty: 1 }];
  const visible = items.slice(0, 3);
  const extra = items.length - visible.length;
  const width = size + (visible.length - 1) * 12 + (extra > 0 ? 12 : 0);
  return (
    <View style={{ width, height: size }}>
      {visible.map((it, i) => {
        const uri = thumb(it.imageUrl, 160);
        return (
          <View key={i} style={[styles.thumb, { width: size, height: size, left: i * 12, zIndex: 3 - i, backgroundColor: theme.backgroundElement }]}>
            {uri ? <Image source={{ uri }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons name="cube-outline" size={size * 0.42} color={theme.textSecondary} />}
          </View>
        );
      })}
      {extra > 0 ? (
        <View style={[styles.thumb, styles.extra, { width: size, height: size, left: visible.length * 12, zIndex: 4 }]}>
          <ThemedText style={styles.extraText}>+{extra}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export function DriverLine({ order, canAssign, onAssign }: { order: Order; canAssign: boolean; onAssign?: () => void }) {
  const theme = useTheme();
  const has = order.livreur && order.livreur !== '—';
  const st = order.livreurAssignmentStatus;
  const tone = st === 'refused' ? Brand.danger : st === 'pending' ? '#B45309' : theme.textSecondary;
  const label = !has
    ? 'Aucun livreur'
    : st === 'pending'
      ? `${order.livreur} · en attente de sa réponse`
      : st === 'refused'
        ? `${order.livreur} a refusé — à réassigner`
        : order.livreur;
  const actionable = canAssign && onAssign && order.status !== 'del' && order.status !== 'can';
  return (
    <View style={styles.driver}>
      <Ionicons name={st === 'refused' ? 'alert-circle' : 'bicycle-outline'} size={15} color={tone} />
      <ThemedText type="small" style={[styles.flex, { color: tone }]} numberOfLines={1}>
        {label}
      </ThemedText>
      {actionable ? (
        <Pressable onPress={onAssign} hitSlop={8} accessibilityRole="button" style={styles.assign}>
          <ThemedText style={styles.assignText}>{has && st !== 'refused' ? 'Changer' : 'Assigner'}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function OrderCard({ order, canAssign, onPress, onAssign }: { order: Order; canAssign: boolean; onPress: () => void; onAssign: () => void }) {
  const theme = useTheme();
  const more = order.items.length - 1;
  return (
    <View style={[styles.card, { borderColor: order.status === 'new' ? Brand.primaryLine : theme.border }]}>
      {/* Zone principale (ouvre le détail) — la ligne livreur reste en dehors : pas de bouton dans un bouton */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Commande ${order.id}, ${order.client}, ${gnf(order.price)}, ${STATUS[order.status].short}`}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}>
        <View style={styles.top}>
          <ThemedText style={styles.id}>{order.id}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            · {order.date}
          </ThemedText>
          <View style={styles.flex} />
          <StatusPill status={order.status} />
        </View>
        <View style={styles.body}>
          <Thumbs order={order} />
          <View style={styles.flex}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {order.items[0]?.nm || order.nm}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {order.items[0]?.qty ? `× ${order.items[0].qty}` : ''}
              {order.items[0]?.vt ? ` · ${order.items[0].vt}` : ''}
              {more > 0 ? ` · + ${more} autre${more > 1 ? 's' : ''} article${more > 1 ? 's' : ''}` : ''}
            </ThemedText>
            <View style={styles.clientRow}>
              <Ionicons name="person-outline" size={13} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
                {order.client}
                {order.zone && order.zone !== '—' ? ` · ${order.zone}` : ''}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={styles.price}>{gnf(order.price)}</ThemedText>
        </View>
      </Pressable>
      <View style={[styles.sep, { backgroundColor: theme.border }]} />
      <DriverLine order={order} canAssign={canAssign} onAssign={onAssign} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  thumb: { position: 'absolute', top: 0, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  extra: { backgroundColor: Brand.primarySoft },
  extraText: { color: Brand.primaryInk, fontWeight: '900', fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10, backgroundColor: '#fff' },
  main: { gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  id: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  body: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  price: { fontSize: 14.5, lineHeight: 19, fontWeight: '900' },
  sep: { height: StyleSheet.hairlineWidth },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assign: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  assignText: { color: Brand.primaryInk, fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
});

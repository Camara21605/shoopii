/**
 * Onglet « Commandes » de la Vue d'ensemble (comme le site) :
 *   · retours du mois (en traitement, remboursés) ;
 *   · alertes prioritaires de stock (rupture en rouge, stock bas en orange) + « Réappro » ;
 *   · dernières commandes (produit, client, montant, statut) + « Tout voir ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { formatPrice } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import type { Overview } from '../api';
import { CardAction, CardPill, DashCard, EmptyLine, SummaryLine } from './card';

/** Statuts du serveur (mapOrderStatus) : new · prep · ship · del · can — libellés du site. */
const STATUS: Record<string, { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  new: { label: 'Nouveau', color: '#E8843F', icon: 'ellipse' },
  prep: { label: 'En prépa', color: '#D97706', icon: 'construct' },
  ship: { label: 'Livraison', color: '#7C3AED', icon: 'bicycle' },
  del: { label: 'Livré', color: '#059669', icon: 'checkmark-circle' },
  can: { label: 'Annulé', color: '#DC2626', icon: 'close-circle' },
};

export function OrdersTab({
  data,
  loading,
  onRestock,
  onSeeAll,
  onOpenOrder,
}: {
  data: Overview;
  loading: boolean;
  onRestock: () => void;
  onSeeAll: () => void;
  onOpenOrder: (uuid: string) => void;
}) {
  const theme = useTheme();
  const { kpis, stockAlertes, dernieresCommandes } = data;
  return (
    <View style={styles.gap}>
      <SummaryLine
        icon="return-down-back-outline"
        label="Retours ce mois"
        value={String(kpis.retoursCeMois)}
        sub={`${kpis.retoursEnTraitement} en traitement · ${kpis.retoursRembourses} remboursés`}
      />

      <DashCard icon="warning-outline" title="Alertes prioritaires" right={<CardPill label={`${stockAlertes.length} alerte${stockAlertes.length > 1 ? 's' : ''}`} />}>
        {stockAlertes.length === 0 && !loading ? <EmptyLine text="Aucune alerte de stock." /> : null}
        {stockAlertes.slice(0, 5).map((a, i) => {
          const red = a.type === 'red';
          const color = red ? Brand.danger : '#D97706';
          return (
            <View key={`${a.nm}${i}`} style={[styles.alert, { backgroundColor: red ? '#FDECEC' : '#FEF3C7' }]}>
              <Ionicons name={red ? 'close-circle' : 'warning'} size={20} color={color} />
              <View style={styles.flex}>
                <ThemedText numberOfLines={1} style={styles.bold}>
                  {a.em} {a.nm}
                </ThemedText>
                <ThemedText type="small" style={{ color }}>
                  Stock : {a.qty} · Min requis : {a.min}
                </ThemedText>
              </View>
              <Pressable onPress={onRestock} style={[styles.fix, { borderColor: color }]} accessibilityRole="button" accessibilityLabel={`Réapprovisionner ${a.nm}`}>
                <ThemedText type="smallBold" style={{ color }}>
                  Réappro
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
      </DashCard>

      <DashCard icon="cube-outline" title="Dernières commandes" right={<CardAction label="Tout voir" onPress={onSeeAll} />}>
        {dernieresCommandes.length === 0 && !loading ? <EmptyLine text="Aucune commande pour l’instant." /> : null}
        {dernieresCommandes.map((o, i) => {
          const st = STATUS[o.status] ?? STATUS.new;
          return (
            <Pressable
              key={o.id}
              onPress={() => o.uuid && onOpenOrder(o.uuid)}
              disabled={!o.uuid}
              accessibilityRole="button"
              accessibilityLabel={`Commande ${o.id}, ${o.client}, ${st.label}`}
              style={({ pressed }) => [styles.order, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && styles.pressed]}>
              <View style={[styles.em, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.emText}>{o.em}</ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText numberOfLines={1} style={styles.bold}>
                  {o.nm}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {[o.id, o.vt, o.client].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
              <View style={styles.right}>
                <ThemedText style={styles.price}>{formatPrice(o.price)}</ThemedText>
                <View style={[styles.pill, { backgroundColor: `${st.color}14` }]}>
                  <Ionicons name={st.icon} size={10} color={st.color} />
                  <ThemedText style={[styles.pillText, { color: st.color }]}>{st.label}</ThemedText>
                </View>
              </View>
            </Pressable>
          );
        })}
      </DashCard>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.7 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 10 },
  fix: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#fff' },
  order: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  em: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emText: { fontSize: 20, lineHeight: 26 },
  right: { alignItems: 'flex-end', gap: 4 },
  price: { fontSize: 13.5, lineHeight: 18, fontWeight: '900' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
});

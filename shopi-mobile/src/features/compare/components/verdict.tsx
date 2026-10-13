/**
 * « L'avis Shoneya » — meilleur choix global, ses raisons, puis les faits utiles
 * (économie possible, meilleure garantie, ruptures, stocks faibles).
 * Même contenu que le bloc « L'avis Shopi » du site.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { formatPrice } from '@/features/catalog/format';
import type { ProductDetail } from '@/features/product/api';

import { REASON_LABEL, type Insights } from '../insights';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Verdict({ produits, insights }: { produits: ProductDetail[]; insights: Insights }) {
  if (produits.length < 2 || !insights.bestId) return null;
  const nom = (id: string | null) => produits.find((p) => p.id === id)?.nom ?? '';
  const stock = (id: string) => produits.find((p) => p.id === id)?.stock ?? 0;

  const facts: { icon: IconName; text: string; warn?: boolean }[] = [];
  if (insights.cheapestId && insights.ecartPrix > 0)
    facts.push({ icon: 'cash-outline', text: `Choisir ${nom(insights.cheapestId)} vous fait économiser jusqu’à ${formatPrice(insights.ecartPrix)}.` });
  if (insights.bestGarantieId) facts.push({ icon: 'shield-checkmark-outline', text: `${nom(insights.bestGarantieId)} offre la garantie la plus longue.` });
  insights.outOfStock.forEach((id) => facts.push({ icon: 'ban-outline', text: `${nom(id)} est en rupture de stock.`, warn: true }));
  insights.lowStock.forEach((id) => facts.push({ icon: 'hourglass-outline', text: `${nom(id)} : plus que ${stock(id)} en stock.`, warn: true }));

  return (
    <View style={styles.box} accessibilityRole="summary">
      <View style={styles.head}>
        <Ionicons name="sparkles" size={15} color={Brand.success} />
        <ThemedText style={styles.kicker}>L’avis Shoneya</ThemedText>
      </View>
      <ThemedText style={styles.main}>
        {insights.serre ? `Match serré — léger avantage pour ${nom(insights.bestId)}` : `Meilleur choix : ${nom(insights.bestId)}`}
      </ThemedText>
      {insights.reasons.length ? (
        <View style={styles.reasons}>
          {insights.reasons.map((r) => (
            <View key={r} style={styles.reason}>
              <Ionicons name="checkmark" size={13} color={Brand.success} />
              <ThemedText style={styles.reasonText}>{REASON_LABEL[r]}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}
      {facts.map((f) => (
        <View key={f.text} style={styles.fact}>
          <Ionicons name={f.icon} size={16} color={f.warn ? '#B45309' : '#1F1F1F'} />
          <ThemedText type="small" style={[styles.factText, f.warn ? styles.warn : null]}>
            {f.text}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: 16, borderRadius: 18, padding: 14, gap: 8, backgroundColor: 'rgba(15,157,88,0.07)', borderWidth: 1, borderColor: 'rgba(15,157,88,0.25)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', color: Brand.success },
  main: { fontSize: 17, lineHeight: 23, fontWeight: '900' },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  reasonText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  factText: { flex: 1, lineHeight: 19 },
  warn: { color: '#B45309', fontWeight: '600' },
});

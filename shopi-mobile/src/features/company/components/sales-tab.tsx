/**
 * Onglet « Ventes » de la Vue d'ensemble (comme le site) :
 *   · bénéfice net du mois (marge, commissions) ;
 *   · chiffre d'affaires mensuel en barres (mois en cours en bleu foncé) ;
 *   · top produits (rang, ventes, tendance vs mois dernier, CA) ;
 *   · répartition des ventes par catégorie (anneau + légende).
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Overview } from '../api';
import { DashCard, EmptyLine, SummaryLine } from './card';

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const PALETTE = ['#111111', '#7C3AED', '#059669', '#D97706', '#DB2777', '#525252', '#737373'];
const CHART_H = 150;

export function SalesTab({ data, loading }: { data: Overview; loading: boolean }) {
  const theme = useTheme();
  const { kpis, caData, topProduits, categoryBreakdown } = data;
  const maxCA = Math.max(1, ...caData.map((d) => d.v));
  const maxVentes = Math.max(1, ...topProduits.map((p) => p.ventes));

  return (
    <View style={styles.gap}>
      <SummaryLine
        icon="cash-outline"
        label="Bénéfice net (ce mois)"
        value={`${fmt(kpis.beneficeNet)} GNF`}
        sub={`Marge : ${kpis.margePct}% · Commissions : ${fmt(kpis.commissionCeMois)} GNF`}
      />

      <DashCard icon="bar-chart-outline" title="Chiffre d’affaires mensuel">
        {caData.length === 0 && !loading ? (
          <EmptyLine text="Aucune vente livrée pour l’instant." />
        ) : (
          <>
            <View style={styles.chart} accessibilityLabel={`Chiffre d'affaires : ${caData.map((d) => `${d.m} ${d.v} millions`).join(', ')}`}>
              {caData.map((d, i) => {
                const last = i === caData.length - 1;
                return (
                  <View key={`${d.m}${i}`} style={styles.barCol}>
                    <ThemedText style={[styles.barV, last && { color: Brand.primary }]}>{d.v}M</ThemedText>
                    <View style={[styles.bar, { height: Math.max(4, (d.v / maxCA) * CHART_H), backgroundColor: last ? '#111111' : '#D4D4D4' }]} />
                    <ThemedText style={styles.barL}>{d.m}</ThemedText>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <Legend color="#111111" label="Mois en cours (millions GNF)" />
              <Legend color="#D4D4D4" label="Mois précédents" />
            </View>
          </>
        )}
      </DashCard>

      <DashCard icon="trophy-outline" title="Top produits">
        {topProduits.length === 0 && !loading ? <EmptyLine text="Aucune vente pour l’instant." /> : null}
        {topProduits.map((p, i) => {
          const color = p.trend === 'up' ? Brand.success : p.trend === 'dn' ? Brand.danger : theme.textSecondary;
          return (
            <View key={`${p.nm}${i}`} style={styles.tpRow}>
              <View style={[styles.rank, i === 0 && { backgroundColor: '#FEF3C7' }]}>
                <ThemedText style={[styles.rankText, i === 0 && { color: '#B45309' }]}>{i + 1}</ThemedText>
              </View>
              <ThemedText style={styles.tpEm}>{p.em}</ThemedText>
              <View style={styles.flex}>
                <ThemedText numberOfLines={1} style={styles.tpName}>
                  {p.nm}
                </ThemedText>
                <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                  <View style={[styles.fill, { width: `${(p.ventes / maxVentes) * 100}%` }]} />
                </View>
              </View>
              <View style={styles.tpStats}>
                <ThemedText style={styles.tpVentes}>
                  {p.ventes} vente{p.ventes > 1 ? 's' : ''}
                </ThemedText>
                <ThemedText style={[styles.tpTrend, { color }]}>
                  {p.trend === 'up' ? '↑' : p.trend === 'dn' ? '↓' : '—'} {p.ca}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </DashCard>

      <DashCard icon="pie-chart-outline" title="Répartition des ventes">
        {categoryBreakdown.length === 0 && !loading ? (
          <EmptyLine text="Aucune vente pour l’instant." />
        ) : (
          <View style={styles.donutRow}>
            <Donut parts={categoryBreakdown.map((c, i) => ({ pct: c.pct, color: PALETTE[i % PALETTE.length] }))} />
            <View style={[styles.flex, styles.legendCol]}>
              {categoryBreakdown.map((c, i) => (
                <View key={c.label} style={styles.dlRow}>
                  <View style={[styles.dot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
                  <ThemedText numberOfLines={1} style={[styles.flex, styles.dlLabel]}>
                    {c.label}
                  </ThemedText>
                  <ThemedText style={styles.dlPct}>{c.pct}%</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}
      </DashCard>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** Anneau SVG : un arc par catégorie (pourcentages du serveur). */
function Donut({ parts }: { parts: { pct: number; color: string }[] }) {
  const size = 120;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  /* Longueur et départ de chaque arc, calculés avant le rendu. */
  const arcs = parts.reduce<{ len: number; start: number; color: string }[]>((acc, p) => {
    const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].len : 0;
    return [...acc, { len: (Math.max(0, p.pct) / 100) * c, start, color: p.color }];
  }, []);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF2F7" strokeWidth={stroke} fill="none" />
      {arcs.map((a, i) => (
        <Circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={a.color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${a.len} ${c - a.len}`}
          strokeDashoffset={-a.start}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  flex: { flex: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, height: CHART_H + 40 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barV: { fontSize: 10, lineHeight: 13, fontWeight: '800', color: '#6B6B6B' },
  barL: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#6B6B6B' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, lineHeight: 16, fontWeight: '900', color: '#6B6B6B' },
  tpEm: { fontSize: 20, lineHeight: 26 },
  tpName: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: Brand.primary },
  tpStats: { alignItems: 'flex-end', minWidth: 74 },
  tpVentes: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  tpTrend: { fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legendCol: { gap: 8 },
  dlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dlLabel: { fontSize: 13.5, lineHeight: 18 },
  dlPct: { fontSize: 13.5, lineHeight: 18, fontWeight: '900' },
});

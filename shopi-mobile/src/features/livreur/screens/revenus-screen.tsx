/**
 * Espace livreur › Mes revenus — équivalent mobile de /dashboard/livreur/revenus
 * (RevenusPage.tsx) : total gagné, ce mois, taux Shoneya ; graphique semaine /
 * mois ; dernières transactions (versé, en attente de livraison, annulé,
 * remboursé — le site affiche le code brut « released / escrow »).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchRevenus, fetchRevenusChart, gnf, REVENUE_STATUS, short, type ChartPeriod } from '../api';
import { Box, Kpi, LivreurScreen } from '../components';

export default function LivreurRevenusScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.livreur.revenus, queryFn: fetchRevenus });
  const [period, setPeriod] = useState<ChartPeriod>('semaine');
  const chart = useQuery({ queryKey: qk.livreur.chart(period), queryFn: () => fetchRevenusChart(period) });
  const d = q.data;
  const data = chart.data ?? [];
  const max = Math.max(1, ...data.map((x) => x.v));

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError || !d) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView {...hideOnScroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void qc.invalidateQueries({ queryKey: qk.livreur.all })} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <View style={styles.kpis}>
          <Kpi icon="🪙" value={gnf(d.totalRevenus)} label="Total gagné" />
          <Kpi icon="💵" value={gnf(d.revenusThisMonth)} label="Ce mois" />
          <Kpi icon="％" value={`${d.tauxCommission} %`} label="Taux Shoneya" sub="Prélevé sur la livraison" />
        </View>

        <Pressable onPress={() => router.push('/livreur/portefeuille')} accessibilityRole="button" style={[styles.wallet, { borderColor: theme.border }]}>
          <Ionicons name="wallet-outline" size={18} color={Brand.primary} />
          <ThemedText type="smallBold" style={styles.flex}>
            Retirer mes gains depuis le portefeuille
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>

        <Box icon="bar-chart-outline" title="Évolution">
          <View style={[styles.seg, { backgroundColor: theme.background }]}>
            {(['semaine', 'mois'] as const).map((p) => (
              <Pressable key={p} onPress={() => setPeriod(p)} accessibilityRole="tab" accessibilityState={{ selected: period === p }} style={[styles.segBtn, period === p && { backgroundColor: Brand.primarySoft }]}>
                <ThemedText type="smallBold" style={{ color: period === p ? theme.text : theme.textSecondary }}>
                  {p === 'semaine' ? 'Semaine' : 'Mois'}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          {chart.isPending ? (
            <ActivityIndicator color={Brand.primary} />
          ) : (
            <View style={styles.chart}>
              {data.map((x, i) => (
                <View key={`${x.j}-${i}`} style={styles.barCol} accessible accessibilityLabel={`${x.j} : ${gnf(x.v)}`}>
                  <ThemedText style={styles.barV}>{x.v ? short(x.v) : ''}</ThemedText>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${Math.max(4, (x.v / max) * 100)}%`, backgroundColor: x.today ? Brand.primary : 'rgba(0,0,0,0.18)' }]} />
                  </View>
                  <ThemedText style={styles.barL} themeColor="textSecondary">
                    {x.j}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </Box>

        <Box icon="list-outline" title="Dernières transactions">
          {d.transactions.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucune transaction pour le moment.
            </ThemedText>
          ) : (
            d.transactions.map((t) => {
              const st = REVENUE_STATUS[t.statut] ?? { label: t.statut, color: theme.textSecondary };
              return (
                <View key={t.id} style={[styles.tx, { borderTopColor: theme.border }]}>
                  <View style={styles.txIco}>
                    <Ionicons name="bicycle-outline" size={16} color={Brand.success} />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText style={styles.bold}>{t.source}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t.date}
                    </ThemedText>
                  </View>
                  <View style={styles.txRight}>
                    <ThemedText style={styles.amt}>+{gnf(t.montant)}</ThemedText>
                    <ThemedText style={[styles.st, { color: st.color }]}>{st.label}</ThemedText>
                  </View>
                </View>
              );
            })
          )}
        </Box>
      </ScrollView>
    );

  return (
    <LivreurScreen title="Mes revenus" subtitle="Gains de vos livraisons" tab="revenus">
      {body}
    </LivreurScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14 },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, minHeight: 34 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 150 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barV: { fontSize: 9.5, lineHeight: 13, fontWeight: '700' },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6 },
  barL: { fontSize: 10.5, lineHeight: 14 },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  txIco: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F6EE' },
  txRight: { alignItems: 'flex-end', gap: 2 },
  amt: { fontSize: 14, lineHeight: 19, fontWeight: '900', color: Brand.success },
  st: { fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
});

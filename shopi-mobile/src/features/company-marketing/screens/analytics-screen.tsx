/**
 * Espace entreprise › Analytics — équivalent mobile de
 * /dashboard/entreprise/analytics (AnalyticsPage.tsx), avec en plus le trafic
 * réel (le site affiche « bientôt disponible ») :
 *   · trafic : vues des fiches, likes, favoris, commandes et conversion
 *     (commandes pour 100 vues) ;
 *   · chiffre d'affaires des 6 derniers mois (commandes livrées, M GNF) ;
 *   · top produits par ventes ;
 *   · performances par catégorie.
 * Permission statistics.view (le serveur refuse aussi sans elle).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchAnalytics, fmt, type Analytics } from '../api';
import { Box, Head, Kpi, Locked } from '../components';

export default function AnalyticsScreen() {
  const theme = useTheme();
  const perms = usePermissions();
  const canView = perms.isOwner || perms.can('statistics', 'view');
  const q = useQuery({ queryKey: qk.company.analytics, queryFn: fetchAnalytics, enabled: canView });

  let body: React.ReactNode;
  if (perms.loading || (q.isPending && canView)) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView) body = <Locked text="Votre rôle dans l’équipe ne permet pas de consulter les statistiques. Demandez l’accès au propriétaire de la boutique." />;
  else if (q.isError && !q.data) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else {
    const a = q.data as Analytics;
    body = (
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <Traffic a={a} />
        <Revenue data={a.caData} />
        <TopProducts items={a.topProduits} />
        <Categories items={a.categoryPerf} />
        <Pressable
          onPress={() => router.push('/entreprise/seo')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.link, { borderColor: Brand.primaryLine, backgroundColor: Brand.primarySoft }, pressed && styles.pressed]}>
          <Ionicons name="search" size={18} color={Brand.primaryInk} />
          <View style={styles.flex}>
            <ThemedText style={[styles.bold, { color: Brand.primaryInk }]}>Améliorer ma visibilité</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Score SEO, fiches à compléter, produits les plus vus</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Analytics" subtitle="Ventes, trafic et performances" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="analytics" />
    </SafeAreaView>
  );
}

function Traffic({ a }: { a: Analytics }) {
  const t = a.trafic;
  if (!t) return null;
  return (
    <Box>
      <Head icon="eye-outline" title="Trafic de la boutique" />
      <View style={styles.kpis}>
        {t.vues != null ? <Kpi icon="👁️" value={fmt(t.vues)} label="Vues des fiches" /> : null}
        <Kpi icon="❤️" value={fmt(t.likes)} label="J’aime" />
        {t.favoris != null ? <Kpi icon="⭐" value={fmt(t.favoris)} label="Ajouts aux favoris" /> : null}
        <Kpi icon="🛒" value={fmt(t.commandes)} label="Commandes reçues" />
      </View>
      {t.conversion != null ? (
        <ThemedText type="small" themeColor="textSecondary">
          Conversion : <ThemedText type="small" style={styles.bold}>{t.conversion.toLocaleString('fr-FR')} commandes pour 100 vues</ThemedText>
        </ThemedText>
      ) : t.vues != null ? (
        <ThemedText type="small" themeColor="textSecondary">
          La conversion s’affichera dès que vos fiches auront été consultées.
        </ThemedText>
      ) : null}
    </Box>
  );
}

function Revenue({ data }: { data: Analytics['caData'] }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <Box>
      <Head icon="trending-up-outline" title="Chiffre d’affaires" />
      {data.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">Aucune vente livrée pour l’instant.</ThemedText>
      ) : (
        <>
          <View style={styles.chart}>
            {data.map((d, i) => {
              const last = i === data.length - 1;
              return (
                <View key={`${d.m}-${i}`} style={styles.barCol} accessible accessibilityLabel={`${d.m} : ${d.v} millions de GNF`}>
                  <ThemedText style={styles.barV}>{d.v ? `${d.v}M` : ''}</ThemedText>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${Math.max(4, (d.v / max) * 100)}%`, backgroundColor: last ? Brand.primary : 'rgba(0,0,0,0.18)' }]} />
                  </View>
                  <ThemedText style={[styles.barL, last && styles.bold]} themeColor={last ? undefined : 'textSecondary'}>{d.m}</ThemedText>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: Brand.primary }]} />
            <ThemedText type="small" themeColor="textSecondary">Ce mois (M GNF)</ThemedText>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
            <ThemedText type="small" themeColor="textSecondary">Mois précédents</ThemedText>
          </View>
        </>
      )}
    </Box>
  );
}

function TopProducts({ items }: { items: Analytics['topProduits'] }) {
  const theme = useTheme();
  const max = Math.max(1, ...items.map((p) => p.ventes));
  return (
    <Box>
      <Head icon="trophy-outline" title="Top produits — ventes" />
      {items.length === 0 ? <ThemedText type="small" themeColor="textSecondary">Aucune vente pour l’instant.</ThemedText> : null}
      {items.map((p, i) => (
        <View key={`${p.nm}-${i}`} style={styles.topRow}>
          <ThemedText style={styles.rank} themeColor="textSecondary">#{i + 1}</ThemedText>
          <View style={styles.emoji}><ThemedText style={styles.emojiText}>{p.em}</ThemedText></View>
          <View style={styles.flex}>
            <ThemedText numberOfLines={1} style={styles.bold}>{p.nm}</ThemedText>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.trackFill, { width: `${(p.ventes / max) * 100}%` }]} />
            </View>
          </View>
          <View style={styles.right}>
            <ThemedText style={styles.bold}>{p.ventes} vente{p.ventes > 1 ? 's' : ''}</ThemedText>
            <ThemedText type="small" style={{ color: p.trend === 'up' ? '#15803D' : p.trend === 'dn' ? '#B91C1C' : theme.textSecondary }}>{p.ca}</ThemedText>
          </View>
        </View>
      ))}
    </Box>
  );
}

function Categories({ items }: { items: Analytics['categoryPerf'] }) {
  const theme = useTheme();
  return (
    <Box>
      <Head icon="grid-outline" title="Performances par catégorie" />
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">Aucune vente pour l’instant.</ThemedText>
      ) : (
        <>
          <View style={styles.tableHead}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>Catégorie</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.col}>CA (M GNF)</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.col}>Commandes</ThemedText>
          </View>
          {items.map((c, i) => (
            <View key={`${c.cat}-${i}`} style={[styles.tableRow, { borderTopColor: theme.border }]}>
              <ThemedText numberOfLines={1} style={[styles.flex, styles.bold]}>{c.cat}</ThemedText>
              <ThemedText style={[styles.col, styles.bold]}>{c.ca}M</ThemedText>
              <ThemedText style={styles.col} themeColor="textSecondary">{c.commandes}</ThemedText>
            </View>
          ))}
        </>
      )}
    </Box>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  pressed: { opacity: 0.85 },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 160 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barV: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6 },
  barL: { fontSize: 11, lineHeight: 15 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { width: 24, textAlign: 'right', fontWeight: '800', fontSize: 12 },
  emoji: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 16, lineHeight: 22 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 5 },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: Brand.primary },
  right: { alignItems: 'flex-end', minWidth: 72 },
  tableHead: { flexDirection: 'row', gap: 8 },
  tableRow: { flexDirection: 'row', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  col: { width: 82, textAlign: 'right' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
});

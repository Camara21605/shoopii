/**
 * Espace entreprise — Vue d'ensemble (première page du tableau de bord, comme
 * /dashboard/entreprise sur le site). Données : GET /dashboard/entreprise/overview.
 *   · bandeau « position de la boutique non définie » si pas de GPS
 *   · hero : boutique active · abonnés, « Bonjour, <boutique> 👋 », résumé,
 *     Traiter les commandes · Analytics (si permission statistiques) · Promotions
 *   · 4 chiffres : CA du mois (tendance), commandes (tendance), note, abonnés
 *   · onglets : Ventes · Commandes (pastille = alertes de stock) · Activité
 * Rubriques pas encore natives : ouvertes sur le site (/dashboard/entreprise/…).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openShop, openSite } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchMissingPosition, fetchOverview, type Overview } from '../api';
import { ActivityTab, CompanyHeader, OrdersTab, OverviewHero, SalesTab } from '../components';
import { useCompanyIdentity, usePermissions } from '../hooks';

type Tab = 'ventes' | 'commandes' | 'activite';

const EMPTY: Overview = {
  zoneNom: 'Boutique',
  kpis: {
    caCeMois: 0, croissanceCA: 0, commandesCeMois: 0, commandesCroissance: 0, enAttente: 0, enCours: 0, livrees: 0,
    noteMoyenne: 0, totalAvis: 0, abonnes: 0, retoursCeMois: 0, retoursEnTraitement: 0, retoursRembourses: 0,
    beneficeNet: 0, margePct: 0, commissionCeMois: 0,
  },
  caData: [], topProduits: [], categoryBreakdown: [], dernieresCommandes: [], stockAlertes: [], activite: [],
};

const dash = (path: string) => openSite(`/dashboard/entreprise${path ? `/${path}` : ''}`);

export default function CompanyOverviewScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('ventes');
  const perms = usePermissions();
  const identity = useCompanyIdentity();
  const q = useQuery({ queryKey: qk.company.overview, queryFn: fetchOverview });
  const position = useQuery({ queryKey: qk.company.position, queryFn: fetchMissingPosition });
  const data = q.data ?? EMPTY;
  const loading = q.isPending;

  const refresh = () => void qc.invalidateQueries({ queryKey: qk.company.all });

  const TABS: { key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; badge?: number }[] = [
    { key: 'ventes', label: 'Ventes', icon: 'trending-up-outline' },
    { key: 'commandes', label: 'Commandes', icon: 'cube-outline', badge: data.stockAlertes.length },
    { key: 'activite', label: 'Activité', icon: 'time-outline' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader />
      {q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={refresh} colors={[Brand.primary]} tintColor={Brand.primary} />}>
          {position.data ? (
            <View style={[styles.position, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]} accessibilityRole="alert">
              <Ionicons name="locate" size={20} color={Brand.primary} />
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>Position de votre boutique non définie</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Les clients voient une distance approximative (depuis le centre de votre ville). Définissez la position exacte depuis votre boutique.
                </ThemedText>
              </View>
              <Pressable onPress={() => dash('boutique-preview')} style={styles.positionBtn} accessibilityRole="button">
                <ThemedText type="smallBold" style={styles.white}>
                  Définir
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          <OverviewHero
            data={{ ...data, zoneNom: q.data?.zoneNom ?? identity.data?.companyName ?? 'Boutique' }}
            loading={loading}
            canAnalytics={perms.can('statistics', 'view')}
            onOrders={() => dash('commandes')}
            onAnalytics={() => dash('analytics')}
            onPromotions={() => dash('promotions')}
          />

          {loading ? <ActivityIndicator color={Brand.primary} /> : null}

          {/* Onglets */}
          <View style={[styles.tabs, { backgroundColor: theme.backgroundElement }]}>
            {TABS.map((t) => {
              const on = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.tab, on && { backgroundColor: theme.background }]}>
                  <Ionicons name={t.icon} size={15} color={on ? Brand.primary : theme.textSecondary} />
                  <ThemedText style={[styles.tabText, { color: on ? Brand.primary : theme.textSecondary }]}>{t.label}</ThemedText>
                  {t.badge ? (
                    <View style={styles.tabBadge}>
                      <ThemedText style={styles.tabBadgeText}>{t.badge}</ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {tab === 'ventes' ? <SalesTab data={data} loading={loading} /> : null}
          {tab === 'commandes' ? (
            <OrdersTab
              data={data}
              loading={loading}
              onRestock={() => dash(identity.data?.businessModel === 'services' ? 'services' : 'produits')}
              onSeeAll={() => dash('commandes')}
              onOpenOrder={(uuid) => openSite(`/commande/${uuid}/suivi`)}
            />
          ) : null}
          {tab === 'activite' ? <ActivityTab data={data} loading={loading} /> : null}

          {identity.data ? (
            <Pressable onPress={() => openShop(identity.data!.id)} style={[styles.preview, { borderColor: theme.border }]} accessibilityRole="button">
              <Ionicons name="storefront-outline" size={18} color={Brand.primary} />
              <ThemedText style={[styles.flex, styles.bold]}>Voir ma boutique comme un client</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  white: { color: '#fff' },
  scroll: { padding: 16, gap: 14, paddingBottom: 32 },
  position: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  positionBtn: { backgroundColor: Brand.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, minHeight: 40 },
  tabText: { fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: '#fff', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14 },
});

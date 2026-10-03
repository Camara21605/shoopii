/**
 * Espace entreprise — Vue d'ensemble (première page du tableau de bord, comme
 * /dashboard/entreprise sur le site). Données : GET /dashboard/entreprise/overview.
 *   · bandeau « position de la boutique non définie » si pas de GPS
 *   · hero : boutique active · abonnés, « Bonjour, <boutique> 👋 », résumé,
 *     Traiter les commandes · Analytics (si permission statistiques) · Promotions
 *   · 4 chiffres : CA du mois (tendance), commandes (tendance), note, abonnés
 *   · raccourcis (selon les permissions) ;
 *   · onglets : Ventes · Commandes (pastille = alertes de stock) · Activité
 *   · barre du bas (Accueil · Commandes · Produits) + bouton « + » ; menu ☰ latéral.
 * Rubriques pas encore natives : ouvertes sur le site (/dashboard/entreprise/…).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
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
import { ActivityTab, CompanyBottomNav, CompanyHeader, OrdersTab, OverviewHero, SalesTab } from '../components';
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
            status={identity.data?.status}
            canAnalytics={perms.can('statistics', 'view')}
            canOrders={perms.can('orders', 'view')}
            onOrders={() => dash('commandes')}
            onAnalytics={() => dash('analytics')}
            onPromotions={() => dash('promotions')}
          />

          {loading ? <ActivityIndicator color={Brand.primary} /> : null}

          <Shortcuts services={identity.data?.businessModel === 'services'} />

          {/* Onglets */}
          <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
            {TABS.map((t) => {
              const on = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.tab, on && { borderBottomColor: theme.text }]}>
                  <Ionicons name={t.icon} size={16} color={on ? theme.text : theme.textSecondary} />
                  <ThemedText style={[styles.tabText, { color: on ? theme.text : theme.textSecondary }]}>{t.label}</ThemedText>
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
      <CompanyBottomNav active="overview" />
    </SafeAreaView>
  );
}

/** Raccourcis vers les rubriques les plus utilisées (selon les permissions). */
function Shortcuts({ services }: { services: boolean }) {
  const theme = useTheme();
  const perms = usePermissions();
  const items: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; ok: boolean; go: () => void }[] = [
    { label: services ? 'Ajouter un service' : 'Ajouter un produit', icon: 'add-circle', color: '#111111', ok: perms.can(services ? 'services' : 'products', 'create'), go: () => (services ? dash('ajouter-service') : router.push('/entreprise/ajouter' as Href)) },
    { label: 'Inventaire', icon: 'file-tray-stacked', color: '#7C3AED', ok: !services && perms.can('products', 'view'), go: () => dash('inventaire') },
    { label: 'Mes livreurs', icon: 'bicycle', color: '#059669', ok: perms.can('deliveries', 'view'), go: () => dash('livreurs') },
    { label: 'Portefeuille', icon: 'wallet', color: '#D97706', ok: perms.can('wallet', 'view'), go: () => dash('portefeuille') },
    { label: 'Avis clients', icon: 'star', color: '#DB2777', ok: perms.can('orders', 'view'), go: () => dash('avis') },
    { label: 'Paramètres', icon: 'settings', color: '#525252', ok: perms.can('settings', 'view'), go: () => router.push('/entreprise/parametres') },
  ];
  const visible = items.filter((i) => i.ok);
  if (!visible.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
      {visible.map((i) => (
        <Pressable key={i.label} onPress={i.go} accessibilityRole="button" style={({ pressed }) => [styles.shortcut, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.shortcutIco, { backgroundColor: `${i.color}18` }]}>
            <Ionicons name={i.icon} size={20} color={i.color} />
          </View>
          <ThemedText style={styles.shortcutText} numberOfLines={2}>
            {i.label}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  white: { color: '#fff' },
  scroll: { padding: 16, gap: 14, paddingBottom: 100 },
  position: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  positionBtn: { backgroundColor: Brand.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -StyleSheet.hairlineWidth },
  tabText: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  shortcuts: { gap: 10, paddingRight: 4 },
  shortcut: { width: 96, borderWidth: 1, borderRadius: 16, padding: 10, gap: 8 },
  shortcutIco: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shortcutText: { fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: '#fff', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14 },
});

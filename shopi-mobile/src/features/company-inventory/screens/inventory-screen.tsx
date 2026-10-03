/**
 * Espace entreprise › Inventaire & Stock — équivalent mobile de /dashboard/entreprise/inventaire :
 *   · chiffres : produits catalogués (unités), ruptures, stocks faibles, valeur du stock ;
 *   · alertes critiques (8 au plus, les plus urgentes d'abord) ;
 *   · actions rapides : réapprovisionner tous les critiques, exporter en CSV,
 *     configurer les alertes (produits sans seuil), synchroniser avec les fournisseurs ;
 *   · filtres (tous, rupture, faibles, en stock) avec compteurs, recherche ;
 *   · une ligne par produit : prix, valeur en stock, stock + seuil, niveau, statut,
 *     Modifier / Réapprovisionner (products.edit).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openSite } from '@/features/catalog/open';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchAllProducts, fmtNum, gnf, LEVEL, levelOf, normalize, stockPct, type Level, type Product } from '../api';
import { shareCsv } from '../csv';
import { RestockSheet, StockSheet, ThresholdsSheet } from '../components/sheets';
import { InventoryRow } from '../components/inventory-row';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Filter = 'all' | 'out' | 'low' | 'ok';

export default function InventoryScreen() {
  const theme = useTheme();
  const perms = usePermissions();
  const canView = perms.can('products', 'view');
  const canEdit = perms.can('products', 'edit');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [restock, setRestock] = useState<Product[] | null>(null);
  const [thresholds, setThresholds] = useState(false);
  const snack = useSnack();
  const q = useQuery({ queryKey: qk.company.products, queryFn: fetchAllProducts, enabled: canView });
  const products = q.data ?? [];

  const lv = (p: Product): Level => levelOf(p.stock, p.seuil);
  const stats = {
    total: products.length,
    units: products.reduce((s, p) => s + p.stock, 0),
    out: products.filter((p) => lv(p) === 'out').length,
    low: products.filter((p) => lv(p) === 'low' || lv(p) === 'crit').length,
    value: products.reduce((s, p) => s + p.prix * p.stock, 0),
  };
  const critical = products.filter((p) => p.stock === 0 || (p.seuil != null && p.stock <= p.seuil));
  const alerts = [...critical].sort((a, b) => a.stock - b.stock).slice(0, 8);
  const noThreshold = products.filter((p) => p.seuil == null);
  const term = normalize(search.trim());
  const match = (p: Product) =>
    filter === 'all' ? true : filter === 'out' ? lv(p) === 'out' : filter === 'low' ? lv(p) === 'low' || lv(p) === 'crit' : lv(p) === 'ok';
  const list = products.filter(match).filter((p) => !term || normalize(`${p.nom} ${p.marque ?? ''} ${p.reference ?? ''}`).includes(term));

  const FILTERS: { key: Filter; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'Tous', count: stats.total, color: Brand.primaryInk },
    { key: 'out', label: 'Rupture', count: stats.out, color: LEVEL.out.color },
    { key: 'low', label: 'Faibles', count: stats.low, color: LEVEL.low.color },
    { key: 'ok', label: 'En stock', count: stats.total - stats.out - stats.low, color: LEVEL.ok.color },
  ];

  const exportCsv = async () => {
    try {
      await shareCsv(products);
      snack.show('Export CSV généré');
    } catch {
      snack.show('Impossible de générer l’export', true);
    }
  };

  const QUICK: { icon: IconName; label: string; sub: string; onPress: () => void; disabled: boolean; show: boolean }[] = [
    { icon: 'car-outline', label: 'Réappro. tous les critiques', sub: `${critical.length} produit${critical.length > 1 ? 's' : ''} concerné${critical.length > 1 ? 's' : ''}`, onPress: () => setRestock(critical), disabled: !critical.length, show: canEdit },
    { icon: 'download-outline', label: 'Exporter l’inventaire (CSV)', sub: `${stats.total} produits · ${fmtNum(stats.units)} unités`, onPress: () => void exportCsv(), disabled: !stats.total, show: true },
    {
      icon: 'notifications-outline',
      label: 'Configurer les alertes',
      sub: noThreshold.length ? `${noThreshold.length} produit${noThreshold.length > 1 ? 's' : ''} sans seuil défini` : 'Tous les seuils sont configurés',
      onPress: () => setThresholds(true),
      disabled: !noThreshold.length,
      show: canEdit,
    },
    { icon: 'sync-outline', label: 'Synchroniser le stock', sub: 'Avec vos fournisseurs Shoneya', onPress: () => openSite('/dashboard/entreprise/fournisseurs'), disabled: false, show: true },
  ];

  let body: React.ReactNode;
  if (perms.loading) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.deniedTitle}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de consulter l’inventaire. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else if (q.isError && !q.data) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        {...hideOnScroll}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <ThemedText style={styles.title}>Inventaire & Stock</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Suivez vos niveaux de stock en temps réel et gérez les alertes
                </ThemedText>
              </View>
              <Pressable onPress={() => void q.refetch()} disabled={q.isFetching} accessibilityRole="button" accessibilityLabel="Actualiser" style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}>
                {q.isFetching ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="refresh" size={19} color={theme.text} />}
              </Pressable>
            </View>

            <View style={styles.stats}>
              <Stat icon="cube-outline" value={String(stats.total)} label="Produits catalogués" sub={`${fmtNum(stats.units)} unités au total`} color={Brand.primaryInk} bg={Brand.primarySoft} />
              <Stat icon="close-circle-outline" value={String(stats.out)} label="Ruptures de stock" sub={stats.out ? 'Action requise !' : 'Aucune rupture ✓'} color={LEVEL.out.color} bg={LEVEL.out.bg} pulse={stats.out > 0} />
              <Stat icon="warning-outline" value={String(stats.low)} label="Stocks faibles" sub="Sous le seuil d’alerte" color={LEVEL.low.color} bg={LEVEL.low.bg} />
              <Stat icon="cash-outline" value={stats.value >= 1_000_000 ? `${(stats.value / 1_000_000).toFixed(1).replace('.', ',')}M` : fmtNum(stats.value)} label="Valeur du stock (GNF)" sub="Prix × quantité en stock" color={LEVEL.ok.color} bg={LEVEL.ok.bg} />
            </View>

            {/* Alertes critiques */}
            <View style={[styles.card, { borderColor: alerts.length ? '#FECACA' : theme.border }]}>
              <View style={styles.cardHead}>
                <Ionicons name="alert-circle" size={18} color={alerts.length ? LEVEL.out.color : LEVEL.ok.color} />
                <ThemedText style={styles.cardTitle}>Alertes critiques</ThemedText>
                {alerts.length ? (
                  <View style={styles.badge}>
                    <ThemedText style={styles.badgeText}>{alerts.length}</ThemedText>
                  </View>
                ) : null}
              </View>
              {q.isPending ? (
                <ActivityIndicator color={Brand.primary} />
              ) : alerts.length === 0 ? (
                <View style={styles.allGood}>
                  <Ionicons name="checkmark-circle" size={28} color={LEVEL.ok.color} />
                  <ThemedText style={styles.bold}>Tout est en ordre !</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Aucun stock critique détecté.
                  </ThemedText>
                </View>
              ) : (
                alerts.map((p) => {
                  const l = LEVEL[lv(p)];
                  return (
                    <View key={p.id} style={[styles.alert, { backgroundColor: l.bg }]}>
                      <Ionicons name={l.icon as IconName} size={18} color={l.color} />
                      <View style={styles.flex}>
                        <ThemedText style={styles.alertName} numberOfLines={1}>
                          {p.nom}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: l.color }}>
                          Stock : <ThemedText type="smallBold" style={{ color: l.color }}>{p.stock}</ThemedText>
                          {p.seuil != null ? ` · Min : ${p.seuil}` : ''}
                        </ThemedText>
                      </View>
                      {canEdit ? (
                        <Pressable onPress={() => setEditing(p)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Modifier le stock de ${p.nom}`} style={styles.alertBtn}>
                          <Ionicons name="create-outline" size={17} color={l.color} />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>

            {/* Actions rapides */}
            <View style={[styles.card, { borderColor: theme.border }]}>
              <View style={styles.cardHead}>
                <Ionicons name="flash" size={18} color={Brand.primary} />
                <ThemedText style={styles.cardTitle}>Actions rapides</ThemedText>
              </View>
              {QUICK.filter((a) => a.show).map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  disabled={a.disabled}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: a.disabled }}
                  style={({ pressed }) => [styles.quick, { borderColor: theme.border }, a.disabled && styles.dim, pressed && { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.quickIco}>
                    <Ionicons name={a.icon} size={18} color={Brand.primaryInk} />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText style={styles.bold}>{a.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {a.sub}
                    </ThemedText>
                  </View>
                  <Ionicons name={a.label.startsWith('Synchroniser') ? 'open-outline' : 'arrow-forward'} size={16} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>

            <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="search" size={17} color={theme.textSecondary} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher un produit…" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} accessibilityLabel="Rechercher dans l'inventaire" returnKeyType="search" />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer">
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                    {f.key !== 'all' ? <View style={[styles.dot, { backgroundColor: f.color }]} /> : null}
                    <ThemedText style={[styles.chipText, on && { color: Brand.primaryInk }]}>{f.label}</ThemedText>
                    <View style={[styles.chipCount, { backgroundColor: on ? '#fff' : theme.backgroundElement }]}>
                      <ThemedText style={[styles.chipCountText, on && { color: Brand.primaryInk }]}>{f.count}</ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            {q.isPending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={Brand.primary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Chargement de l’inventaire…
                </ThemedText>
              </View>
            ) : list.length ? (
              <ThemedText type="small" themeColor="textSecondary">
                {list.length} produit{list.length > 1 ? 's' : ''}
                {filter !== 'all' ? ' filtrés' : ''}
                {term ? ` pour « ${search.trim()} »` : ''}
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q.isPending ? null : (
            <View style={styles.empty}>
              <View style={[styles.emptyIco, { backgroundColor: Brand.primarySoft }]}>
                <Ionicons name="file-tray-stacked-outline" size={28} color={Brand.primary} />
              </View>
              <ThemedText style={styles.emptyTitle}>{products.length ? 'Aucun résultat' : 'Aucun produit'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {products.length ? 'Essayez de modifier vos filtres.' : 'Ajoutez des produits pour voir l’inventaire.'}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <InventoryRow
            p={item}
            level={lv(item)}
            pct={stockPct(item.stock, item.seuil)}
            value={gnf(item.prix * item.stock)}
            price={gnf(item.prix)}
            canEdit={canEdit}
            onOpen={() => router.push({ pathname: '/entreprise/produits/[id]', params: { id: item.id } })}
            onEdit={() => setEditing(item)}
            onRestock={() => setRestock([item])}
          />
        )}
      />
    );

  const done = (close: () => void) => (m: string, error?: boolean) => {
    close();
    snack.show(m, error);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Inventaire" subtitle="Gérez vos niveaux de stock" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="inventaire" />
      <Snack msg={snack.msg} bottom={96} />
      {editing ? <StockSheet product={editing} onClose={() => setEditing(null)} onDone={done(() => setEditing(null))} /> : null}
      {restock ? <RestockSheet products={restock} onClose={() => setRestock(null)} onDone={done(() => setRestock(null))} /> : null}
      {thresholds ? <ThresholdsSheet products={noThreshold} onClose={() => setThresholds(false)} onDone={done(() => setThresholds(false))} /> : null}
    </SafeAreaView>
  );
}

function Stat({ icon, value, label, sub, color, bg, pulse }: { icon: IconName; value: string; label: string; sub: string; color: string; bg: string; pulse?: boolean }) {
  return (
    <View style={[styles.stat, { backgroundColor: bg }]} accessibilityLabel={`${label} : ${value}, ${sub}`}>
      <View style={styles.statTop}>
        <Ionicons name={icon} size={17} color={color} />
        {pulse ? <View style={[styles.pulse, { backgroundColor: color }]} /> : null}
      </View>
      <ThemedText style={[styles.statV, { color }]} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText style={[styles.statL, { color }]} numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={styles.statS} numberOfLines={1}>
        {sub}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.45 },
  loader: { marginTop: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 10, paddingBottom: 110 },
  header: { gap: 14, marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexBasis: '47%', flexGrow: 1, borderRadius: 16, padding: 12, gap: 1 },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pulse: { width: 9, height: 9, borderRadius: 5 },
  statV: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  statL: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  statS: { fontSize: 11.5, lineHeight: 15, color: '#6B6B6B', fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 8, backgroundColor: '#fff' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: LEVEL.out.color, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  allGood: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 10 },
  alertName: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  alertBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  quickIco: { width: 36, height: 36, borderRadius: 10, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingLeft: 12, paddingRight: 6, paddingVertical: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  chipCountText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 16 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
});

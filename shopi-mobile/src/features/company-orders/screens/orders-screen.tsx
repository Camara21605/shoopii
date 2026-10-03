/**
 * Espace entreprise › Commandes — équivalent mobile de /dashboard/entreprise/commandes :
 *   · résumé : à confirmer, en préparation, en livraison, chiffre du jour ;
 *   · recherche (numéro, client, produit) et filtres par statut avec compteurs ;
 *   · une carte par commande (articles, client, total, statut, livreur) ;
 *   · assigner / changer le livreur directement depuis la liste (deliveries.assign) ;
 *   · tirer pour actualiser, mise à jour automatique toutes les minutes.
 * Toucher une commande ouvre son détail (chaîne de validation, articles, montants).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchOrders, FILTERS, gnf, normalize, type Order, type OrderStatus } from '../api';
import { OrderCard } from '../components/order-card';
import { DriverSheet } from '../components/sheets';
import { Snack, useSnack } from '@/components/snack';

export default function CompanyOrdersScreen() {
  const theme = useTheme();
  const perms = usePermissions();
  const canView = perms.can('orders', 'view');
  const canAssign = perms.can('deliveries', 'assign');
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState<Order | null>(null);
  const snack = useSnack();
  const q = useQuery({ queryKey: qk.company.orders, queryFn: fetchOrders, enabled: canView, refetchInterval: 60_000 });
  const orders = q.data ?? [];

  const count = (k: OrderStatus | 'all') => (k === 'all' ? orders.length : orders.filter((o) => o.status === k).length);
  const term = normalize(search.trim());
  const list = orders
    .filter((o) => filter === 'all' || o.status === filter)
    .filter((o) => !term || normalize(`${o.id} ${o.client} ${o.nm} ${o.items.map((i) => i.nm).join(' ')}`).includes(term));
  const toConfirm = count('new');
  const caLivre = orders.filter((o) => o.status === 'del').reduce((s, o) => s + o.price, 0);

  let body: React.ReactNode;
  if (perms.loading) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.deniedTitle}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de consulter les commandes. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else if (q.isError && !q.data) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <FlatList
        data={list}
        keyExtractor={(o) => o.uuid}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.stats}>
              <Stat label="À confirmer" value={String(toConfirm)} highlight={toConfirm > 0} onPress={() => setFilter('new')} />
              <Stat label="En préparation" value={String(count('prep'))} onPress={() => setFilter('prep')} />
              <Stat label="En livraison" value={String(count('ship'))} onPress={() => setFilter('ship')} />
            </View>
            <View style={[styles.revenue, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="cash-outline" size={18} color={Brand.primary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                Ventes livrées ({count('del')} commande{count('del') > 1 ? 's' : ''})
              </ThemedText>
              <ThemedText style={styles.revenueV}>{gnf(caLivre)}</ThemedText>
            </View>
            <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="search" size={17} color={theme.textSecondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="N° de commande, client ou produit"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text }]}
                accessibilityLabel="Rechercher une commande"
                returnKeyType="search"
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer">
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((f) => {
                const on = f.key === filter;
                const n = count(f.key);
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                    <ThemedText style={[styles.chipText, on && { color: Brand.primaryInk }]}>{f.label}</ThemedText>
                    <View style={[styles.chipCount, { backgroundColor: on ? '#fff' : theme.backgroundElement }]}>
                      <ThemedText style={[styles.chipCountText, on && { color: Brand.primaryInk }]}>{n}</ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            {q.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
          </View>
        }
        ListEmptyComponent={
          q.isPending ? null : (
            <View style={styles.empty}>
              <View style={[styles.emptyIco, { backgroundColor: Brand.primarySoft }]}>
                <Ionicons name={term ? 'search' : 'cube-outline'} size={28} color={Brand.primary} />
              </View>
              <ThemedText style={styles.emptyTitle}>{term ? 'Aucun résultat' : orders.length ? 'Aucune commande ici' : 'Pas encore de commande'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {term
                  ? `Aucune commande ne correspond à « ${search.trim()} ».`
                  : orders.length
                    ? 'Aucune commande avec ce statut pour le moment.'
                    : 'Vos commandes apparaîtront ici dès qu’un client achètera dans votre boutique.'}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <OrderCard order={item} canAssign={canAssign} onPress={() => router.push({ pathname: '/entreprise/commandes/[id]', params: { id: item.uuid } })} onAssign={() => setAssigning(item)} />
        )}
      />
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Commandes" subtitle="Gérez toutes vos commandes" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="commandes" />
      <Snack msg={snack.msg} bottom={96} />
      {assigning ? (
        <DriverSheet
          order={assigning}
          onClose={() => setAssigning(null)}
          onDone={(m) => {
            setAssigning(null);
            snack.show(m);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Stat({ label, value, highlight, onPress }: { label: string; value: string; highlight?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} : ${value}`} style={[styles.stat, { borderColor: highlight ? Brand.primaryLine : theme.border, backgroundColor: highlight ? Brand.primarySoft : theme.background }]}>
      <ThemedText style={[styles.statV, highlight && { color: Brand.primaryInk }]}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  header: { gap: 12, marginBottom: 2 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, gap: 2 },
  statV: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  revenue: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  revenueV: { fontSize: 14.5, lineHeight: 19, fontWeight: '900' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingLeft: 12, paddingRight: 6, paddingVertical: 5 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  chipCountText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 16 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
});

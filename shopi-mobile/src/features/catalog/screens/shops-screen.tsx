/**
 * Onglet Boutiques — toutes les boutiques actives (GET /public/boutiques),
 * affichées EN LISTE (une boutique par ligne), recherche, « Suivre ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ErrorState, SectionHeader, SectionState, capitalize } from '@/components/catalog';
import { ListRow } from '@/components/list-row';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchShops, type Shop } from '@/features/catalog/api';
import { useFollowedShops, useToggleFollow } from '@/features/catalog/follow';
import { openShop } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

/** « Quartier, Commune, Ville » sans répétition (« Kaloum, Kaloum » → « Kaloum »). */
function placeOf(s: Shop) {
  const seen = new Set<string>();
  const parts = [s.quartier, s.commune, s.ville]
    .filter((x): x is string => !!x && !!x.trim())
    .map((x) => capitalize(x.trim()))
    .filter((x) => (seen.has(x.toLowerCase()) ? false : (seen.add(x.toLowerCase()), true)));
  return parts.join(', ') || s.localisation || null;
}

export default function ShopsScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const shops = useQuery({ queryKey: qk.shops.search(search), queryFn: () => fetchShops(50, search) });
  const followed = useFollowedShops();
  const follow = useToggleFollow('entreprises');
  const count = shops.data?.length ?? 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AppHeader search={query} onSearch={setQuery} placeholder="Rechercher une boutique…" />
      {shops.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : shops.error ? (
        <ErrorState error={shops.error} onRetry={() => void shops.refetch()} />
      ) : (
        <FlatList
          data={shops.data}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          {...hideOnScroll}
        refreshControl={<RefreshControl refreshing={shops.isRefetching} onRefresh={() => void shops.refetch()} colors={[Brand.primary]} />}
          ListHeaderComponent={
            <View style={styles.head}>
              <SectionHeader title={search ? `Résultats (${count})` : `Boutiques (${count})`} />
            </View>
          }
          ListEmptyComponent={
            <SectionState>
              <Ionicons name="storefront-outline" size={44} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary">{search ? 'Aucune boutique ne correspond.' : 'Aucune boutique pour le moment.'}</ThemedText>
            </SectionState>
          }
          renderItem={({ item }) => (
            <ListRow
              data={{
                name: item.companyName,
                image: item.logo,
                verified: item.verified,
                subtitle: item.domaine ? capitalize(item.domaine) : null,
                subtitleIcon: 'storefront-outline',
                place: placeOf(item),
                rating: item.averageRating,
                reviews: item.totalRatings,
                stat: item.totalAbonnes ? `${item.totalAbonnes} abonné${item.totalAbonnes > 1 ? 's' : ''}` : null,
                online: item.online,
              }}
              onPress={() => openShop(item.id)}
              followed={followed.data?.has(item.id)}
              following={follow.pending === item.id}
              onFollow={() => follow.toggle(item.id)}
              bare
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { marginTop: 60 },
  head: { marginHorizontal: -Spacing.three, paddingTop: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: 100, flexGrow: 1 },
});

/** Onglet Boutiques — toutes les boutiques actives (GET /public/boutiques), recherche, « S'abonner ». */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ErrorState, SectionHeader, SectionState, ShopCard } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchShops } from '@/features/catalog/api';
import { useFollowedShops, useToggleFollow } from '@/features/catalog/follow';
import { openShop } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';

const GAP = 12;

export default function ShopsScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - Spacing.three * 2 - GAP) / 2);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const shops = useQuery({ queryKey: ['shops', 'all', search], queryFn: () => fetchShops(40, search) });
  const followed = useFollowedShops();
  const follow = useToggleFollow('entreprises');

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
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={shops.isRefetching} onRefresh={() => void shops.refetch()} colors={[Brand.primary]} />}
          ListHeaderComponent={
            <View style={styles.head}>
              <SectionHeader title={search ? `Résultats (${shops.data?.length ?? 0})` : 'Toutes les boutiques'} />
            </View>
          }
          ListEmptyComponent={
            <SectionState>
              <ThemedText themeColor="textSecondary">{search ? 'Aucune boutique ne correspond.' : 'Aucune boutique pour le moment.'}</ThemedText>
            </SectionState>
          }
          renderItem={({ item }) => (
            <ShopCard
              shop={item}
              width={cardWidth}
              followed={followed.data?.has(item.id)}
              following={follow.pending === item.id}
              onFollow={() => follow.toggle(item.id)}
              onPress={() => openShop(item.id)}
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
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: GAP },
  row: { gap: GAP },
});

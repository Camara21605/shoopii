/**
 * Écran liste Livreurs / Points relais — mêmes données que les pages
 * /livreurs et /correspondants du site (GET /suivis/livreurs,
 * GET /suivis/correspondants), recherche et « S'abonner ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ActorCard, ErrorState, SectionHeader, SectionState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchDrivers, fetchRelays } from '@/features/catalog/api';
import { useToggleFollow } from '@/features/catalog/follow';
import { useTheme } from '@/hooks/use-theme';

export function ActorListScreen({ kind }: { kind: 'livreur' | 'relais' }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const key = kind === 'livreur' ? 'livreurs' : 'correspondants';
  const list = useQuery({
    queryKey: [key, search],
    queryFn: () => (kind === 'livreur' ? fetchDrivers(search) : fetchRelays(search)),
  });
  const follow = useToggleFollow(key);
  const label = kind === 'livreur' ? 'Livreurs' : 'Points relais';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AppHeader search={query} onSearch={setQuery} placeholder={kind === 'livreur' ? 'Rechercher un livreur…' : 'Rechercher un point relais…'} />
      {list.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={list.data}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} colors={[Brand.primary]} />}
          ListHeaderComponent={
            <View style={styles.head}>
              <SectionHeader title={search ? `Résultats (${list.data?.length ?? 0})` : label} />
            </View>
          }
          ListEmptyComponent={
            <SectionState>
              <Ionicons name={kind === 'livreur' ? 'bicycle-outline' : 'location-outline'} size={44} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {search
                  ? 'Aucun résultat pour cette recherche.'
                  : kind === 'livreur'
                    ? 'Aucun livreur disponible pour le moment.'
                    : 'Aucun point relais pour le moment.'}
              </ThemedText>
            </SectionState>
          }
          renderItem={({ item }) => (
            <ActorCard
              actor={item}
              kind={kind}
              followed={item.isSuivi}
              following={follow.pending === item.id}
              onFollow={() => follow.toggle(item.id)}
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
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: 10, flexGrow: 1 },
  center: { textAlign: 'center' },
});

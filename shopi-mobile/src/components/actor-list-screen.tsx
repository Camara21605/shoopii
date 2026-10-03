/**
 * Écran liste Livreurs / Points relais — mêmes données que les pages
 * /livreurs et /correspondants du site (GET /suivis/livreurs,
 * GET /suivis/correspondants), affichées EN LISTE (même ligne que
 * l'onglet Boutiques), recherche, « Suivre », toucher = profil sur le site.
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
import { fetchDrivers, fetchRelays, type Actor } from '@/features/catalog/api';
import { useToggleFollow } from '@/features/catalog/follow';
import { openDriver, openRelay } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { hideOnScroll } from '@/lib/scroll-chrome';

const VEHICULES: Record<string, string> = { moto: 'Moto', voiture: 'Voiture', pickup: 'Pick-up', velo: 'Vélo', tricycle: 'Tricycle', camion: 'Camion' };
const RELAIS: Record<string, string> = { entreprise: 'Relais d’entreprise', company: 'Relais d’entreprise', livreur: 'Relais de livreur', delivery: 'Relais de livreur' };

function placeOf(a: Actor) {
  return a.localisation || a.zone || a.region || [a.quartier, a.commune].filter(Boolean).join(', ') || null;
}

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
  const count = list.data?.length ?? 0;

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
          {...hideOnScroll}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} colors={[Brand.primary]} />}
          ListHeaderComponent={
            <View style={styles.head}>
              <SectionHeader title={search ? `Résultats (${count})` : `${label} (${count})`} />
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
            <ListRow
              data={
                kind === 'livreur'
                  ? {
                      name: item.fullName,
                      image: item.profilePicture,
                      subtitle: item.vehicule ? (VEHICULES[item.vehicule.toLowerCase()] ?? capitalize(item.vehicule)) : 'Livreur',
                      subtitleIcon: 'bicycle-outline',
                      place: placeOf(item),
                      rating: item.averageRating,
                      stat: `${item.totalLivraisons ?? 0} livraison${(item.totalLivraisons ?? 0) > 1 ? 's' : ''}`,
                      online: item.disponible ?? item.online,
                    }
                  : {
                      name: item.fullName,
                      image: item.profilePicture,
                      subtitle: item.typeCorrespondant ? (RELAIS[item.typeCorrespondant.toLowerCase()] ?? capitalize(item.typeCorrespondant)) : 'Point relais',
                      subtitleIcon: 'cube-outline',
                      place: placeOf(item),
                      rating: item.averageRating,
                      reviews: item.nbAvis,
                      stat: `${item.totalMissions ?? 0} mission${(item.totalMissions ?? 0) > 1 ? 's' : ''}`,
                      online: item.online ?? item.disponible,
                    }
              }
              onPress={() => (kind === 'livreur' ? openDriver(item.id) : openRelay(item.id))}
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
  list: { paddingHorizontal: Spacing.three, paddingBottom: 100, gap: 10, flexGrow: 1 },
  center: { textAlign: 'center' },
});

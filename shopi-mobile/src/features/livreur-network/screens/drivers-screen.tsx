/**
 * Espace livreur › Réseau › Livreurs — équivalent mobile de
 * /dashboard/livreur/reseau/livreurs (ReseauLivreursPage) : autres livreurs
 * (photo ou initiales, nom, zone, note et livraisons — sauf si le livreur les
 * a masquées —, « Disponible ») avec « S'abonner » / « Suivi(e) » + menu ⋮ ;
 * toucher une ligne ouvre le profil natif. Mon propre compte n'apparaît
 * jamais (retiré par le serveur, et ici par sécurité) et on ne peut pas
 * s'abonner à soi-même. En plus, sur téléphone :
 * recherche et filtres exécutés par le serveur (comme la page publique),
 * tri, « Charger plus » par pages de 12, distance depuis ma position.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { LivreurScreen } from '@/features/livreur/components';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { DRIVER_PAGE, fetchDrivers, formatKm, fr, vehicleLabel, type DriverFilter, type DriverSort } from '../api';
import { ActorRow, Chips, FollowControl, SearchBox } from '../components/ui';
import { useDistances, useFollowActions, useMyLivreurId } from '../hooks';

const FILTERS: { id: DriverFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'available', label: 'Disponibles' },
  { id: 'followed', label: 'Suivis' },
  { id: 'moto', label: '🛵 Moto' },
  { id: 'voiture', label: '🚗 Voiture' },
];
const SORTS: { id: DriverSort; label: string }[] = [
  { id: 'note', label: 'Mieux notés' },
  { id: 'livraisons', label: 'Plus de livraisons' },
  { id: 'disponible', label: 'Disponibles d’abord' },
];

export default function DriversScreen() {
  const theme = useTheme();
  const snack = useSnack();
  const me = useMyLivreurId();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DriverFilter>('all');
  const [sort, setSort] = useState<DriverSort>('note');
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  /* « Suivis » n'existe pas côté serveur : liste complète, filtrée ici */
  const serverFilter: DriverFilter = filter === 'followed' ? 'all' : filter;
  const q = useInfiniteQuery({
    queryKey: qk.livreur.drivers(search, serverFilter, sort),
    queryFn: ({ pageParam }) => fetchDrivers(search, serverFilter, sort, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length * DRIVER_PAGE < last.total ? pages.length + 1 : undefined),
  });
  const actions = useFollowActions('livreurs', snack.show);
  /* Jamais ma propre carte (seconde sécurité : le serveur me retire déjà) */
  const loaded = (q.data?.pages.flatMap((p) => p.data) ?? []).filter((l) => l.id !== me);
  const total = q.data?.pages[0]?.total ?? 0;
  const list = filter === 'followed' ? loaded.filter((l) => l.isSuivi) : loaded;
  const dist = useDistances(
    'delivery',
    list.map((l) => l.id),
  );

  const empty =
    search !== ''
      ? 'Aucun livreur ne correspond à cette recherche.'
      : filter === 'available'
        ? 'Aucun livreur disponible pour le moment.'
        : filter === 'followed'
          ? 'Vous ne suivez aucun livreur pour le moment.'
          : 'Aucun livreur disponible.';

  return (
    <LivreurScreen title="Livreurs" subtitle="Les autres livreurs de votre réseau" snack={snack.msg}>
      <FlatList
        {...hideOnScroll}
        data={q.isPending || q.isError ? [] : list}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.head}>
            <SearchBox value={query} onChange={setQuery} placeholder="Rechercher un livreur, une zone…" />
            <Chips items={FILTERS} value={filter} onChange={setFilter} />
            <Chips items={SORTS} value={sort} onChange={setSort} />
            {!q.isPending && !q.isError ? (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {filter === 'followed' ? `${list.length} suivi${list.length > 1 ? 's' : ''} parmi ${loaded.length} chargés` : `${total} livreur${total > 1 ? 's' : ''}`}
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="bicycle-outline" size={40} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {empty}
              </ThemedText>
            </View>
          )
        }
        ListFooterComponent={
          q.hasNextPage ? (
            <Pressable onPress={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage} accessibilityRole="button" style={[styles.more, { borderColor: theme.border }]}>
              {q.isFetchingNextPage ? (
                <ActivityIndicator color={Brand.primary} />
              ) : (
                <ThemedText style={styles.moreText}>
                  Charger plus ({total - loaded.length} restant{total - loaded.length > 1 ? 's' : ''})
                </ThemedText>
              )}
            </Pressable>
          ) : null
        }
        renderItem={({ item: l }) => {
          const d = dist.data?.[`delivery:${l.id}`];
          return (
            <ActorRow
              name={l.fullName || 'Livreur'}
              photo={l.profilePicture}
              meta={[
                (l.zone || l.localisation || '') + (d ? ` · ${d.approx ? '≈ ' : ''}${formatKm(d.km)}` : ''),
                l.vehicule || l.vehiculeType ? vehicleLabel(l.vehicule, l.vehiculeType) : '',
                l.averageRating != null ? `★ ${Number(l.averageRating).toFixed(1)}` : '',
                l.totalLivraisons != null ? `${fr(l.totalLivraisons)} livraison${l.totalLivraisons > 1 ? 's' : ''}` : '',
              ]}
              status={l.disponible ? 'Disponible' : undefined}
              online={l.disponible}
              onOpen={() => router.push({ pathname: '/livreur/reseau/livreurs/[id]', params: { id: l.id } })}
              right={
                <FollowControl
                  name={l.fullName}
                  kindLabel="ce livreur"
                  suivi={l.isSuivi}
                  busy={actions.busy === l.id}
                  onToggle={() => actions.toggle(l.id, l.fullName)}
                  onHide={() => actions.hide(l.id)}
                  onRemove={() => actions.remove(l.id, l.fullName)}
                />
              }
            />
          );
        }}
      />
    </LivreurScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 110 },
  head: { gap: 10, marginBottom: 2 },
  loader: { marginVertical: 32 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 20 },
  center: { textAlign: 'center' },
  more: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 999, minHeight: 46, marginTop: 4 },
  moreText: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: Brand.primary },
});

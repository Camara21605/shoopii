/**
 * Espace livreur › Réseau › Correspondants — équivalent mobile de
 * /dashboard/livreur/reseau/correspondants (ReseauCorrespondantsPage) :
 * liste des correspondants (initiales ou photo, nom, lieu, note, missions,
 * « En ligne ») avec « S'abonner » / « Suivi(e) » + menu ⋮ ; toucher une
 * ligne ouvre le profil natif. En plus, sur téléphone : recherche serveur,
 * filtres « En ligne » / « Suivis » et distance depuis ma position.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { LivreurScreen } from '@/features/livreur/components';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchRelays, formatKm, fr, placeOf, RELAY_TYPE, type RelayFilter } from '../api';
import { ActorRow, Chips, FollowControl, SearchBox } from '../components/ui';
import { useDistances, useFollowActions } from '../hooks';

const FILTERS: { id: RelayFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'online', label: 'En ligne' },
  { id: 'followed', label: 'Suivis' },
];

export default function RelaysScreen() {
  const theme = useTheme();
  const snack = useSnack();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RelayFilter>('all');
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const q = useQuery({ queryKey: qk.livreur.relays(search, filter === 'online' ? 'online' : 'all'), queryFn: () => fetchRelays(search, filter) });
  const actions = useFollowActions('correspondants', snack.show);
  const all = q.data ?? [];
  /* « Suivis » : filtré ici (le serveur ne propose pas ce filtre) */
  const list = filter === 'followed' ? all.filter((c) => c.isSuivi) : all;
  const dist = useDistances(
    'correspondent',
    list.map((c) => c.id),
  );

  const empty =
    search !== ''
      ? 'Aucun correspondant ne correspond à cette recherche.'
      : filter === 'online'
        ? 'Aucun correspondant en ligne pour le moment.'
        : filter === 'followed'
          ? 'Vous ne suivez aucun correspondant pour le moment.'
          : 'Aucun correspondant disponible.';

  return (
    <LivreurScreen title="Correspondants" subtitle="Les points relais de votre réseau" snack={snack.msg}>
      <FlatList
        {...hideOnScroll}
        data={q.isPending || q.isError ? [] : list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.head}>
            <SearchBox value={query} onChange={setQuery} placeholder="Rechercher un correspondant, une ville…" />
            <Chips items={FILTERS} value={filter} onChange={setFilter} />
            {!q.isPending && !q.isError ? (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {list.length} correspondant{list.length > 1 ? 's' : ''}
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
              <Ionicons name="business-outline" size={40} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {empty}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item: c }) => {
          const d = dist.data?.[`correspondent:${c.id}`];
          const place = placeOf(c);
          return (
            <ActorRow
              name={c.fullName || 'Correspondant'}
              photo={c.profilePicture}
              online={c.online}
              meta={[
                place + (d ? ` · ${d.approx ? '≈ ' : ''}${formatKm(d.km)}` : ''),
                c.typeCorrespondant ? (RELAY_TYPE[c.typeCorrespondant] ?? '') : '',
                `★ ${Number(c.averageRating ?? 0).toFixed(1)}`,
                `${fr(c.totalMissions)} mission${c.totalMissions > 1 ? 's' : ''}`,
              ]}
              status={c.online ? 'En ligne' : undefined}
              onOpen={() => router.push({ pathname: '/livreur/reseau/correspondants/[id]', params: { id: c.id } })}
              right={
                <FollowControl
                  name={c.fullName}
                  kindLabel="ce correspondant"
                  suivi={c.isSuivi}
                  busy={actions.busy === c.id}
                  onToggle={() => actions.toggle(c.id, c.fullName)}
                  onHide={() => actions.hide(c.id)}
                  onRemove={() => actions.remove(c.id, c.fullName)}
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
  head: { gap: 12, marginBottom: 2 },
  loader: { marginVertical: 32 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 20 },
  center: { textAlign: 'center' },
});

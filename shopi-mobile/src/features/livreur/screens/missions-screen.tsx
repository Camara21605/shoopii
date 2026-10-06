/**
 * Espace livreur › Missions — équivalent mobile de /dashboard/livreur/missions
 * (MissionsPage.tsx) : commandes assignées au livreur.
 *   · filtres : toutes, nouvelles (à accepter), à récupérer, en route ;
 *     (« Express / Urgentes / Proches » du site : le serveur ne renseigne
 *     ni vitesse, ni urgence, ni distance — ces filtres ne trieraient rien) ;
 *   · une carte par mission : produit, boutique, client, trajet, adresse et
 *     repère de retrait, appel de la boutique, gain ;
 *   · Accepter · Refuser (motif obligatoire) · ouvrir le détail (code de
 *     validation, prise en charge du colis).
 * L'interrupteur « Acceptation auto » du site n'est relié à rien côté serveur :
 * il n'est pas repris.
 */
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import type { MissionStatus } from '../api';
import { Empty, LivreurScreen, MissionCard, RefuseSheet } from '../components';
import { useMissions } from '../hooks';
import { useMissionActions } from '../use-mission-actions';

const FILTERS: { key: MissionStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'new', label: 'Nouvelles' },
  { key: 'prep', label: 'À récupérer' },
  { key: 'active', label: 'En route' },
];

export default function LivreurMissionsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const q = useMissions();
  const actions = useMissionActions();
  const [filter, setFilter] = useState<MissionStatus | 'all'>('all');
  const all = q.data ?? [];
  const list = filter === 'all' ? all : all.filter((m) => m.status === filter);
  const count = (k: MissionStatus | 'all') => (k === 'all' ? all.length : all.filter((m) => m.status === k).length);

  return (
    <LivreurScreen title="Missions" subtitle={`${count('new')} en attente de réponse`} tab="missions" snack={actions.snack.msg}>
      {q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          {...hideOnScroll}
          data={list}
          keyExtractor={(m) => m.uuid}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void qc.invalidateQueries({ queryKey: qk.livreur.all })} colors={[Brand.primary]} tintColor={Brand.primary} />}
          ListHeaderComponent={
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                    <ThemedText style={[styles.chipText, on && styles.chipOn]}>
                      {f.label} ({count(f.key)})
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          }
          ListEmptyComponent={q.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : <Empty emoji="📭" title="Aucune mission" text={filter === 'all' ? 'Les commandes qu’une boutique vous confie apparaîtront ici.' : 'Aucune mission à cette étape.'} />}
          renderItem={({ item }) => (
            <MissionCard
              m={item}
              busy={actions.busy === item.uuid}
              onOpen={() => router.push({ pathname: '/livreur/missions/[id]', params: { id: item.uuid } })}
              onAccept={() => void actions.accept(item)}
              onRefuse={() => actions.setRefusing(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
      {actions.refusing ? <RefuseSheet m={actions.refusing} onClose={() => actions.setRefusing(null)} onConfirm={actions.refuse} /> : null}
    </LivreurScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110 },
  loader: { marginVertical: 32 },
  chips: { gap: 8, paddingRight: 8, paddingBottom: 12 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipOn: { color: Brand.primaryInk, fontWeight: '800' },
  sep: { height: 12 },
});

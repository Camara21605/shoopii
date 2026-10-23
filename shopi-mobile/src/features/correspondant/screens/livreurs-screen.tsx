/**
 * Espace correspondant › Livreurs — équivalent mobile de LivreursPage du site
 * (GET /dashboard/correspondant/livreurs) : les livreurs à qui ce point relais
 * a réellement remis des colis.
 *   · chiffres : livreurs, en ligne, missions ce mois ;
 *   · filtres Tous / En ligne ; par livreur : zone, note, missions, colis en
 *     cours, en ligne → ouvrir son profil, lui écrire (vraie discussion).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { AvatarPhoto } from '@/components/avatar-photo';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchLivreurs, initials } from '../api';
import { CARD, CorrespondantScreen, Empty, Filters, Kpi } from '../components';

type F = 'all' | 'online';

export default function CorrespondantLivreursScreen() {
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.correspondant.livreurs, queryFn: fetchLivreurs, refetchInterval: 60_000 });
  const contact = useActorContact('delivery');
  const [filter, setFilter] = useState<F>('all');
  const d = q.data;
  const list = (d?.items ?? []).filter((l) => filter === 'all' || l.online);

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError || !d) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <View style={styles.kpis}>
          <Kpi icon="🛵" value={String(d.stats.total)} label="Livreurs" />
          <Kpi icon="🟢" value={String(d.stats.enLigne)} label="En ligne" />
          <Kpi icon="📦" value={String(d.stats.missionsCeMois)} label="Missions ce mois" />
        </View>
        {d.items.length ? (
          <View style={styles.filters}>
            <Filters<F>
              value={filter}
              onChange={setFilter}
              items={[
                { id: 'all', label: 'Tous', n: d.stats.total },
                { id: 'online', label: 'En ligne', n: d.stats.enLigne },
              ]}
            />
          </View>
        ) : null}
        {d.items.length === 0 ? (
          <Empty emoji="🛵" title="Aucun livreur pour le moment" text="Les livreurs à qui vous remettez des colis apparaîtront ici." />
        ) : list.length === 0 ? (
          <Empty emoji="🌙" title="Aucun livreur en ligne" text="Aucun de vos livreurs n’est connecté en ce moment." />
        ) : (
          list.map((l) => (
            <View key={l.id || l.nm} style={styles.card}>
              <Pressable
                onPress={() => (l.id ? router.push({ pathname: '/correspondant/livreurs/[id]', params: { id: l.id } }) : undefined)}
                disabled={!l.id}
                accessibilityRole="button"
                accessibilityLabel={`${l.nm}${l.online ? ', en ligne' : ''}. Voir son profil`}
                style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
                <View style={[styles.ava, { backgroundColor: theme.background }]}>
                  {l.photo ? <AvatarPhoto uri={l.photo} size={50} /> : <ThemedText style={styles.init}>{initials(l.nm)}</ThemedText>}
                  {l.online ? <View style={[styles.dot, { borderColor: theme.background }]} /> : null}
                </View>
                <View style={styles.flex}>
                  <ThemedText style={styles.bold} numberOfLines={1}>
                    {l.nm}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {[l.zone || null, l.rat ? `★ ${l.rat.toFixed(1)}` : null, `${l.missions} mission${l.missions > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                  </ThemedText>
                  {l.pending > 0 ? (
                    <ThemedText type="small" style={styles.pending}>
                      🚀 {l.pending} colis en cours
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
              {l.id ? (
                <Pressable
                  onPress={() => void contact.message(l.id)}
                  disabled={!!contact.busy}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Écrire à ${l.nm}`}
                  style={[styles.msg, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  {contact.busy === `msg:${l.id}` ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="chatbubble-ellipses-outline" size={17} color={Brand.primary} />}
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    );

  return (
    <CorrespondantScreen title="Livreurs" subtitle="Les livreurs à qui vous remettez des colis">
      {body}
    </CorrespondantScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  pressed: { opacity: 0.85 },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filters: { marginHorizontal: -16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderRadius: 18, padding: 12 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ava: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  init: { fontWeight: '900', color: Brand.primary },
  dot: { position: 'absolute', right: 0, bottom: 2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, backgroundColor: Brand.success },
  pending: { color: '#6D28D9', fontWeight: '700' },
  msg: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

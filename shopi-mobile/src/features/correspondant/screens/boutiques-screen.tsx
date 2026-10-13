/**
 * Espace correspondant › Boutiques — équivalent mobile de BoutiquesPage du
 * site (GET /dashboard/correspondant/boutiques) : les boutiques avec qui ce
 * point relais a réellement traité des colis.
 *   · chiffres : boutiques, colis actifs, colis à réceptionner, note moyenne ;
 *   · par boutique : catégorie, note, depuis quand, colis traités, colis en
 *     attente → ouvrir la boutique, lui écrire (vraie discussion) ;
 *   · recherche par nom ou catégorie.
 * « Inviter une boutique » du site n'affiche qu'un message : pas repris.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchBoutiques } from '../api';
import { CARD, CorrespondantScreen, Empty, Kpi } from '../components';

export default function CorrespondantBoutiquesScreen() {
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.correspondant.boutiques, queryFn: fetchBoutiques });
  const contact = useActorContact('company');
  const [search, setSearch] = useState('');
  const d = q.data;

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (d?.items ?? []).filter((b) => !s || b.nm.toLowerCase().includes(s) || b.cat.toLowerCase().includes(s));
  }, [d, search]);

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError || !d) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <View style={styles.kpis}>
          <Kpi icon="🏪" value={String(d.stats.total)} label="Boutiques" />
          <Kpi icon="📦" value={String(d.stats.colisActifs)} label="Colis actifs" />
          <Kpi
            icon="⏳"
            value={String(d.stats.enAttente)}
            label="À réceptionner"
            onPress={d.stats.enAttente ? () => router.navigate({ pathname: '/correspondant/colis', params: { filtre: 'att' } }) : undefined}
          />
          <Kpi icon="⭐" value={d.stats.noteMoyenne ? d.stats.noteMoyenne.toFixed(1) : '—'} label="Note moyenne" />
        </View>

        {d.items.length > 3 ? (
          <View style={[styles.search, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Ionicons name="search" size={16} color={theme.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Nom ou catégorie…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              accessibilityLabel="Rechercher une boutique"
            />
          </View>
        ) : null}

        {d.items.length === 0 ? (
          <Empty emoji="🏪" title="Aucune boutique pour le moment" text="Les boutiques dont les colis passent par votre point relais apparaîtront ici." />
        ) : list.length === 0 ? (
          <Empty emoji="🔎" title="Aucun résultat" />
        ) : (
          list.map((b) => (
            <View key={b.id || b.nm} style={styles.card}>
              <Pressable
                onPress={() => (b.id ? router.push({ pathname: '/boutique/[id]', params: { id: b.id } }) : undefined)}
                disabled={!b.id}
                accessibilityRole="button"
                accessibilityLabel={`${b.nm}, ${b.colis} colis. Ouvrir la boutique`}
                style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
                <View style={[styles.logo, { backgroundColor: theme.background }]}>
                  <ThemedText style={styles.emoji}>{b.em}</ThemedText>
                </View>
                <View style={styles.flex}>
                  <ThemedText style={styles.bold} numberOfLines={1}>
                    {b.nm}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {[b.cat, b.rat ? `★ ${b.rat.toFixed(1)}` : null, b.since ? `depuis ${b.since}` : null].filter(Boolean).join(' · ')}
                  </ThemedText>
                  <ThemedText type="small" numberOfLines={1}>
                    📦 {b.colis} colis{b.pending > 0 ? <ThemedText type="small" style={styles.pending}>{`  ·  ⏳ ${b.pending} à réceptionner`}</ThemedText> : null}
                  </ThemedText>
                </View>
              </Pressable>
              {b.id ? (
                <Pressable
                  onPress={() => void contact.message(b.id)}
                  disabled={!!contact.busy}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Écrire à ${b.nm}`}
                  style={[styles.msg, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  {contact.busy === `msg:${b.id}` ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="chatbubble-ellipses-outline" size={17} color={Brand.primary} />}
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    );

  return (
    <CorrespondantScreen title="Boutiques" subtitle="Les boutiques qui vous confient des colis">
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
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 42 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderRadius: 18, padding: 12 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24, lineHeight: 30 },
  pending: { color: '#B45309', fontWeight: '800' },
  msg: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

/**
 * Espace livreur › Mes boutiques — équivalent mobile de
 * /dashboard/livreur/boutiques (BoutiquesPage.tsx) : boutiques pour
 * lesquelles le livreur livre (logo, catégorie, note, depuis quand,
 * livraisons, en attente), « Message » (vraie discussion avec la boutique),
 * répartition des livraisons par boutique. Toucher une boutique ouvre sa fiche.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openConversationWith } from '@/features/messagerie/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchBoutiques } from '../api';
import { Box, CARD, Empty, LivreurScreen } from '../components';

export default function LivreurBoutiquesScreen() {
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.livreur.boutiques, queryFn: fetchBoutiques });
  const snack = useSnack();
  const [opening, setOpening] = useState<string | null>(null);
  const items = q.data?.items ?? [];
  const total = q.data?.totalDeliveries ?? items.reduce((s, b) => s + b.delivs, 0);

  const message = async (id: string, name: string, logo?: string | null) => {
    setOpening(id);
    try {
      const c = await openConversationWith('company', id);
      router.push({ pathname: '/messages/[id]', params: { id: c.id, name: c.contactName ?? name, logo: c.contactLogo ?? logo ?? '', online: c.contactOnline ? '1' : '0', userId: c.contactUserId ?? '' } });
    } catch (e) {
      snack.show(toUserMessage(e), true);
    } finally {
      setOpening(null);
    }
  };

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView {...hideOnScroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        {items.length === 0 ? (
          <Empty emoji="🏪" title="Aucune boutique pour le moment" text="Les boutiques pour lesquelles vous livrez apparaîtront ici." />
        ) : (
          items.map((b) => (
            <View key={b.id} style={styles.card}>
              <Pressable onPress={() => router.push({ pathname: '/boutique/[id]', params: { id: b.id } })} accessibilityRole="button" accessibilityLabel={`${b.nm}, ${b.delivs} livraisons. Ouvrir la boutique`} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
              <View style={[styles.logo, { backgroundColor: theme.background }]}>
                {b.logo ? <Image source={{ uri: b.logo }} style={styles.img} contentFit="cover" /> : <ThemedText style={styles.emoji}>{b.em}</ThemedText>}
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.bold} numberOfLines={1}>
                  {b.nm}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {[b.cat, b.rat ? `★ ${b.rat.toFixed(1)}` : null, b.since ? `depuis ${b.since}` : null].filter(Boolean).join(' · ')}
                </ThemedText>
                {b.pending > 0 ? (
                  <View style={styles.pending}>
                    <ThemedText style={styles.pendingText}>{b.pending} en attente</ThemedText>
                  </View>
                ) : null}
              </View>
              </Pressable>
              <View style={styles.right}>
                <ThemedText style={styles.delivs}>{b.delivs}</ThemedText>
                <ThemedText style={styles.small} themeColor="textSecondary">
                  livr.
                </ThemedText>
                <Pressable onPress={() => void message(b.id, b.nm, b.logo)} disabled={opening === b.id} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Écrire à ${b.nm}`} style={[styles.msg, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  {opening === b.id ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="chatbubble-ellipses-outline" size={17} color={Brand.primary} />}
                </Pressable>
              </View>
            </View>
          ))
        )}

        {items.length ? (
          <Box icon="pie-chart-outline" title="Répartition des livraisons">
            {items.map((b) => {
              const pct = total > 0 ? Math.round((b.delivs / total) * 100) : 0;
              return (
                <View key={b.id} style={styles.rep}>
                  <View style={styles.repTop}>
                    <ThemedText type="small" style={[styles.flex, styles.bold]} numberOfLines={1}>
                      {b.nm}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {b.delivs} · {pct} %
                    </ThemedText>
                  </View>
                  <View style={[styles.bar, { backgroundColor: theme.background }]}>
                    <View style={[styles.fill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
            <View style={styles.repTop}>
              <ThemedText type="small" style={styles.flex}>
                Total
              </ThemedText>
              <ThemedText type="smallBold">
                {total} livraison{total > 1 ? 's' : ''}
              </ThemedText>
            </View>
          </Box>
        ) : null}
      </ScrollView>
    );

  return (
    <LivreurScreen title="Mes boutiques" subtitle="Les boutiques pour lesquelles vous livrez" snack={snack.msg}>
      {body}
    </LivreurScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  pressed: { opacity: 0.85 },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 18, padding: 12 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  emoji: { fontSize: 24, lineHeight: 30 },
  pending: { alignSelf: 'flex-start', backgroundColor: '#FEF3E2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, marginTop: 3 },
  pendingText: { color: '#B45309', fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
  right: { alignItems: 'center', gap: 2 },
  delivs: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  small: { fontSize: 10.5, lineHeight: 14 },
  msg: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  rep: { gap: 5 },
  repTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, backgroundColor: Brand.primary },
});

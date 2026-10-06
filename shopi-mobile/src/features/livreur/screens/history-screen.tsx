/**
 * Espace livreur › Historique — équivalent mobile de /dashboard/livreur/historique
 * (HistoriquePage.tsx) : filtres tout / livrées / incidents / annulées ; une
 * ligne par livraison (produit, boutique, date, statut, gain + ou −) ; toucher
 * → détail de la commande. « Exporter » produit un vrai CSV partagé (sur le
 * site, ce bouton n'affiche qu'un message).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchHistory, gnf, HIST_STATUS, type HistItem } from '../api';
import { CARD, Empty, LivreurScreen, Pill } from '../components';

const FILTERS: { key: HistItem['status'] | 'all'; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'done', label: 'Livrées' },
  { key: 'iss', label: 'Incidents' },
  { key: 'can', label: 'Annulées' },
];

async function exportCsv(list: HistItem[]) {
  const esc = (v: string | number) => (/[";\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const csv = `﻿${['Commande', 'Produit', 'Boutique', 'Date', 'Statut', 'Gain (GNF)'].join(';')}\n${list.map((h) => [h.id, h.nm, h.shop, h.date, HIST_STATUS[h.status].label, (h.earn ? 1 : -1) * h.fee].map(esc).join(';')).join('\n')}`;
  const name = `historique-livraisons-${new Date().toISOString().slice(0, 10)}.csv`;
  if (Platform.OS === 'web') {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = doc.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(csv);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Historique des livraisons', UTI: 'public.comma-separated-values-text' });
}

export default function LivreurHistoryScreen() {
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.livreur.history, queryFn: fetchHistory });
  const [filter, setFilter] = useState<HistItem['status'] | 'all'>('all');
  const snack = useSnack();
  const all = q.data ?? [];
  const list = filter === 'all' ? all : all.filter((h) => h.status === filter);
  const gains = all.filter((h) => h.earn).reduce((s, h) => s + h.fee, 0);

  const doExport = async () => {
    try {
      await exportCsv(list);
      snack.show(`📄 ${list.length} livraison${list.length > 1 ? 's' : ''} exportée${list.length > 1 ? 's' : ''}`);
    } catch (e) {
      snack.show(toUserMessage(e), true);
    }
  };

  return (
    <LivreurScreen title="Historique" subtitle={`${all.length} livraison${all.length > 1 ? 's' : ''} · ${gnf(gains)} gagnés`} snack={snack.msg}>
      {q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          {...hideOnScroll}
          data={list}
          keyExtractor={(h) => h.uuid}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
          ListHeaderComponent={
            <View style={styles.head}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {FILTERS.map((f) => {
                  const on = f.key === filter;
                  const n = f.key === 'all' ? all.length : all.filter((h) => h.status === f.key).length;
                  return (
                    <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                      <ThemedText style={[styles.chipText, on && styles.chipOn]}>
                        {f.label} ({n})
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {list.length ? (
                <Pressable onPress={() => void doExport()} accessibilityRole="button" accessibilityLabel="Exporter l’historique" style={[styles.export, { borderColor: theme.border }]}>
                  <Ionicons name="download-outline" size={16} color={Brand.primary} />
                  <ThemedText type="smallBold">Exporter</ThemedText>
                </Pressable>
              ) : null}
            </View>
          }
          ListEmptyComponent={q.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : <Empty emoji="📭" title="Aucune livraison" text="Vos livraisons terminées apparaîtront ici." />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/livreur/missions/[id]', params: { id: item.uuid } })} accessibilityRole="button" accessibilityLabel={`${item.id}, ${item.nm}, ${HIST_STATUS[item.status].label}`} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={[styles.ico, { backgroundColor: theme.background }]}>
                <ThemedText style={styles.emoji}>📦</ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.bold} numberOfLines={1}>
                  {item.nm}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.id} · {item.shop} · {item.date}
                </ThemedText>
                <Pill tone={HIST_STATUS[item.status]} />
              </View>
              <ThemedText style={[styles.fee, { color: item.earn ? Brand.success : Brand.danger }]}>
                {item.earn ? '+' : '−'}
                {gnf(item.fee)}
              </ThemedText>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </LivreurScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  pressed: { opacity: 0.85 },
  loader: { marginVertical: 32 },
  content: { padding: 16, paddingBottom: 110 },
  head: { gap: 10, marginBottom: 12 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipOn: { color: Brand.primaryInk, fontWeight: '800' },
  export: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 16, padding: 12 },
  ico: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 18, lineHeight: 24 },
  fee: { fontSize: 14.5, lineHeight: 19, fontWeight: '900' },
  sep: { height: 10 },
});

/**
 * Espace correspondant › Colis, Transferts et Retours — équivalents mobiles
 * de ColisPage, TransfertsPage et RetoursPage du site, sur la même liste
 * (GET /dashboard/correspondant/colis) :
 *   · Colis : tous les colis où intervient ce point relais, filtres à
 *     compteurs (à réceptionner, en stock, confiés au livreur, livrés,
 *     retours), recherche (n°, produit, boutique, client, livreur), colis
 *     urgents en tête ;
 *   · Transferts : colis réceptionnés puis confiés à un livreur ;
 *   · Retours : colis annulés, remboursés, en litige ou au code expiré, avec
 *     le motif et un filtre par motif.
 * Chaque colis ouvre son détail, où se valide la réception avec SON code (le
 * « Scanner / Enregistrer » et « Gérer » du site n'affichent qu'un message :
 * pas repris).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { type Colis, type ColisStatus } from '../api';
import { ColisCard, CorrespondantScreen, Empty, Filters } from '../components';
import { useColis } from '../hooks';

type Mode = 'colis' | 'transferts' | 'retours';
type ColisFilter = 'all' | ColisStatus;

const MODE: Record<Mode, { title: string; subtitle: string; tab?: string; emptyEmoji: string; empty: string; emptyText: string }> = {
  colis: {
    title: 'Colis',
    subtitle: 'Les colis qui passent par vous',
    tab: 'colis',
    emptyEmoji: '📦',
    empty: 'Aucun colis',
    emptyText: 'Les commandes qui passent par votre point relais apparaîtront ici.',
  },
  transferts: {
    title: 'Transferts',
    subtitle: 'Colis confiés aux livreurs',
    tab: 'transferts',
    emptyEmoji: '🚀',
    empty: 'Aucun transfert en cours',
    emptyText: 'Les colis réceptionnés puis confiés à un livreur apparaîtront ici.',
  },
  retours: {
    title: 'Retours',
    subtitle: 'Colis annulés, remboursés ou en litige',
    emptyEmoji: '↩️',
    empty: 'Aucun retour',
    emptyText: 'Les colis annulés, remboursés, en litige ou au code expiré apparaîtront ici.',
  },
};

const matches = (c: Colis, q: string) => !q || [c.id, c.nm, c.boutique, c.client, c.livreur ?? ''].some((v) => v.toLowerCase().includes(q));

export function ColisListScreen({ mode }: { mode: Mode }) {
  const theme = useTheme();
  const q = useColis();
  const params = useLocalSearchParams<{ filtre?: string }>();
  const initial = (['att', 'stock', 'dep', 'livr', 'ret'] as const).find((s) => s === params.filtre) ?? 'all';
  const [filter, setFilter] = useState<ColisFilter>(initial);
  const [motif, setMotif] = useState<string>('all');
  const [search, setSearch] = useState('');
  const m = MODE[mode];
  const all = useMemo(() => q.data?.items ?? [], [q.data]);
  const counts = q.data?.counts;

  const motifs = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of all) if (c.status === 'ret' && c.motif) map.set(c.motif, (map.get(c.motif) ?? 0) + 1);
    return [...map.entries()];
  }, [all]);

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    let l = all;
    if (mode === 'transferts') l = l.filter((c) => c.status === 'dep');
    else if (mode === 'retours') l = l.filter((c) => c.status === 'ret' && (motif === 'all' || c.motif === motif));
    else if (filter !== 'all') l = l.filter((c) => c.status === filter);
    l = l.filter((c) => matches(c, s));
    /* Urgents d'abord (le serveur trie déjà du plus récent au plus ancien) */
    return [...l.filter((c) => c.urgent), ...l.filter((c) => !c.urgent)];
  }, [all, mode, filter, motif, search]);

  let header: React.ReactNode = null;
  if (mode === 'colis' && counts)
    header = (
      <Filters<ColisFilter>
        value={filter}
        onChange={setFilter}
        items={[
          { id: 'all', label: 'Tous', n: counts.all },
          { id: 'att', label: 'À réceptionner', n: counts.att },
          { id: 'stock', label: 'En stock', n: counts.stock },
          { id: 'dep', label: 'Confiés au livreur', n: counts.dep },
          { id: 'livr', label: 'Livrés', n: counts.livr },
          { id: 'ret', label: 'Retours', n: counts.ret },
        ]}
      />
    );
  else if (mode === 'retours' && motifs.length > 1)
    header = <Filters<string> value={motif} onChange={setMotif} items={[{ id: 'all', label: 'Tous', n: counts?.ret }, ...motifs.map(([id, n]) => ({ id, label: id, n }))]} />;

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <FlatList
        {...hideOnScroll}
        data={list}
        keyExtractor={(c) => c.uuid || c.id}
        renderItem={({ item }) => <ColisCard c={item} />}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.head}>
            {mode !== 'colis' ? (
              <ThemedText type="small" themeColor="textSecondary">
                {mode === 'transferts' ? `${list.length} colis confié${list.length > 1 ? 's' : ''} à un livreur` : `${list.length} retour${list.length > 1 ? 's' : ''}`}
              </ThemedText>
            ) : null}
            {mode === 'colis' && filter === 'att' && list.length ? (
              <View style={[styles.hint, { borderColor: theme.border }]}>
                <Ionicons name="key-outline" size={16} color={Brand.primary} />
                <ThemedText type="small" style={styles.flex}>
                  Ouvrez un colis à son arrivée pour confirmer sa réception avec votre code.
                </ThemedText>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          search.trim() ? <Empty emoji="🔎" title="Aucun résultat" text={`Aucun colis ne correspond à « ${search.trim()} ».`} /> : <Empty emoji={m.emptyEmoji} title={m.empty} text={m.emptyText} />
        }
      />
    );

  return (
    <CorrespondantScreen title={m.title} subtitle={m.subtitle} tab={m.tab}>
      <View style={styles.searchWrap}>
        <View style={[styles.search, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <Ionicons name="search" size={16} color={theme.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="N° de colis, produit, boutique, client…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            accessibilityLabel="Rechercher un colis"
            returnKeyType="search"
          />
        </View>
      </View>
      {header}
      {body}
    </CorrespondantScreen>
  );
}

export default function CorrespondantColisScreen() {
  return <ColisListScreen mode="colis" />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginVertical: 32 },
  content: { paddingHorizontal: 16, paddingBottom: 110, gap: 10 },
  head: { gap: 8 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 10 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 42 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
});

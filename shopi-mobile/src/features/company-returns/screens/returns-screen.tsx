/**
 * Espace entreprise › Retours & SAV — équivalent mobile de
 * /dashboard/entreprise/retours (RetoursPage.tsx), deux onglets :
 *
 *   RETOURS : total du mois (+ aujourd'hui), en attente, taux d'acceptation,
 *     montant remboursé ; top motifs (barres) ; performance (délai moyen,
 *     refusés, remboursements) ; recherche (référence ou produit), filtres
 *     statut / motif / priorité, tri ; une carte par demande, 20 par 20.
 *     Toucher → détail (accepter, refuser, marquer reçu, rembourser, note,
 *     priorité, historique, preuves).
 *   SAV : tickets ouverts, en cours, résolus, délai de réponse moyen ;
 *     recherche, filtres statut / priorité ; une carte par ticket (non lus).
 *     Toucher → conversation.
 *
 * Accès : returns.view ; agir (accepter, rembourser, répondre…) : returns.process.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import {
  duration,
  fetchReturns,
  fetchReturnStats,
  fetchSavStats,
  fetchTickets,
  plural,
  PRIORITIES,
  REASONS,
  SAV_STATUS,
  short,
  SORTS,
  STATUS,
  type Priority,
  type ReturnFilters,
  type ReturnReason,
  type ReturnStats,
  type ReturnStatus,
  type SavFilters,
  type SavStats,
  type SavStatus,
} from '../api';
import { CARD, FilterChips, ReturnCard, TicketCard } from '../components/ui';

type Tab = 'retours' | 'sav';

function useDebounced(value: string) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value.trim()), 350);
    return () => clearTimeout(t);
  }, [value]);
  return v;
}

export default function ReturnsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canView = perms.isOwner || perms.can('returns', 'view');
  const [tab, setTab] = useState<Tab>('retours');

  const [rSearch, setRSearch] = useState('');
  const rTerm = useDebounced(rSearch);
  const [rf, setRf] = useState<Omit<ReturnFilters, 'search'>>({ sort: 'createdAt_DESC' });
  const [sSearch, setSSearch] = useState('');
  const sTerm = useDebounced(sSearch);
  const [sf, setSf] = useState<Omit<SavFilters, 'search'>>({});
  const [sorting, setSorting] = useState(false);

  const rFilters: ReturnFilters = { ...rf, search: rTerm };
  const sFilters: SavFilters = { ...sf, search: sTerm };

  const stats = useQuery({ queryKey: qk.company.returnStats, queryFn: fetchReturnStats, enabled: canView });
  const savStats = useQuery({ queryKey: qk.company.savStats, queryFn: fetchSavStats, enabled: canView });
  const returns = useInfiniteQuery({
    queryKey: qk.company.returns(rFilters),
    queryFn: ({ pageParam }) => fetchReturns(rFilters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (l) => (l.page < l.pages ? l.page + 1 : undefined),
    enabled: canView && tab === 'retours',
    placeholderData: keepPreviousData,
  });
  const tickets = useInfiniteQuery({
    queryKey: qk.company.savTickets(sFilters),
    queryFn: ({ pageParam }) => fetchTickets(sFilters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (l) => (l.page < l.pages ? l.page + 1 : undefined),
    enabled: canView && tab === 'sav',
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const refreshAll = () => void qc.invalidateQueries({ queryKey: qk.company.returnsAll });

  const tabs = (
    <View style={[styles.tabs, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
      <TabBtn on={tab === 'retours'} icon="return-down-back-outline" label="Retours" count={stats.data?.pending} onPress={() => setTab('retours')} />
      <TabBtn on={tab === 'sav'} icon="headset-outline" label="SAV" count={savStats.data?.open} onPress={() => setTab('sav')} />
    </View>
  );

  const search = (value: string, set: (v: string) => void, placeholder: string, label: string) => (
    <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="search" size={17} color={theme.textSecondary} />
      <TextInput value={value} onChangeText={set} placeholder={placeholder} placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} accessibilityLabel={label} returnKeyType="search" autoCorrect={false} />
      {value ? (
        <Pressable onPress={() => set('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer">
          <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );

  const priorityChips = (value: Priority | undefined, onChange: (p: Priority | undefined) => void) => (
    <FilterChips label="Priorité" value={value} onChange={onChange} options={[{ value: undefined, label: 'Toutes les priorités' }, ...(Object.keys(PRIORITIES) as Priority[]).map((p) => ({ value: p, label: PRIORITIES[p].label }))]} />
  );

  let body: React.ReactNode;
  if (perms.loading) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.h2}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Vous n’avez pas accès aux retours et au SAV. Contactez le propriétaire de la boutique pour l’obtenir.
        </ThemedText>
      </View>
    );
  else if (tab === 'retours') {
    const list = returns.data?.pages.flatMap((p) => p.data) ?? [];
    const total = returns.data?.pages[0]?.total ?? 0;
    const s = stats.data;
    body = (
      <FlatList
        {...hideOnScroll}
        data={list}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={returns.isRefetching && !returns.isFetchingNextPage} onRefresh={refreshAll} colors={[Brand.primary]} tintColor={Brand.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (returns.hasNextPage && !returns.isFetchingNextPage) void returns.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            {tabs}
            {s ? <ReturnKpis s={s} /> : stats.isPending ? <ActivityIndicator color={Brand.primary} /> : null}
            {s ? <Motifs s={s} onPick={(reason) => setRf((f) => ({ ...f, reason: f.reason === reason ? undefined : reason }))} active={rf.reason} /> : null}
            {s ? <Performance s={s} /> : null}
            {search(rSearch, setRSearch, 'Rechercher par référence ou produit…', 'Rechercher un retour')}
            <FilterChips<ReturnStatus>
              label="Statut"
              value={rf.status}
              onChange={(status) => setRf((f) => ({ ...f, status }))}
              options={[
                { value: undefined, label: 'Tous les statuts' },
                ...(Object.keys(STATUS) as ReturnStatus[]).map((k) => ({ value: k, label: STATUS[k].label, count: k === 'pending' ? s?.pending : k === 'accepted' ? s?.accepted : k === 'refused' ? s?.refused : k === 'refunded' ? s?.refunded : undefined })),
              ]}
            />
            <FilterChips<ReturnReason> label="Motif" value={rf.reason} onChange={(reason) => setRf((f) => ({ ...f, reason }))} options={[{ value: undefined, label: 'Tous les motifs' }, ...(Object.keys(REASONS) as ReturnReason[]).map((k) => ({ value: k, label: REASONS[k] }))]} />
            {priorityChips(rf.priority, (priority) => setRf((f) => ({ ...f, priority })))}
            <View style={styles.countRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {returns.data ? plural(total, 'résultat') : ' '}
                {returns.isFetching && !returns.isFetchingNextPage && returns.data ? ' · mise à jour…' : ''}
              </ThemedText>
              <Pressable onPress={() => setSorting(true)} accessibilityRole="button" accessibilityLabel="Trier" style={[styles.sortBtn, { borderColor: theme.border }]}>
                <Ionicons name="swap-vertical" size={15} color={theme.text} />
                <ThemedText type="smallBold">{SORTS.find((x) => x.value === rf.sort)?.label}</ThemedText>
              </Pressable>
            </View>
          </View>
        }
        ListFooterComponent={returns.isFetchingNextPage ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
        ListEmptyComponent={
          returns.isPending ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : returns.isError ? (
            <ErrorState error={returns.error} onRetry={() => void returns.refetch()} />
          ) : (
            <Empty icon="file-tray-outline" title="Aucun retour trouvé" text={rTerm || rf.status || rf.reason || rf.priority ? 'Aucune demande de retour ne correspond à vos filtres.' : 'Les demandes de retour de vos clients apparaîtront ici.'} />
          )
        }
        renderItem={({ item }) => <ReturnCard r={item} onPress={() => router.push({ pathname: '/entreprise/retours/[id]', params: { id: item.id } })} />}
      />
    );
  } else {
    const list = tickets.data?.pages.flatMap((p) => p.data) ?? [];
    const s = savStats.data;
    body = (
      <FlatList
        {...hideOnScroll}
        data={list}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={tickets.isRefetching && !tickets.isFetchingNextPage} onRefresh={refreshAll} colors={[Brand.primary]} tintColor={Brand.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (tickets.hasNextPage && !tickets.isFetchingNextPage) void tickets.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            {tabs}
            {s ? <SavKpis s={s} /> : savStats.isPending ? <ActivityIndicator color={Brand.primary} /> : null}
            {search(sSearch, setSSearch, 'Rechercher un ticket (réf., sujet)…', 'Rechercher un ticket')}
            <FilterChips<SavStatus>
              label="Statut"
              value={sf.status}
              onChange={(status) => setSf((f) => ({ ...f, status }))}
              options={[
                { value: undefined, label: 'Tous les statuts' },
                ...(Object.keys(SAV_STATUS) as SavStatus[]).map((k) => ({
                  value: k,
                  label: SAV_STATUS[k].label,
                  count: s ? { open: s.open, in_progress: s.inProgress, waiting_client: s.waitingClient, resolved: s.resolved, closed: s.closed }[k] : undefined,
                })),
              ]}
            />
            {priorityChips(sf.priority, (priority) => setSf((f) => ({ ...f, priority })))}
            {tickets.data ? (
              <ThemedText type="small" themeColor="textSecondary">
                {plural(tickets.data.pages[0]?.total ?? 0, 'ticket')}
                {tickets.isFetching && !tickets.isFetchingNextPage ? ' · mise à jour…' : ''}
              </ThemedText>
            ) : null}
          </View>
        }
        ListFooterComponent={tickets.isFetchingNextPage ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
        ListEmptyComponent={
          tickets.isPending ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : tickets.isError ? (
            <ErrorState error={tickets.error} onRetry={() => void tickets.refetch()} />
          ) : (
            <Empty icon="headset-outline" title="Aucun ticket SAV" text="Les tickets client apparaîtront ici." />
          )
        }
        renderItem={({ item }) => <TicketCard t={item} onPress={() => router.push({ pathname: '/entreprise/retours/sav/[id]', params: { id: item.id } })} />}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Retours & SAV" subtitle="Demandes de retour et service après-vente" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="retours" />
      {sorting ? (
        <BottomSheet title="Trier les retours" onClose={() => setSorting(false)}>
          <View style={styles.sortList}>
            {SORTS.map((x) => {
              const on = x.value === rf.sort;
              return (
                <Pressable
                  key={x.value}
                  onPress={() => {
                    setRf((f) => ({ ...f, sort: x.value }));
                    setSorting(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.sortRow, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                  <ThemedText style={[styles.flex, on && styles.bold]}>{x.label}</ThemedText>
                  {on ? <Ionicons name="checkmark" size={20} color={Brand.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </BottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

function ReturnKpis({ s }: { s: ReturnStats }) {
  return (
    <View style={styles.kpis}>
      <Kpi icon="🔄" value={String(s.thisMonth)} label="Total ce mois" sub={`+${s.today} auj.`} />
      <Kpi icon="⏳" value={String(s.pending)} label="En attente" sub={s.pending > 0 ? 'À traiter' : 'Rien en attente'} warn={s.pending > 0} />
      <Kpi icon="✅" value={`${s.tauxAcceptation} %`} label="Acceptés" sub={plural(s.accepted, 'retour')} />
      <Kpi icon="💸" value={short(s.totalMontantRembourse)} label="Remboursé (GNF)" sub={`${s.refunded} remb.`} />
    </View>
  );
}

function SavKpis({ s }: { s: SavStats }) {
  return (
    <View style={styles.kpis}>
      <Kpi icon="📬" value={String(s.open)} label="Tickets ouverts" sub={s.waitingClient ? `${s.waitingClient} en attente client` : ' '} warn={s.open > 0} />
      <Kpi icon="🔵" value={String(s.inProgress)} label="En cours" sub=" " />
      <Kpi icon="✅" value={String(s.resolved)} label="Résolus" sub={`${s.closed} fermés`} />
      <Kpi icon="⏱️" value={duration(s.avgResponseMinutes)} label="Délai réponse moy." sub=" " />
    </View>
  );
}

function Kpi({ icon, value, label, sub, warn }: { icon: string; value: string; label: string; sub: string; warn?: boolean }) {
  return (
    <View style={[styles.kpi, warn && { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine, borderWidth: 1 }]} accessible accessibilityLabel={`${label} : ${value}`}>
      <ThemedText style={styles.kpiIcon}>{icon}</ThemedText>
      <ThemedText style={styles.kpiV} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {sub}
      </ThemedText>
    </View>
  );
}

function Motifs({ s, active, onPick }: { s: ReturnStats; active?: ReturnReason; onPick: (r: ReturnReason) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.box}>
      <View style={styles.boxHead}>
        <Ionicons name="pie-chart-outline" size={17} color={Brand.primary} />
        <ThemedText style={styles.boxTitle}>Top motifs de retour</ThemedText>
      </View>
      {s.topMotifs.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Aucune donnée
        </ThemedText>
      ) : (
        s.topMotifs.map((m) => {
          const on = active === m.reason;
          return (
            <Pressable key={m.reason} onPress={() => onPick(m.reason)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${REASONS[m.reason]} : ${m.count}, ${m.percentage} %. Filtrer`} style={[styles.motif, on && { backgroundColor: theme.background }]}>
              <View style={styles.motifTop}>
                <ThemedText type="small" style={[styles.flex, styles.bold]}>
                  {REASONS[m.reason]}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {m.count} ({m.percentage} %)
                </ThemedText>
              </View>
              <View style={[styles.bar, { backgroundColor: theme.background }]}>
                <View style={[styles.barFill, { width: `${m.percentage}%` }]} />
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

function Performance({ s }: { s: ReturnStats }) {
  return (
    <View style={styles.box}>
      <View style={styles.boxHead}>
        <Ionicons name="speedometer-outline" size={17} color={Brand.primary} />
        <ThemedText style={styles.boxTitle}>Performance</ThemedText>
      </View>
      {[
        ['Délai moyen traitement', `${s.delaiMoyenHeures} h`],
        ['Retours refusés', String(s.refused)],
        ['Remboursements effectués', String(s.refunded)],
      ].map(([l, v]) => (
        <View key={l} style={styles.perf}>
          <ThemedText type="small" style={styles.flex}>
            {l}
          </ThemedText>
          <ThemedText style={styles.perfV}>{v}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function TabBtn({ on, icon, label, count, onPress }: { on: boolean; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; count?: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && [styles.tabOn, { backgroundColor: theme.background }]]}>
      <Ionicons name={icon} size={17} color={on ? Brand.primary : theme.textSecondary} />
      <ThemedText type="smallBold" style={{ color: on ? theme.text : theme.textSecondary }}>
        {label}
      </ThemedText>
      {count ? (
        <View style={styles.tabCount}>
          <ThemedText style={styles.tabCountText}>{count}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

function Empty({ icon, title, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIco}>
        <Ionicons name={icon} size={28} color={Brand.primary} />
      </View>
      <ThemedText style={styles.h2}>{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  loader: { marginVertical: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  h2: { fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  header: { gap: 12, marginBottom: 2 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, minHeight: 42 },
  tabOn: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, backgroundColor: Brand.primary },
  tabCountText: { color: '#fff', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flexBasis: '47%', flexGrow: 1, backgroundColor: CARD, borderRadius: 16, padding: 12, gap: 1 },
  kpiIcon: { fontSize: 18, lineHeight: 24 },
  kpiV: { fontSize: 21, lineHeight: 27, fontWeight: '900' },
  box: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 6 },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  boxTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  motif: { borderRadius: 10, padding: 5, gap: 5 },
  motifTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bar: { height: 7, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: Brand.primary },
  perf: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  perfV: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sortList: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  sortRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 16 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.primarySoft },
});

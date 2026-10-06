/**
 * Espace entreprise › Clients & Abonnés — équivalent mobile de
 * /dashboard/entreprise/clients (ClientsPage.tsx) :
 *   · chiffres clés : total clients (acheteurs · abonnés), VIP, CA total
 *     (panier moyen), nouveaux acheteurs ;
 *   · répartition par segment (barres) — toucher un segment le filtre ;
 *   · actions CRM : newsletter VIP, offre fidélité, relance des inactifs
 *     (aperçu puis envoi), rapport PDF des segments (partage) ;
 *   · filtres source (tous / acheteurs / abonnés) et segment, recherche
 *     (nom ou e-mail), tri (plus dépensé, plus de commandes, dernière
 *     commande, plus récents) ;
 *   · une carte par client (segment, source, commandes, total, dernière
 *     commande), 20 par 20 en faisant défiler ; toucher → profil complet ;
 *   · « Message » ouvre une vraie discussion avec le client (sur le site, ce
 *     bouton n'affiche qu'un message de confirmation sans rien envoyer).
 * Accès : orders.view (comme la barre latérale du site). Écrire aux clients
 * (message, campagnes) : messaging.send.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { openConversationWith } from '@/features/messagerie/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { CRM, fetchClients, gnf, plural, SEGMENT_FILTERS, SEGMENTS, SORTS, SOURCE_FILTERS, type ClientRow, type ClientsFilters, type ClientsStats, type CrmType, type Segment } from '../api';
import { CrmSheet } from '../components/crm-sheet';
import { ClientCard, Sheet } from '../components/ui';
import { shareSegmentsReport } from '../report';

export default function ClientsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canView = perms.isOwner || perms.can('orders', 'view');
  const canWrite = perms.isOwner || perms.can('messaging', 'send');

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ClientsFilters>({ search: '', segment: 'all', source: 'all', sortBy: 'totalSpent' });
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === search.trim() ? f : { ...f, search: search.trim() })), 350);
    return () => clearTimeout(t);
  }, [search]);
  const set = (patch: Partial<ClientsFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const [sorting, setSorting] = useState(false);
  const [crm, setCrm] = useState<CrmType | null>(null);
  const [reporting, setReporting] = useState(false);
  const [messaging, setMessaging] = useState<string | null>(null);
  const snack = useSnack();

  const q = useInfiniteQuery({
    queryKey: qk.company.clients(filters),
    queryFn: ({ pageParam }) => fetchClients(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: canView,
    placeholderData: keepPreviousData,
  });
  const list = q.data?.pages.flatMap((p) => p.data) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  const stats = q.data?.pages[0]?.stats;
  const filtered = !!filters.search || filters.segment !== 'all' || filters.source !== 'all';

  const message = async (c: ClientRow) => {
    if (messaging) return;
    setMessaging(c.id);
    try {
      const conv = await openConversationWith('client', c.id);
      router.push({ pathname: '/messages/[id]', params: { id: conv.id, name: conv.contactName ?? c.fullName, logo: conv.contactLogo ?? c.profilePicture ?? '', online: conv.contactOnline ? '1' : '0', userId: conv.contactUserId ?? c.userId } });
    } catch (e) {
      snack.show(toUserMessage(e), true);
    } finally {
      setMessaging(null);
    }
  };

  const report = async () => {
    setReporting(true);
    try {
      await shareSegmentsReport();
    } catch (e) {
      snack.show(toUserMessage(e) || 'Impossible de générer le rapport PDF.', true);
    } finally {
      setReporting(false);
    }
  };

  const header = (
    <View style={styles.header}>
      {stats ? <Kpis s={stats} /> : q.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
      {stats ? <Breakdown s={stats} active={filters.segment} onPick={(seg) => set({ segment: filters.segment === seg ? 'all' : seg })} /> : null}

      <View style={[styles.box, { borderColor: theme.border }]}>
        <View style={styles.boxHead}>
          <Ionicons name="flash-outline" size={17} color={Brand.primary} />
          <ThemedText style={styles.boxTitle}>Actions CRM</ThemedText>
        </View>
        {(Object.keys(CRM) as CrmType[]).map((k) => (
          <ActionRow key={k} icon={CRM[k].icon} title={CRM[k].title} text={CRM[k].text} onPress={() => setCrm(k)} />
        ))}
        <ActionRow icon="document-text-outline" title="Rapport segments PDF" text="Télécharger et partager la répartition" onPress={() => void report()} busy={reporting} />
      </View>

      <ThemedText style={styles.sectionTitle}>Base clients</ThemedText>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={17} color={theme.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Nom ou e-mail…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          accessibilityLabel="Rechercher un client"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer">
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <Chips options={SOURCE_FILTERS} value={filters.source} onChange={(source) => set({ source })} />
      <Chips options={SEGMENT_FILTERS} value={filters.segment} onChange={(segment) => set({ segment })} />
      <View style={styles.countRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {q.data ? plural(total, 'client') : ' '}
          {q.isFetching && !q.isFetchingNextPage && q.data ? ' · mise à jour…' : ''}
        </ThemedText>
        <Pressable onPress={() => setSorting(true)} accessibilityRole="button" accessibilityLabel="Trier" style={[styles.sortBtn, { borderColor: theme.border }]}>
          <Ionicons name="swap-vertical" size={15} color={theme.text} />
          <ThemedText type="smallBold">{SORTS.find((s) => s.value === filters.sortBy)?.label}</ThemedText>
        </Pressable>
      </View>
    </View>
  );

  let body: React.ReactNode;
  if (perms.loading) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.deniedTitle}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de consulter les clients. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else if (q.isError && !q.data) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <FlatList
        {...hideOnScroll}
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void qc.invalidateQueries({ queryKey: qk.company.clientsAll })} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={header}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
        ListEmptyComponent={
          q.isPending ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIco}>
                <Ionicons name={filters.search ? 'search' : 'people-outline'} size={28} color={Brand.primary} />
              </View>
              <ThemedText style={styles.emptyTitle}>{filters.search ? 'Aucun résultat' : filtered ? 'Aucun client ici' : 'Aucun client pour le moment'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {filters.search
                  ? 'Aucun client ne correspond à votre recherche.'
                  : filtered
                    ? 'Aucun client ne correspond à ces filtres.'
                    : 'Vos premiers clients apparaîtront ici dès leur première commande ou abonnement.'}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ClientCard
            c={item}
            onPress={() => router.push({ pathname: '/entreprise/clients/[id]', params: { id: item.id } })}
            onMessage={canWrite ? () => void message(item) : undefined}
            messaging={messaging === item.id}
          />
        )}
      />
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Clients & Abonnés" subtitle="Acheteurs + abonnés de votre boutique" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="clients" />
      <Snack msg={snack.msg} bottom={96} />
      {crm ? (
        <CrmSheet
          type={crm}
          canSend={canWrite}
          onClose={() => setCrm(null)}
          onSent={(m) => snack.show(m)}
        />
      ) : null}
      {sorting ? (
        <Sheet title="Trier les clients" icon="swap-vertical" onClose={() => setSorting(false)}>
          <View style={styles.sortList}>
            {SORTS.map((s) => {
              const on = s.value === filters.sortBy;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => {
                    set({ sortBy: s.value });
                    setSorting(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.sortRow, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                  <ThemedText style={[styles.flex, on && styles.bold]}>{s.label}</ThemedText>
                  {on ? <Ionicons name="checkmark" size={20} color={Brand.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

function Kpis({ s }: { s: ClientsStats }) {
  return (
    <View style={styles.kpis}>
      <Kpi icon="👥" value={String(s.total)} label="Total clients" sub={`${s.buyers} acheteurs · ${s.abonnes} abonnés`} />
      <Kpi icon="👑" value={String(s.vip)} label="Clients VIP" sub="≥ 10M GNF ou 10+ cmds" />
      <Kpi icon="💰" value={gnf(s.caTotal)} label="CA total clients" sub={`Panier moy. : ${gnf(s.panierMoyen)}`} />
      <Kpi icon="🆕" value={String(s.nouveaux)} label="Nouveaux acheteurs" sub="Première commande" />
    </View>
  );
}

function Kpi({ icon, value, label, sub }: { icon: string; value: string; label: string; sub: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.kpi, { borderColor: theme.border }]} accessible accessibilityLabel={`${label} : ${value}. ${sub}`}>
      <ThemedText style={styles.kpiIcon}>{icon}</ThemedText>
      <ThemedText style={styles.kpiV} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        {sub}
      </ThemedText>
    </View>
  );
}

/** Répartition par segment. « Abonnés » = abonnés qui n'ont jamais acheté (le
 *  total stats.abonnes compte aussi les acheteurs abonnés). */
function Breakdown({ s, active, onPick }: { s: ClientsStats; active: Segment | 'all'; onPick: (seg: Segment) => void }) {
  const theme = useTheme();
  const abonnesSeuls = Math.max(0, s.total - s.vip - s.fideles - s.reguliers - s.nouveaux);
  const rows: [Segment, number][] = [
    ['VIP', s.vip],
    ['Fidèle', s.fideles],
    ['Régulier', s.reguliers],
    ['Nouveau', s.nouveaux],
    ['Abonné', abonnesSeuls],
  ];
  return (
    <View style={[styles.box, { borderColor: theme.border }]}>
      <View style={styles.boxHead}>
        <Ionicons name="pie-chart-outline" size={17} color={Brand.primary} />
        <ThemedText style={styles.boxTitle}>Répartition</ThemedText>
      </View>
      {rows.map(([seg, n]) => {
        const m = SEGMENTS[seg];
        const pct = s.total > 0 ? Math.round((n / s.total) * 100) : 0;
        const on = active === seg;
        const name = PLURALS[seg];
        return (
          <Pressable
            key={seg}
            onPress={() => onPick(seg)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${name} : ${plural(n, 'client')}, ${pct} %. Filtrer`}
            style={[styles.bdRow, on && { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.bdTop}>
              <ThemedText type="smallBold" style={styles.flex}>
                {m.emoji} {name}
              </ThemedText>
              <ThemedText style={[styles.bdN, { color: m.color }]}>{n}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.bdPct}>
                {pct} %
              </ThemedText>
            </View>
            <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: m.color }]} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const PLURALS: Record<Segment, string> = { VIP: 'VIP', Fidèle: 'Fidèles', Régulier: 'Réguliers', Nouveau: 'Nouveaux', Abonné: 'Abonnés' };

function ActionRow({ icon, title, text, onPress, busy }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; text: string; onPress: () => void; busy?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.action, { borderTopColor: theme.border }, pressed && styles.pressed]}>
      <View style={[styles.actionIco, { backgroundColor: theme.backgroundElement }]}>
        {busy ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name={icon} size={18} color={Brand.primary} />}
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.actionTitle}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {text}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
            <ThemedText style={[styles.chipText, on && { color: Brand.primaryInk, fontWeight: '800' }]}>{o.label}</ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  pressed: { opacity: 0.85 },
  loader: { marginVertical: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  header: { gap: 12, marginBottom: 2 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 1 },
  kpiIcon: { fontSize: 18, lineHeight: 24 },
  kpiV: { fontSize: 21, lineHeight: 27, fontWeight: '900' },
  box: { borderWidth: 1, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  boxTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  bdRow: { borderRadius: 10, paddingVertical: 5, paddingHorizontal: 4, gap: 5 },
  bdTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bdN: { fontSize: 15, lineHeight: 19, fontWeight: '900' },
  bdPct: { width: 40, textAlign: 'right' },
  bar: { height: 7, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  actionIco: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sortList: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  sortRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 16 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: Brand.primarySoft },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
});

/**
 * Espace entreprise › Mes livreurs — version mobile de /dashboard/entreprise/livreurs
 * (LivreursPage.tsx), mêmes données et mêmes droits :
 *   · onglet Mon équipe : 4 chiffres (actifs, disponibles, en course, livraisons
 *     du jour), livreurs en attente à valider, recherche (nom, zone, e-mail),
 *     filtres disponibilité + statut avec compteurs, liste ; puis couverture par
 *     zone, activité récente et actions rapides (inviter, diffuser une mission,
 *     rapport de performances, carte, valider les en attente) ;
 *   · onglets Abonnements / Découvrir : livreurs de toute la plateforme
 *     (GET /suivis/livreurs), recherche serveur, S'abonner, « Charger plus ».
 * Toucher un livreur de l'équipe ouvre sa fiche (/entreprise/livreurs/[id]).
 * Droits : deliveries.view (voir), deliveries.assign (inviter, valider, missions),
 * deliveries.edit (message, suspendre, réactiver).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openDriver } from '@/features/catalog/open';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import {
  AVAIL, fetchNetwork, fetchRecent, fetchStats, fetchTeam, fetchZones, NETWORK_PAGE, normalize, toggleFollowDriver, validateDriver,
  type Availability, type Driver, type DriverStatus, type NetworkDriver,
} from '../api';
import { useDriverContact } from '../contact';
import { AvailBadge, DriverAvatar, NetworkRow, TeamRow } from '../components/driver-rows';
import { InviteSheet, MapSheet, MissionSheet, ReportSheet, ZoneBar } from '../components/sheets';

type Tab = 'equipe' | 'suivis' | 'decouvrir';
type NetPage = { data: NetworkDriver[]; total: number };

const AVAIL_FILTERS: { key: Availability | 'tous'; label: string }[] = [
  { key: 'tous', label: 'Tous' }, { key: 'available', label: 'Disponibles' }, { key: 'on_delivery', label: 'En course' }, { key: 'offline', label: 'Hors ligne' },
];
const STATUS_FILTERS: { key: DriverStatus | 'tous'; label: string }[] = [
  { key: 'tous', label: 'Tous statuts' }, { key: 'active', label: 'Actifs' }, { key: 'pending', label: 'En attente' }, { key: 'suspended', label: 'Suspendus' },
];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function CompanyDriversScreen() {
  const theme = useTheme();
  const perms = usePermissions();
  const canView = perms.can('deliveries', 'view');
  const [tab, setTab] = useState<Tab>('equipe');
  const snack = useSnack();

  let body: React.ReactNode;
  if (perms.loading) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.centerBox}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.deniedTitle}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de voir les livreurs. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else body = tab === 'equipe' ? <TeamTab onSnack={snack.show} /> : <NetworkTab followed={tab === 'suivis'} onSnack={snack.show} />;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Mes livreurs" subtitle="Votre équipe de livraison" />
      {canView ? (
        <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
          {([
            { key: 'equipe', label: 'Mon équipe', icon: 'people-outline' },
            { key: 'suivis', label: 'Abonnements', icon: 'heart-outline' },
            { key: 'decouvrir', label: 'Découvrir', icon: 'compass-outline' },
          ] as const).map((t) => {
            const on = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && styles.tabOn]}>
                <Ionicons name={t.icon} size={16} color={on ? Brand.primaryInk : theme.textSecondary} />
                <ThemedText style={[styles.tabText, { color: on ? Brand.primaryInk : theme.textSecondary }]}>{t.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="livreurs" />
      <Snack msg={snack.msg} bottom={96} />
    </SafeAreaView>
  );
}

/* ═══ Mon équipe ═══════════════════════════════════════════════════ */

function TeamTab({ onSnack }: { onSnack: (m: string, error?: boolean) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canAssign = perms.can('deliveries', 'assign');
  const canEdit = perms.can('deliveries', 'edit');
  const contact = useDriverContact();

  const team = useQuery({ queryKey: qk.companyDrivers.team, queryFn: fetchTeam, refetchInterval: 60_000 });
  const stats = useQuery({ queryKey: qk.companyDrivers.stats, queryFn: fetchStats, refetchInterval: 60_000 });
  const zones = useQuery({ queryKey: qk.companyDrivers.zones, queryFn: fetchZones });
  const recent = useQuery({ queryKey: qk.companyDrivers.recent, queryFn: fetchRecent, refetchInterval: 60_000 });

  const [search, setSearch] = useState('');
  const [avail, setAvail] = useState<Availability | 'tous'>('tous');
  const [status, setStatus] = useState<DriverStatus | 'tous'>('tous');
  const [sheet, setSheet] = useState<null | 'invite' | 'mission' | 'report' | 'map'>(null);

  const drivers = team.data?.data ?? [];
  const s = stats.data;
  const pending = drivers.filter((d) => d.status === 'pending');
  const term = normalize(search.trim());
  const list = drivers.filter((d) =>
    (!term || normalize(`${d.fullName} ${d.zone ?? ''} ${d.email}`).includes(term))
    && (avail === 'tous' || d.availability === avail)
    && (status === 'tous' || d.status === status));
  const countAvail = (k: Availability | 'tous') => (k === 'tous' ? drivers.length : drivers.filter((d) => d.availability === k).length);

  const refreshAll = () => void qc.invalidateQueries({ queryKey: qk.companyDrivers.all });

  const validateAll = useMutation({
    mutationFn: () => Promise.all(pending.map((d) => validateDriver(d.id))),
    onSuccess: () => { refreshAll(); onSnack(`${pending.length} livreur${pending.length > 1 ? 's' : ''} validé${pending.length > 1 ? 's' : ''}`); },
    onError: (e) => { refreshAll(); onSnack(toUserMessage(e), true); },
  });
  function confirmValidateAll() {
    if (!pending.length) { onSnack('Aucun livreur en attente de validation'); return; }
    Alert.alert(
      'Valider les livreurs en attente ?',
      `${pending.map((d) => d.fullName).slice(0, 6).join(', ')}${pending.length > 6 ? '…' : ''}\n\nIls pourront recevoir les courses de votre boutique.`,
      [{ text: 'Annuler', style: 'cancel' }, { text: `Valider (${pending.length})`, onPress: () => validateAll.mutate() }],
    );
  }

  const openDetail = (d: Driver) => router.push({ pathname: '/entreprise/livreurs/[id]', params: { id: d.id } });

  if (team.isError && !team.data) return <ErrorState error={team.error} onRetry={() => void team.refetch()} />;

  const quick = [
    ...(canAssign ? [{ icon: 'person-add-outline' as const, label: 'Inviter un livreur', onPress: () => setSheet('invite') }] : []),
    { icon: 'megaphone-outline' as const, label: 'Diffuser une mission', onPress: () => setSheet('mission') },
    { icon: 'stats-chart-outline' as const, label: 'Rapport de performances', onPress: () => setSheet('report') },
    { icon: 'map-outline' as const, label: 'Carte des livreurs', onPress: () => setSheet('map') },
    ...(canAssign ? [{ icon: 'checkmark-done-outline' as const, label: `Valider les en attente (${s?.enAttente ?? pending.length})`, onPress: confirmValidateAll }] : []),
  ];

  return (
    <>
      <FlatList
        data={team.isPending ? [] : list}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        {...hideOnScroll}
        refreshControl={<RefreshControl refreshing={team.isRefetching} onRefresh={refreshAll} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.kpis}>
              <Kpi icon="people" label="Actifs" value={s?.actifs} sub={`sur ${s?.total ?? 0} au total`} />
              <Kpi icon="checkmark-circle" label="Disponibles" value={s?.disponibles} sub="prêts à livrer" pulse={!!s?.disponibles} onPress={() => setAvail('available')} />
              <Kpi icon="bicycle" label="En course" value={s?.enCourse} sub="actuellement" onPress={() => setAvail('on_delivery')} />
              <Kpi icon="cube" label="Livraisons aujourd’hui" value={s?.livrAuj} sub={s?.enAttente ? `${s.enAttente} en attente` : 'cumulées'} />
            </View>

            {canAssign && pending.length ? (
              <Pressable onPress={confirmValidateAll} disabled={validateAll.isPending} accessibilityRole="button" style={[styles.pending, { borderColor: Brand.primaryLine, backgroundColor: Brand.primarySoft }]}>
                <Ionicons name="hourglass-outline" size={20} color={Brand.primaryInk} />
                <ThemedText type="small" style={[styles.flex, { color: Brand.primaryInk }]}>
                  {pending.length} livreur{pending.length > 1 ? 's' : ''} en attente de validation
                </ThemedText>
                {validateAll.isPending ? <ActivityIndicator size="small" color={Brand.primaryInk} /> : <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>Tout valider</ThemedText>}
              </Pressable>
            ) : null}

            {canAssign ? (
              <Pressable onPress={() => setSheet('invite')} accessibilityRole="button" style={[styles.invite, { backgroundColor: Brand.primary }]}>
                <Ionicons name="person-add" size={18} color="#fff" />
                <ThemedText type="smallBold" style={styles.inviteText}>Inviter un livreur</ThemedText>
              </Pressable>
            ) : null}

            <SearchBox value={search} onChange={setSearch} placeholder="Nom, zone ou e-mail" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {AVAIL_FILTERS.map((f) => <Chip key={f.key} label={f.label} count={countAvail(f.key)} on={avail === f.key} dot={f.key !== 'tous' ? AVAIL[f.key].color : undefined} onPress={() => setAvail(f.key)} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {STATUS_FILTERS.map((f) => (
                <Chip key={f.key} label={f.label} small on={status === f.key} onPress={() => setStatus(f.key)}
                  count={f.key === 'tous' ? undefined : drivers.filter((d) => d.status === f.key).length} />
              ))}
            </ScrollView>
            {list.length && !team.isPending ? (
              <ThemedText type="small" themeColor="textSecondary">
                {list.length} livreur{list.length > 1 ? 's' : ''}{avail !== 'tous' ? ` · ${AVAIL[avail].label.toLowerCase()}` : ''}
              </ThemedText>
            ) : null}
            {team.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
          </View>
        }
        ListEmptyComponent={team.isPending ? null : (
          <View style={styles.empty}>
            <ThemedText style={styles.emptyEmoji}>🛵</ThemedText>
            <ThemedText style={styles.emptyTitle}>{drivers.length ? 'Aucun livreur ici' : 'Aucun livreur dans votre équipe'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {drivers.length ? 'Aucun livreur ne correspond à ces filtres.' : 'Invitez vos livreurs par e-mail : ils rejoindront votre équipe avec leur code.'}
            </ThemedText>
            {drivers.length ? (
              <Pressable onPress={() => { setSearch(''); setAvail('tous'); setStatus('tous'); }} accessibilityRole="button"><ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>Effacer les filtres</ThemedText></Pressable>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <TeamRow d={item} canContact={canEdit} busy={contact.busy} onPress={() => openDetail(item)}
            onMessage={() => void contact.message(item.id)} onCall={() => void contact.call(item.id, item.fullName)} />
        )}
        ListFooterComponent={
          <View style={styles.side}>
            <Panel icon="map-outline" title="Couverture par zone">
              {zones.isPending ? <ActivityIndicator color={Brand.primary} /> : zones.data?.length ? zones.data.map((z) => <ZoneBar key={z.zone} z={z} />) : (
                <ThemedText type="small" themeColor="textSecondary">Aucune zone pour le moment.</ThemedText>
              )}
            </Panel>
            <Panel icon="time-outline" title="Activité récente">
              {recent.isPending ? <ActivityIndicator color={Brand.primary} /> : recent.data?.length ? recent.data.map((d, i) => (
                <Pressable key={d.id} onPress={() => openDetail(d)} accessibilityRole="button" style={[styles.act, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                  <DriverAvatar emoji={d.avatarEmoji} photo={d.photo} availability={d.availability} size={36} />
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1} style={styles.actName}>{d.fullName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {d.lastActivityAt ? `${d.lastActivity} · ${d.lastActivityAt}` : `${d.todayDeliveries} livraison${d.todayDeliveries > 1 ? 's' : ''} aujourd’hui`}
                    </ThemedText>
                  </View>
                  <AvailBadge a={d.availability} />
                </Pressable>
              )) : <ThemedText type="small" themeColor="textSecondary">Aucune activité récente.</ThemedText>}
            </Panel>
            <Panel icon="flash-outline" title="Actions rapides">
              {quick.map((a, i) => (
                <Pressable key={a.label} onPress={a.onPress} accessibilityRole="button" style={({ pressed }) => [styles.quick, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
                  <View style={[styles.quickIco, { backgroundColor: Brand.primarySoft }]}><Ionicons name={a.icon} size={18} color={Brand.primaryInk} /></View>
                  <ThemedText style={styles.flex}>{a.label}</ThemedText>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </Pressable>
              ))}
            </Panel>
          </View>
        }
      />

      {sheet === 'invite' ? <InviteSheet onClose={() => setSheet(null)} onDone={refreshAll} /> : null}
      {sheet === 'mission' ? <MissionSheet canAssign={canAssign} onClose={() => setSheet(null)} onDone={onSnack} /> : null}
      {sheet === 'report' ? <ReportSheet drivers={drivers} stats={s} zones={zones.data ?? []} onClose={() => setSheet(null)} /> : null}
      {sheet === 'map' ? <MapSheet drivers={drivers} onClose={() => setSheet(null)} onOpen={(d) => { setSheet(null); openDetail(d); }} /> : null}
    </>
  );
}

/* ═══ Abonnements / Découvrir ═════════════════════════════════════ */

function NetworkTab({ followed, onSnack }: { followed: boolean; onSnack: (m: string, error?: boolean) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 350);
  const key = qk.companyDrivers.network(term);

  const q = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => fetchNetwork(pageParam, term, signal),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (all.reduce((n, p) => n + p.data.length, 0) < last.total && last.data.length === NETWORK_PAGE ? all.length + 1 : undefined),
  });

  const follow = useMutation({
    mutationFn: (id: string) => toggleFollowDriver(id),
    onMutate: (id) => {
      const prev = qc.getQueryData<InfiniteData<NetPage, number>>(key);
      qc.setQueryData<InfiniteData<NetPage, number>>(key, (old) => old && { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map((d) => (d.id === id ? { ...d, isSuivi: !d.isSuivi } : d)) })) });
      return { prev };
    },
    onSuccess: (r, id) => {
      const d = q.data?.pages.flatMap((p) => p.data).find((x) => x.id === id);
      onSnack(r.isSuivi ? `Vous suivez ${d?.fullName ?? 'ce livreur'}` : `Vous ne suivez plus ${d?.fullName ?? 'ce livreur'}`);
      /* Le suivi débloque Message / Appel dans l'onglet « Mon équipe ». */
      void qc.invalidateQueries({ queryKey: qk.companyDrivers.team });
      void qc.invalidateQueries({ queryKey: qk.follows.all });
    },
    onError: (e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); onSnack(toUserMessage(e), true); },
  });

  const all = q.data?.pages.flatMap((p) => p.data) ?? [];
  const list = all.filter((d) => d.isSuivi === followed);

  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  return (
    <FlatList
      data={list}
      keyExtractor={(d) => d.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      {...hideOnScroll}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      ListHeaderComponent={
        <View style={styles.header}>
          <SearchBox value={search} onChange={setSearch} placeholder="Rechercher un livreur (nom, zone)" />
          {list.length ? <ThemedText type="small" themeColor="textSecondary">{list.length} livreur{list.length > 1 ? 's' : ''}</ThemedText> : null}
          {q.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
        </View>
      }
      ListEmptyComponent={q.isPending ? null : (
        <View style={styles.empty}>
          <ThemedText style={styles.emptyEmoji}>🛵</ThemedText>
          <ThemedText style={styles.emptyTitle}>{followed ? 'Aucun abonnement' : 'Aucun livreur à découvrir'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {term ? `Aucun résultat pour « ${term} ».` : followed
              ? 'Abonnez-vous à des livreurs depuis l’onglet Découvrir : vous pourrez leur écrire et les appeler.'
              : 'Tous les livreurs trouvés sont déjà dans vos abonnements.'}
          </ThemedText>
        </View>
      )}
      renderItem={({ item }) => (
        <NetworkRow d={item} pending={follow.isPending && follow.variables === item.id} onToggle={() => follow.mutate(item.id)} onPress={() => openDriver(item.id)} />
      )}
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : q.hasNextPage ? (
        <Pressable onPress={() => void q.fetchNextPage()} accessibilityRole="button" style={styles.more}><ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>Charger plus</ThemedText></Pressable>
      ) : null}
    />
  );
}

/* ═══ Petits éléments ══════════════════════════════════════════════ */

function Kpi({ icon, label, value, sub, pulse, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: number | undefined; sub: string; pulse?: boolean; onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${label} : ${value ?? '…'}`}
      style={[styles.kpi, { borderColor: theme.border }]}>
      <View style={[styles.kpiIco, { backgroundColor: Brand.primarySoft }]}><Ionicons name={icon} size={16} color={Brand.primaryInk} /></View>
      {pulse ? <View style={styles.pulse} /> : null}
      <ThemedText style={styles.kpiV}>{value ?? '…'}</ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{sub}</ThemedText>
    </Pressable>
  );
}

function Chip({ label, count, on, dot, small, onPress }: { label: string; count?: number; on: boolean; dot?: string; small?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }}
      style={[styles.chip, small && styles.chipSmall, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
      {dot ? <View style={[styles.chipDot, { backgroundColor: dot }]} /> : null}
      <ThemedText style={[styles.chipText, on && { color: Brand.primaryInk }]}>{label}</ThemedText>
      {count != null ? (
        <View style={[styles.chipCount, { backgroundColor: on ? '#fff' : theme.backgroundElement }]}>
          <ThemedText style={[styles.chipCountText, on && { color: Brand.primaryInk }]}>{count}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="search" size={17} color={theme.textSecondary} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }]} accessibilityLabel={placeholder} returnKeyType="search" autoCorrect={false} />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer"><Ionicons name="close-circle" size={18} color={theme.textSecondary} /></Pressable>
      ) : null}
    </View>
  );
}

function Panel({ icon, title, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { borderColor: theme.border }]}>
      <View style={styles.panelHead}>
        <Ionicons name={icon} size={17} color={Brand.primaryInk} />
        <ThemedText style={styles.panelTitle}>{title}</ThemedText>
      </View>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 20 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 999, paddingVertical: 9 },
  tabOn: { backgroundColor: Brand.primarySoft },
  tabText: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  content: { padding: 16, gap: 10, paddingBottom: 110 },
  header: { gap: 12, marginBottom: 2 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 1 },
  kpiIco: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kpiV: { fontSize: 24, lineHeight: 30, fontWeight: '900' },
  pulse: { position: 'absolute', top: 12, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: Brand.success },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  invite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, minHeight: 48 },
  inviteText: { color: '#fff', fontSize: 15 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingLeft: 12, paddingRight: 6, paddingVertical: 5 },
  chipSmall: { paddingRight: 10, paddingVertical: 4 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  chipCountText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 40, lineHeight: 48 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  side: { gap: 12, marginTop: 10 },
  panel: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  panelTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  panelBody: { padding: 14, gap: 10 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  actName: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  quickIco: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  more: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20 },
});

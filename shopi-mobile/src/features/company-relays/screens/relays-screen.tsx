/**
 * Espace entreprise › Mes correspondants — version mobile de
 * /dashboard/entreprise/correspondants (CorrespondantsPage.tsx), mêmes données :
 *   · onglet Mon équipe : 4 chiffres (actifs, commandes du mois, villes
 *     couvertes, en attente), correspondants à valider, recherche (nom, ville,
 *     e-mail), filtres par type (principal, point relais, entrepôt, export) et
 *     statut avec compteurs, liste ; puis couverture par zone, activité récente
 *     et actions rapides (inviter, circulaire, rapport du réseau, carte, valider) ;
 *   · onglets Abonnements / Découvrir : correspondants de toute la plateforme
 *     (GET /suivis/correspondants), recherche, S'abonner.
 * Toucher un correspondant de l'équipe ouvre sa fiche (/entreprise/correspondants/[id]).
 * Droits (contrôlés par le serveur) : deliveries.view pour voir,
 * deliveries.edit pour inviter, valider, écrire, suspendre, réactiver.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openRelay } from '@/features/catalog/open';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { InviteSheet, useActorContact, ZoneBar } from '@/features/company-drivers/components';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import {
  fetchNetwork, fetchRecent, fetchStats, fetchTeam, fetchZones, inviteRelay, normalize, place, STATUS, toggleFollowRelay, TYPE, validateRelay,
  type NetworkRelay, type Relay, type RelayStatus, type RelayType,
} from '../api';
import { NetworkRelayRow, RelayAvatar, TeamRelayRow, TypeBadge } from '../components/relay-rows';
import { CircularSheet, NetworkReport, RelayMapSheet } from '../components/relay-sheets';

type Tab = 'equipe' | 'suivis' | 'decouvrir';

const TYPE_FILTERS: (RelayType | 'tous')[] = ['tous', 'principal', 'relais', 'entrepot', 'export'];
const STATUS_FILTERS: { key: RelayStatus | 'tous'; label: string }[] = [
  { key: 'tous', label: 'Tous statuts' }, { key: 'active', label: 'Actifs' }, { key: 'pending', label: 'En attente' }, { key: 'suspended', label: 'Suspendus' },
];
const INVITE_MESSAGE = 'Bonjour,\n\nNous vous invitons à rejoindre le réseau de correspondants de notre boutique sur Shoneya : points relais, dépôts et export. Créez votre compte correspondant avec le code ci-dessous pour recevoir nos colis.';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function CompanyRelaysScreen() {
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
          Votre rôle dans l’équipe ne permet pas de voir les correspondants. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else body = tab === 'equipe' ? <TeamTab onSnack={snack.show} /> : <NetworkTab followed={tab === 'suivis'} onSnack={snack.show} />;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Mes correspondants" subtitle="Points relais, entrepôts et export" />
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
      <CompanyBottomNav active="correspondants" />
      <Snack msg={snack.msg} bottom={96} />
    </SafeAreaView>
  );
}

/* ═══ Mon équipe ═══════════════════════════════════════════════════ */

function TeamTab({ onSnack }: { onSnack: (m: string, error?: boolean) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.can('deliveries', 'edit');
  const contact = useActorContact('correspondent');

  const team = useQuery({ queryKey: qk.companyRelays.team, queryFn: fetchTeam, refetchInterval: 60_000 });
  const stats = useQuery({ queryKey: qk.companyRelays.stats, queryFn: fetchStats, refetchInterval: 60_000 });
  const zones = useQuery({ queryKey: qk.companyRelays.zones, queryFn: fetchZones });
  const recent = useQuery({ queryKey: qk.companyRelays.recent, queryFn: fetchRecent, refetchInterval: 60_000 });

  const [search, setSearch] = useState('');
  const [type, setType] = useState<RelayType | 'tous'>('tous');
  const [status, setStatus] = useState<RelayStatus | 'tous'>('tous');
  const [sheet, setSheet] = useState<null | 'invite' | 'circular' | 'report' | 'map'>(null);

  const relays = team.data?.data ?? [];
  const s = stats.data;
  const pending = relays.filter((r) => r.status === 'pending');
  const term = normalize(search.trim());
  const list = relays.filter((r) =>
    (!term || normalize(`${r.fullName} ${r.ville} ${r.quartier} ${r.email}`).includes(term))
    && (type === 'tous' || r.type === type)
    && (status === 'tous' || r.status === status));

  const refreshAll = () => void qc.invalidateQueries({ queryKey: qk.companyRelays.all });

  const validateAll = useMutation({
    mutationFn: () => Promise.all(pending.map((r) => validateRelay(r.id))),
    onSuccess: () => { refreshAll(); onSnack(`${pending.length} correspondant${pending.length > 1 ? 's' : ''} validé${pending.length > 1 ? 's' : ''}`); },
    onError: (e) => { refreshAll(); onSnack(toUserMessage(e), true); },
  });
  function confirmValidateAll() {
    if (!pending.length) { onSnack('Aucun correspondant en attente de validation'); return; }
    Alert.alert(
      'Valider les correspondants en attente ?',
      `${pending.map((r) => r.fullName).slice(0, 6).join(', ')}${pending.length > 6 ? '…' : ''}\n\nIls pourront recevoir les colis de votre boutique.`,
      [{ text: 'Annuler', style: 'cancel' }, { text: `Valider (${pending.length})`, onPress: () => validateAll.mutate() }],
    );
  }

  const openDetail = (r: Relay) => router.push({ pathname: '/entreprise/correspondants/[id]', params: { id: r.id } });

  if (team.isError && !team.data) return <ErrorState error={team.error} onRetry={() => void team.refetch()} />;

  const quick = [
    ...(canEdit ? [
      { icon: 'person-add-outline' as const, label: 'Inviter un correspondant', onPress: () => setSheet('invite') },
      { icon: 'mail-outline' as const, label: 'Envoyer une circulaire', onPress: () => setSheet('circular') },
    ] : []),
    { icon: 'stats-chart-outline' as const, label: 'Rapport du réseau', onPress: () => setSheet('report') },
    { icon: 'map-outline' as const, label: 'Voir la carte du réseau', onPress: () => setSheet('map') },
    ...(canEdit ? [{ icon: 'checkmark-done-outline' as const, label: `Valider les en attente (${s?.enAttente ?? pending.length})`, onPress: confirmValidateAll }] : []),
  ];

  return (
    <>
      <FlatList
        data={team.isPending ? [] : list}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        {...hideOnScroll}
        refreshControl={<RefreshControl refreshing={team.isRefetching} onRefresh={refreshAll} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.kpis}>
              <Kpi icon="git-network" label="Actifs" value={s?.actifs} sub={`sur ${s?.total ?? 0} au total`} onPress={() => setStatus('active')} />
              <Kpi icon="cube" label="Commandes ce mois" value={s?.thisMonth} sub="traitées par le réseau" />
              <Kpi icon="business" label="Villes couvertes" value={s?.villes} sub="dans votre réseau" />
              <Kpi icon="time" label="En attente" value={s?.enAttente} sub="validation requise" pulse={!!s?.enAttente} onPress={() => setStatus('pending')} />
            </View>

            {canEdit && pending.length ? (
              <Pressable onPress={confirmValidateAll} disabled={validateAll.isPending} accessibilityRole="button" style={[styles.pending, { borderColor: Brand.primaryLine, backgroundColor: Brand.primarySoft }]}>
                <Ionicons name="hourglass-outline" size={20} color={Brand.primaryInk} />
                <ThemedText type="small" style={[styles.flex, { color: Brand.primaryInk }]}>
                  {pending.length} correspondant{pending.length > 1 ? 's' : ''} en attente de validation
                </ThemedText>
                {validateAll.isPending ? <ActivityIndicator size="small" color={Brand.primaryInk} /> : <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>Tout valider</ThemedText>}
              </Pressable>
            ) : null}

            {canEdit ? (
              <Pressable onPress={() => setSheet('invite')} accessibilityRole="button" style={[styles.invite, { backgroundColor: Brand.primary }]}>
                <Ionicons name="person-add" size={18} color="#fff" />
                <ThemedText type="smallBold" style={styles.inviteText}>Inviter un correspondant</ThemedText>
              </Pressable>
            ) : null}

            <SearchBox value={search} onChange={setSearch} placeholder="Nom, ville, quartier ou e-mail" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {TYPE_FILTERS.map((f) => (
                <Chip key={f} label={f === 'tous' ? 'Tous' : TYPE[f].label} on={type === f} onPress={() => setType(f)}
                  count={f === 'tous' ? relays.length : relays.filter((r) => r.type === f).length} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {STATUS_FILTERS.map((f) => (
                <Chip key={f.key} label={f.label} small on={status === f.key} onPress={() => setStatus(f.key)}
                  count={f.key === 'tous' ? undefined : relays.filter((r) => r.status === f.key).length} />
              ))}
            </ScrollView>
            {list.length && !team.isPending ? (
              <ThemedText type="small" themeColor="textSecondary">
                {list.length} correspondant{list.length > 1 ? 's' : ''}{type !== 'tous' ? ` · ${TYPE[type].label.toLowerCase()}` : ''}
              </ThemedText>
            ) : null}
            {team.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
          </View>
        }
        ListEmptyComponent={team.isPending ? null : (
          <View style={styles.empty}>
            <ThemedText style={styles.emptyEmoji}>🗺️</ThemedText>
            <ThemedText style={styles.emptyTitle}>{relays.length ? 'Aucun correspondant ici' : 'Aucun correspondant dans votre réseau'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {relays.length ? 'Aucun correspondant ne correspond à ces filtres.' : 'Invitez vos points relais, entrepôts et partenaires export par e-mail : ils rejoindront votre réseau avec leur code.'}
            </ThemedText>
            {relays.length ? (
              <Pressable onPress={() => { setSearch(''); setType('tous'); setStatus('tous'); }} accessibilityRole="button"><ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>Effacer les filtres</ThemedText></Pressable>
            ) : canEdit ? (
              <Pressable onPress={() => setSheet('invite')} accessibilityRole="button"><ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>Inviter un correspondant</ThemedText></Pressable>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <TeamRelayRow r={item} busy={contact.busy} onPress={() => openDetail(item)}
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
              {recent.isPending ? <ActivityIndicator color={Brand.primary} /> : recent.data?.length ? recent.data.map((r, i) => (
                <Pressable key={r.id} onPress={() => openDetail(r)} accessibilityRole="button" style={[styles.act, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                  <RelayAvatar emoji={r.avatarEmoji} status={r.status} size={36} />
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1} style={styles.actName}>{r.fullName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {r.lastActivityAt ? `${r.lastActivity} · ${r.lastActivityAt}` : `${place(r)} · ${STATUS[r.status]}`}
                    </ThemedText>
                  </View>
                  <TypeBadge t={r.type} />
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

      {sheet === 'invite' ? (
        <InviteSheet onClose={() => setSheet(null)} onDone={refreshAll} invite={inviteRelay} title="Inviter un correspondant" message={INVITE_MESSAGE}
          who="Il renseignera lui-même son nom, son type (point relais, entrepôt, export), sa ville et son quartier à l’inscription." />
      ) : null}
      {sheet === 'circular' ? <CircularSheet team={relays} onClose={() => setSheet(null)} onDone={onSnack} /> : null}
      {sheet === 'report' ? <NetworkReport team={relays} stats={s} zones={zones.data ?? []} onClose={() => setSheet(null)} /> : null}
      {sheet === 'map' ? <RelayMapSheet team={relays} onClose={() => setSheet(null)} onOpen={(r) => { setSheet(null); openDetail(r); }} /> : null}
    </>
  );
}

/* ═══ Abonnements / Découvrir ═════════════════════════════════════ */

function NetworkTab({ followed, onSnack }: { followed: boolean; onSnack: (m: string, error?: boolean) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 350);
  const key = qk.companyRelays.network(term);
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchNetwork(term, signal) });

  const follow = useMutation({
    mutationFn: (id: string) => toggleFollowRelay(id),
    onMutate: (id) => {
      const prev = qc.getQueryData<NetworkRelay[]>(key);
      qc.setQueryData<NetworkRelay[]>(key, (old) => old?.map((r) => (r.id === id ? { ...r, isSuivi: !r.isSuivi } : r)));
      return { prev };
    },
    onSuccess: (res, id) => {
      const r = q.data?.find((x) => x.id === id);
      onSnack(res.isSuivi ? `Vous suivez ${r?.fullName ?? 'ce correspondant'}` : `Vous ne suivez plus ${r?.fullName ?? 'ce correspondant'}`);
      /* Le suivi débloque Message / Appel dans l'onglet « Mon équipe ». */
      void qc.invalidateQueries({ queryKey: qk.companyRelays.team });
      void qc.invalidateQueries({ queryKey: qk.follows.all });
    },
    onError: (e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); onSnack(toUserMessage(e), true); },
  });

  const list = (q.data ?? []).filter((r) => r.isSuivi === followed);
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  return (
    <FlatList
      data={list}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      {...hideOnScroll}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <SearchBox value={search} onChange={setSearch} placeholder="Rechercher un correspondant (nom, lieu)" />
          {list.length ? <ThemedText type="small" themeColor="textSecondary">{list.length} correspondant{list.length > 1 ? 's' : ''}</ThemedText> : null}
          {q.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
        </View>
      }
      ListEmptyComponent={q.isPending ? null : (
        <View style={styles.empty}>
          <ThemedText style={styles.emptyEmoji}>🗺️</ThemedText>
          <ThemedText style={styles.emptyTitle}>{followed ? 'Aucun abonnement' : 'Aucun correspondant à découvrir'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {term ? `Aucun résultat pour « ${term} ».` : followed
              ? 'Abonnez-vous à des correspondants depuis l’onglet Découvrir : vous pourrez leur écrire et les appeler.'
              : 'Tous les correspondants trouvés sont déjà dans vos abonnements.'}
          </ThemedText>
        </View>
      )}
      renderItem={({ item }) => (
        <NetworkRelayRow r={item} pending={follow.isPending && follow.variables === item.id} onToggle={() => follow.mutate(item.id)} onPress={() => openRelay(item.id)} />
      )}
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

function Chip({ label, count, on, small, onPress }: { label: string; count?: number; on: boolean; small?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }}
      style={[styles.chip, small && styles.chipSmall, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
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
  pulse: { position: 'absolute', top: 12, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: Brand.primary },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  invite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, minHeight: 48 },
  inviteText: { color: '#fff', fontSize: 15 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingLeft: 12, paddingRight: 6, paddingVertical: 5 },
  chipSmall: { paddingRight: 10, paddingVertical: 4 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  chipCountText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 40, lineHeight: 48 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  side: { gap: 12, marginTop: 10 },
  panel: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  panelTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  panelBody: { padding: 14, gap: 10 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  actName: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  quickIco: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

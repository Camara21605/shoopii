/**
 * Espace entreprise › Gestion de l'équipe — équivalent mobile de
 * /dashboard/entreprise/equipe (EquipePage.tsx) :
 *   · statistiques : membres actifs, places utilisées / limite du plan (barre),
 *     suspendus, places restantes, plan actif ;
 *   · onglet Membres : recherche (nom, email, poste), une carte par membre
 *     (statut, poste, rôle, dernière connexion, MDP à changer, motif de
 *     suspension), chargement par pages de 20 en faisant défiler ;
 *   · onglet Invitations : en attente, renvoyer / annuler ;
 *   · ajouter un membre (création directe → MDP temporaire, ou lien d'invitation) ;
 *   · par membre : permissions (enregistrées case par case, modèles), journal
 *     d'activité, réinitialiser le MDP, suspendre (motif) / réactiver, supprimer.
 *
 * Accès : propriétaire, ou collaborateur avec team.view. Les actions et les
 * invitations sont réservées au propriétaire (TeamOwnerGuard côté serveur) :
 * un collaborateur consulte la liste et le journal, sans boutons inutiles.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { useCompanyIdentity, usePermissions } from '@/features/company/hooks';
import { SITE } from '@/features/company/nav';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import {
  cancelInvitation,
  countGranted,
  deleteMember,
  fetchInvitations,
  fetchMembers,
  fetchPlan,
  fetchStats,
  formatDate,
  fullName,
  permissionGroups,
  reactivateMember,
  resendInvitation,
  resetPassword,
  suspendMember,
  type Invitation,
  type TeamMember,
} from '../api';
import { MemberCard } from '../components/member-card';
import { ActivitySheet, AddMemberSheet, ConfirmSheet, MemberSheet, PermissionsSheet, SecretSheet, type Created } from '../components/sheets';
import { Avatar, Snack, useSnack } from '../components/ui';

type Confirm = { title: string; message: string; confirmLabel?: string; withReason?: boolean; run: (reason?: string) => Promise<void> };

export default function TeamScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const identity = useCompanyIdentity();
  const isOwner = perms.isOwner;
  const canView = isOwner || perms.can('team', 'view');
  const groups = useMemo(() => permissionGroups(identity.data?.businessModel ?? 'products'), [identity.data?.businessModel]);

  const [tab, setTab] = useState<'members' | 'invitations'>('members');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [permTarget, setPermTarget] = useState<TeamMember | null>(null);
  const [activityTarget, setActivityTarget] = useState<TeamMember | null>(null);
  const [adding, setAdding] = useState<'direct' | 'invite' | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const snack = useSnack();

  const stats = useQuery({ queryKey: qk.company.teamStats, queryFn: fetchStats, enabled: canView });
  const plan = useQuery({ queryKey: qk.company.teamPlan, queryFn: fetchPlan, enabled: canView, staleTime: 10 * 60_000 });
  const invitations = useQuery({ queryKey: qk.company.teamInvitations, queryFn: fetchInvitations, enabled: canView && isOwner });
  const members = useInfiniteQuery({
    queryKey: qk.company.teamMembers(term),
    queryFn: ({ pageParam }) => fetchMembers(pageParam, term),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: canView,
    /* Pendant une nouvelle recherche, la liste précédente reste affichée (pas de clignotement). */
    placeholderData: keepPreviousData,
  });
  const list = members.data?.pages.flatMap((p) => p.items) ?? [];
  const total = members.data?.pages[0]?.total ?? 0;
  const pending = invitations.data ?? [];

  const refreshAll = () => void qc.invalidateQueries({ queryKey: qk.company.team });

  /* ── Actions membres ── */
  const closeAll = () => setSelected(null);

  const onResetPassword = async (m: TeamMember) => {
    setBusy('reset');
    try {
      const res = await resetPassword(m.id);
      closeAll();
      setCreated({ name: fullName(m), email: m.email, kind: 'password', secret: res.temporaryPassword });
      refreshAll();
    } catch (e) {
      snack.show(toUserMessage(e) || 'Erreur lors de la réinitialisation.', true);
    } finally {
      setBusy(null);
    }
  };

  const onReactivate = async (m: TeamMember) => {
    setBusy('reactivate');
    try {
      await reactivateMember(m.id);
      closeAll();
      snack.show(`${m.firstName} a été réactivé(e).`);
      refreshAll();
    } catch (e) {
      snack.show(toUserMessage(e) || 'Erreur lors de la réactivation.', true);
    } finally {
      setBusy(null);
    }
  };

  const askSuspend = (m: TeamMember) => {
    closeAll();
    setConfirm({
      title: `Suspendre ${fullName(m)}`,
      message: `${m.firstName} ne pourra plus se connecter. Vous pouvez réactiver son accès à tout moment.`,
      confirmLabel: 'Suspendre',
      withReason: true,
      run: async (reason) => {
        await suspendMember(m.id, reason);
        snack.show(`${m.firstName} a été suspendu(e).`);
        refreshAll();
      },
    });
  };

  const askDelete = (m: TeamMember) => {
    closeAll();
    setConfirm({
      title: `Supprimer l’accès de ${fullName(m)}`,
      message: `L’accès de ${m.firstName} sera définitivement révoqué. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      run: async () => {
        await deleteMember(m.id);
        snack.show(`Accès de ${m.firstName} révoqué.`);
        refreshAll();
      },
    });
  };

  /* ── Actions invitations ── */
  const onResend = async (inv: Invitation) => {
    setResending(inv.id);
    try {
      await resendInvitation(inv.id);
      snack.show('Invitation renvoyée.');
      void qc.invalidateQueries({ queryKey: qk.company.teamInvitations });
    } catch (e) {
      snack.show(toUserMessage(e) || 'Erreur.', true);
    } finally {
      setResending(null);
    }
  };

  const askCancel = (inv: Invitation) =>
    setConfirm({
      title: `Annuler l’invitation pour ${inv.email}`,
      message: `L’invitation envoyée à ${inv.email} sera annulée. Le lien ne sera plus valide.`,
      confirmLabel: 'Annuler l’invitation',
      run: async () => {
        await cancelInvitation(inv.id);
        snack.show('Invitation annulée.');
        void qc.invalidateQueries({ queryKey: qk.company.teamInvitations });
      },
    });

  /* ── Rendu ── */
  const s = stats.data;
  const unlimited = s ? s.maxAllowed == null : false;
  const fill = s ? (unlimited ? 0.1 : s.maxAllowed ? Math.min(1, s.activeCount / s.maxAllowed) : 1) : 0;
  const canAdd = isOwner && !!s?.canAddMore;
  const limitReached = isOwner && !!s && !s.canAddMore;

  const header = (
    <View style={styles.header}>
      {s ? (
        <>
          <View style={[styles.slots, { borderColor: theme.border }]}>
            <View style={styles.slotsTop}>
              <View style={styles.flex}>
                <ThemedText type="small" themeColor="textSecondary">
                  Places utilisées
                </ThemedText>
                <ThemedText style={styles.slotsV}>
                  {s.activeCount}
                  <ThemedText style={styles.slotsMax}>/{unlimited ? '∞' : s.maxAllowed}</ThemedText>
                </ThemedText>
              </View>
              {plan.data ? (
                <View style={styles.plan}>
                  <Ionicons name="ribbon-outline" size={14} color={Brand.primaryInk} />
                  <ThemedText style={styles.planText}>{plan.data.name}</ThemedText>
                </View>
              ) : null}
            </View>
            <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fill * 100) }}>
              <View style={[styles.barFill, { width: `${fill * 100}%`, backgroundColor: limitReached ? Brand.danger : Brand.primary }]} />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Plan actif · {unlimited ? 'membres illimités' : `${s.remainingSlots ?? 0} place${(s.remainingSlots ?? 0) > 1 ? 's' : ''} restante${(s.remainingSlots ?? 0) > 1 ? 's' : ''}`}
            </ThemedText>
          </View>
          <View style={styles.stats}>
            <Stat label="Membres actifs" value={s.activeCount} color={Brand.success} />
            <Stat label="Suspendus" value={s.suspendedCount} color="#B45309" />
            <Stat label="Places restantes" value={unlimited ? '∞' : (s.remainingSlots ?? 0)} color={Brand.primaryInk} />
          </View>
        </>
      ) : stats.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : null}

      {canAdd ? (
        <Pressable onPress={() => setAdding('direct')} accessibilityRole="button" style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Ionicons name="person-add-outline" size={19} color={Brand.primaryInk} />
          <ThemedText style={styles.addText}>Ajouter un membre</ThemedText>
        </Pressable>
      ) : limitReached ? (
        <View style={[styles.limit, { backgroundColor: '#FEF3E2' }]}>
          <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
          <ThemedText type="small" style={styles.limitText}>
            Limite de {s?.maxAllowed} membres actifs atteinte{plan.data ? ` pour le plan ${plan.data.name}` : ''}. Suspendez ou supprimez un accès, ou passez à un plan supérieur pour ajouter quelqu’un.
          </ThemedText>
        </View>
      ) : null}

      {isOwner ? (
        <View style={[styles.tabs, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
          <TabBtn on={tab === 'members'} icon="people-outline" label="Membres" count={s?.activeCount} onPress={() => setTab('members')} />
          <TabBtn on={tab === 'invitations'} icon="mail-open-outline" label="Invitations" count={pending.length} warn onPress={() => setTab('invitations')} />
        </View>
      ) : null}

      {tab === 'members' ? (
        <>
          <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="search" size={17} color={theme.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher par nom, email, poste…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              accessibilityLabel="Rechercher un membre"
              returnKeyType="search"
              autoCorrect={false}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer">
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          {members.data ? (
            <ThemedText type="small" themeColor="textSecondary">
              {total} membre{total > 1 ? 's' : ''}
              {members.isFetching && !members.isFetchingNextPage ? ' · mise à jour…' : ''}
            </ThemedText>
          ) : null}
        </>
      ) : (
        <View style={styles.invHead}>
          <ThemedText style={styles.invTitle}>Invitations en attente</ThemedText>
          {canAdd ? (
            <Pressable onPress={() => setAdding('invite')} accessibilityRole="button" style={styles.invSend}>
              <Ionicons name="mail-outline" size={15} color={Brand.primaryInk} />
              <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>
                Inviter
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
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
          Votre rôle dans l’équipe ne permet pas de consulter les collaborateurs. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else if (tab === 'members' && members.isError && !members.data) body = <ErrorState error={members.error} onRetry={() => void members.refetch()} />;
  else if (tab === 'members')
    body = (
      <FlatList
        {...hideOnScroll}
        data={list}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={members.isRefetching && !members.isFetchingNextPage} onRefresh={refreshAll} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={header}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (members.hasNextPage && !members.isFetchingNextPage) void members.fetchNextPage();
        }}
        ListFooterComponent={members.isFetchingNextPage ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
        ListEmptyComponent={
          members.isPending ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : (
            <Empty
              icon={term ? 'search' : 'people-outline'}
              title={term ? 'Aucun résultat' : 'Aucun collaborateur pour le moment.'}
              text={term ? `Aucun membre ne correspond à « ${term} ».` : isOwner ? 'Touchez « Ajouter un membre » pour inviter votre première équipe.' : 'Le propriétaire n’a encore ajouté personne.'}
            />
          )
        }
        renderItem={({ item }) => <MemberCard m={item} granted={countGranted(item.permissions, groups)} onPress={() => setSelected(item)} />}
      />
    );
  else
    body = (
      <FlatList
        {...hideOnScroll}
        data={pending}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={invitations.isRefetching} onRefresh={() => void invitations.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          invitations.isPending ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : invitations.isError ? (
            <ErrorState error={invitations.error} onRetry={() => void invitations.refetch()} />
          ) : (
            <Empty icon="mail-open-outline" title="Aucune invitation en attente." text="Utilisez « Inviter » pour envoyer un lien à un collaborateur." />
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.inv, { borderColor: theme.border }]}>
            <Avatar m={{ firstName: item.firstName ?? item.email, lastName: item.firstName ? item.lastName : '', email: item.email }} size={44} />
            <View style={styles.flex}>
              <ThemedText style={styles.invName} numberOfLines={1}>
                {item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : item.email}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {item.email}
              </ThemedText>
              {item.jobTitle ? (
                <ThemedText type="small" numberOfLines={1}>
                  {item.jobTitle}
                </ThemedText>
              ) : null}
              <View style={styles.expire}>
                <Ionicons name="hourglass-outline" size={12} color="#B45309" />
                <ThemedText style={styles.expireText}>Expire le {formatDate(item.expiresAt)}</ThemedText>
              </View>
            </View>
            <View style={styles.invActions}>
              <Pressable onPress={() => void onResend(item)} disabled={resending === item.id} accessibilityRole="button" accessibilityLabel="Renvoyer l’invitation" style={[styles.iconBtn, { borderColor: theme.border }]}>
                {resending === item.id ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="paper-plane-outline" size={18} color={Brand.primary} />}
              </Pressable>
              <Pressable onPress={() => askCancel(item)} accessibilityRole="button" accessibilityLabel="Annuler l’invitation" style={[styles.iconBtn, { borderColor: '#F5C2C0' }]}>
                <Ionicons name="trash-outline" size={18} color={Brand.danger} />
              </Pressable>
            </View>
          </View>
        )}
      />
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Gestion de l’équipe" subtitle="Gérez les accès et permissions de vos collaborateurs." />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="equipe" />
      <Snack msg={snack.msg} bottom={96} />

      {selected ? (
        <MemberSheet
          m={selected}
          isOwner={isOwner}
          groups={groups}
          busy={busy}
          onClose={closeAll}
          onPermissions={() => {
            setPermTarget(selected);
            closeAll();
          }}
          onActivity={() => {
            setActivityTarget(selected);
            closeAll();
          }}
          onResetPassword={() => void onResetPassword(selected)}
          onSuspend={() => askSuspend(selected)}
          onReactivate={() => void onReactivate(selected)}
          onDelete={() => askDelete(selected)}
        />
      ) : null}
      {permTarget ? <PermissionsSheet m={permTarget} groups={groups} onClose={() => setPermTarget(null)} onError={(m) => snack.show(m || 'Erreur lors de la mise à jour.', true)} /> : null}
      {activityTarget ? <ActivitySheet m={activityTarget} onClose={() => setActivityTarget(null)} /> : null}
      {adding ? (
        <AddMemberSheet
          site={SITE}
          initialMode={adding}
          onClose={() => setAdding(null)}
          onCreated={(c) => {
            setAdding(null);
            setCreated(c);
            if (c.kind === 'inviteLink') {
              snack.show(`Lien d’invitation créé pour ${c.email}.`);
              setTab('invitations');
            }
            refreshAll();
          }}
        />
      ) : null}
      {created ? <SecretSheet c={created} onClose={() => setCreated(null)} onCopied={(m) => snack.show(m)} /> : null}
      {confirm ? (
        <ConfirmSheet
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          withReason={confirm.withReason}
          onCancel={() => setConfirm(null)}
          onConfirm={async (reason) => {
            await confirm.run(reason);
            setConfirm(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { borderColor: theme.border }]} accessible accessibilityLabel={`${label} : ${value}`}>
      <ThemedText style={[styles.statV, { color }]}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        {label}
      </ThemedText>
    </View>
  );
}

function TabBtn({ on, icon, label, count, warn, onPress }: { on: boolean; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; count?: number; warn?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && [styles.tabOn, { backgroundColor: theme.background }]]}>
      <Ionicons name={icon} size={17} color={on ? Brand.primaryInk : theme.textSecondary} />
      <ThemedText type="smallBold" style={{ color: on ? Brand.primaryInk : theme.textSecondary }}>
        {label}
      </ThemedText>
      {count ? (
        <View style={[styles.tabCount, { backgroundColor: warn ? '#FEF3E2' : Brand.primarySoft }]}>
          <ThemedText style={[styles.tabCountText, { color: warn ? '#B45309' : Brand.primaryInk }]}>{count}</ThemedText>
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
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  loader: { marginVertical: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  header: { gap: 12, marginBottom: 2 },
  slots: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  slotsTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotsV: { fontSize: 28, lineHeight: 34, fontWeight: '900' },
  slotsMax: { fontSize: 18, lineHeight: 34, fontWeight: '700', color: '#6B6B6B' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  planText: { color: Brand.primaryInk, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, gap: 2 },
  statV: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 999, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine },
  addText: { color: Brand.primaryInk, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  limit: { flexDirection: 'row', gap: 8, borderRadius: 14, padding: 12 },
  limitText: { flex: 1, color: '#B45309' },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, minHeight: 42 },
  tabOn: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabCountText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  invHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  invTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  invSend: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  inv: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 12 },
  invName: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  expire: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  expireText: { color: '#B45309', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  invActions: { gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 16 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: Brand.primarySoft },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
});

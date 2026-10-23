/**
 * Onglet « Contacts » de la messagerie.
 *
 *   pas encore d'accord  → explication claire (ce qui est lu, ce qui est envoyé,
 *                          comment l'effacer) puis « Autoriser l'accès » —
 *                          c'est l'« affichage bien visible » exigé par Google
 *                          Play AVANT la fenêtre de permission Android ;
 *   accès bloqué         → bouton vers les réglages du téléphone ;
 *   synchronisé          → mes contacts sur Shoneya (nom enregistré dans MON
 *                          téléphone + nom public Shoneya), rangés par état :
 *                          EN LIGNE (vert, dans l'appli) · JOIGNABLES (orange :
 *                          appli fermée mais données internet actives, le message
 *                          ou l'appel arrive tout de suite) · HORS LIGNE (gris,
 *                          « vu il y a… ») ; état mis à jour en direct ; toucher =
 *                          écrire ; puis « Inviter ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { Avatar } from '@/features/messagerie/MemberPicker';
import {
  effectiveStatus, ingestPresence, PRESENCE_COLOR, PresenceDot, PresenceLegend, presenceText, usePresenceStore, watchPresence,
  type PresenceStatus,
} from '@/features/presence';
import { useTheme } from '@/hooks/use-theme';

import type { ShoneyaContact } from '../api';
import { useContactsSync, useShoneyaContacts } from '../hooks';
import { contactsPermission, enableContactsSync, syncContacts, type Permission } from '../sync';

const TYPE_LABEL: Record<ShoneyaContact['type'], string> = {
  client: 'Client', company: 'Boutique', delivery: 'Livreur', correspondent: 'Point relais', partner: 'Partenaire',
};

const INVITE_MESSAGE =
  'Je suis sur Shoneya : on peut discuter, s’appeler et acheter près de chez nous. Rejoins-moi : https://www.shoneya.com';

export function ContactsPanel({ query, opening, onOpen }: {
  /** Filtre de la recherche de l'en-tête */
  query: string;
  /** Clé « type:id » de la discussion en cours d'ouverture */
  opening: string | null;
  onOpen: (c: ShoneyaContact) => void;
}) {
  const theme = useTheme();
  const sync = useContactsSync();
  const list = useShoneyaContacts(sync.enabled);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let alive = true;
    void contactsPermission().then((p) => alive && setPermission(p));
    return () => { alive = false; };
  }, [sync.enabled]);

  /* État de présence de chaque contact : celui de la liste, puis les mises à jour en direct. */
  useEffect(() => {
    for (const c of list.data?.contacts ?? []) {
      ingestPresence(c.userId, { status: c.presence ?? (c.online ? 'online' : 'offline'), lastSeen: c.lastSeen ?? null, reachableUntil: c.reachableUntil ?? null });
    }
  }, [list.data]);
  const byUser = usePresenceStore((st) => st.byUser);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const [legendOpen, setLegendOpen] = useState(false);

  /* Trois groupes, comme les états de la messagerie : en ligne, joignables, hors ligne. */
  const { rows, counts } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = list.data?.contacts ?? [];
    const filtered = q ? all.filter((c) => c.name.toLowerCase().includes(q) || (c.localName ?? '').toLowerCase().includes(q)) : all;
    const groups: Record<PresenceStatus, LiveContact[]> = { online: [], reachable: [], offline: [] };
    for (const c of filtered) {
      const e = byUser[c.userId];
      const status = effectiveStatus(e ?? { status: c.presence ?? (c.online ? 'online' : 'offline'), reachableUntil: c.reachableUntil ?? null }, now);
      groups[status].push({ ...c, status, seen: e?.lastSeen ?? c.lastSeen ?? null });
    }
    /* Hors ligne : les plus récemment vus d'abord. */
    groups.offline.sort((a, b) => (b.seen ?? '').localeCompare(a.seen ?? ''));
    const out: Row[] = [];
    for (const st of ['online', 'reachable', 'offline'] as const) {
      if (!groups[st].length) continue;
      out.push({ kind: 'section', status: st, count: groups[st].length });
      for (const c of groups[st]) out.push({ kind: 'contact', c });
    }
    return { rows: out, counts: { online: groups.online.length, reachable: groups.reachable.length, offline: groups.offline.length } };
  }, [list.data, query, byUser, now]);

  async function allow() {
    if (!sync.userId || asking) return;
    setAsking(true);
    try {
      const ok = await enableContactsSync(sync.userId);
      if (!ok) {
        const p = await contactsPermission();
        setPermission(p);
        if (p === 'blocked') {
          Alert.alert('Accès aux contacts refusé', 'Vous pouvez l’autoriser dans les réglages du téléphone : Applications › Shoneya › Autorisations › Contacts.', [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
          ]);
        }
      } else {
        setPermission('granted');
      }
    } finally {
      setAsking(false);
    }
  }

  function invite() {
    void Share.share({ message: INVITE_MESSAGE }).catch(() => undefined);
  }

  /* ── 1. Pas encore d'accord : explication puis permission ── */
  if (!sync.enabled) {
    return (
      <View style={styles.consent}>
        <View style={[styles.consentIcon, { backgroundColor: Brand.primarySoft }]}>
          <Ionicons name="people" size={34} color={Brand.primary} />
        </View>
        <ThemedText style={styles.consentTitle}>Retrouvez vos contacts sur Shoneya</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Shoneya peut lire les numéros et les noms de votre répertoire pour vous montrer lesquels de vos contacts utilisent déjà Shoneya, et vous prévenir quand l’un d’eux s’inscrit.
        </ThemedText>
        <View style={[styles.facts, { borderColor: theme.border }]}>
          <Fact icon="lock-closed-outline" text="Les numéros sont transformés en code chiffré (empreinte) sur votre téléphone : aucun numéro n’est envoyé en clair." />
          <Fact icon="person-outline" text="Seul le nom que vous avez donné au contact accompagne ce code, pour l’afficher ici." />
          <Fact icon="eye-off-outline" text="Rien n’est vendu ni partagé. Vos contacts ne sont jamais avertis de votre choix." />
          <Fact icon="trash-outline" text="Désactivez quand vous voulez dans ⚙ Paramètres : tout est effacé de nos serveurs." last />
        </View>
        <Pressable onPress={() => void allow()} disabled={asking || !sync.userId} accessibilityRole="button"
          style={({ pressed }) => [styles.primaryBtn, (pressed || asking) && styles.pressed]}>
          {asking ? <ActivityIndicator color="#fff" /> : <Ionicons name="people-outline" size={18} color="#fff" />}
          <ThemedText style={styles.primaryText}>Autoriser l’accès aux contacts</ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Vous pouvez aussi chercher quelqu’un avec 🔍 sans donner accès à vos contacts.
        </ThemedText>
      </View>
    );
  }

  /* ── 2. Accord donné mais permission retirée dans les réglages ── */
  if (permission === 'blocked' || permission === 'undetermined') {
    return (
      <View style={styles.consent}>
        <Ionicons name="alert-circle-outline" size={40} color="#D97706" />
        <ThemedText style={styles.consentTitle}>Accès aux contacts désactivé</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          L’accès a été retiré dans les réglages du téléphone. Réactivez-le pour mettre à jour vos contacts sur Shoneya.
        </ThemedText>
        <Pressable onPress={() => (permission === 'blocked' ? void Linking.openSettings() : void allow())} accessibilityRole="button"
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
          <Ionicons name="settings-outline" size={18} color="#fff" />
          <ThemedText style={styles.primaryText}>{permission === 'blocked' ? 'Ouvrir les réglages' : 'Autoriser l’accès'}</ThemedText>
        </Pressable>
      </View>
    );
  }

  /* ── 3. Liste ── */
  const busy = sync.phase === 'reading' || sync.phase === 'sending';
  const header = (
    <View>
      <View style={styles.statusLine}>
        {busy ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="checkmark-circle" size={16} color={Brand.success} />}
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {sync.phase === 'reading'
            ? 'Lecture de votre répertoire…'
            : sync.phase === 'sending' && sync.total > 0
              ? `Recherche de vos contacts sur Shoneya… ${Math.round((sync.done / sync.total) * 100)} %`
              : list.data
                ? `${list.data.contacts.length} contact${list.data.contacts.length > 1 ? 's' : ''} sur Shoneya`
                : 'Vos contacts sur Shoneya'}
        </ThemedText>
      </View>
      {list.data && list.data.contacts.length ? (
        <View style={styles.summary}>
          {(['online', 'reachable', 'offline'] as const).map((st) => (
            <View key={st} style={[styles.sumChip, { backgroundColor: `${PRESENCE_COLOR[st]}1A` }]}>
              <PresenceDot status={st} size={10} showOffline borderColor="transparent" />
              <ThemedText style={[styles.sumText, { color: st === 'offline' ? theme.textSecondary : PRESENCE_COLOR[st] }]}>
                {counts[st]} {SECTION_SHORT[st]}
              </ThemedText>
            </View>
          ))}
          <Pressable onPress={() => setLegendOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Que veulent dire ces états ?">
            <Ionicons name="help-circle-outline" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}
      {sync.phase === 'error' && sync.error ? (
        <Pressable onPress={() => sync.userId && void syncContacts(sync.userId, { force: true })} accessibilityRole="button" style={styles.errorLine}>
          <Ionicons name="refresh" size={15} color="#B45309" />
          <ThemedText type="small" style={styles.errorText}>{sync.error} Toucher pour réessayer.</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );

  if (list.isPending) {
    return <View>{header}<ActivityIndicator color={Brand.primary} style={styles.loader} /></View>;
  }
  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  return (
    <>
    <FlatList
      data={rows}
      keyExtractor={(r) => (r.kind === 'section' ? `section:${r.status}` : `${r.c.type}:${r.c.id}`)}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching && !busy}
          onRefresh={() => {
            if (sync.userId) void syncContacts(sync.userId, { force: true });
            void list.refetch();
          }}
          colors={[Brand.primary]}
        />
      }
      renderItem={({ item }) =>
        item.kind === 'section'
          ? <SectionTitle status={item.status} count={item.count} />
          : <ContactRow c={item.c} busy={opening === `${item.c.type}:${item.c.id}`} onPress={() => onOpen(item.c)} />}
      ListEmptyComponent={
        busy ? null : (
          <View style={styles.empty}>
            <ThemedText style={styles.emptyTitle}>{query ? 'Aucun contact trouvé' : 'Aucun contact sur Shoneya pour l’instant'}</ThemedText>
            {!query ? (
              <ThemedText themeColor="textSecondary" style={styles.center}>
                Dès qu’un de vos contacts s’inscrira, il apparaîtra ici et vous serez prévenu.
              </ThemedText>
            ) : null}
          </View>
        )
      }
      ListFooterComponent={
        <Pressable onPress={invite} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.inviteIcon, { backgroundColor: Brand.primarySoft }]}>
            <Ionicons name="share-social" size={22} color={Brand.primary} />
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.name}>Inviter des amis sur Shoneya</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Par WhatsApp, SMS… ceux qui s’inscrivent apparaîtront ici</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
      }
    />
    {legendOpen ? <PresenceLegend onClose={() => setLegendOpen(false)} /> : null}
    </>
  );
}

type LiveContact = ShoneyaContact & { status: PresenceStatus; seen: string | null };
type Row = { kind: 'section'; status: PresenceStatus; count: number } | { kind: 'contact'; c: LiveContact };

const SECTION_TITLE: Record<PresenceStatus, string> = {
  online: 'En ligne',
  reachable: 'Joignables · données internet actives',
  offline: 'Hors ligne',
};
const SECTION_SHORT: Record<PresenceStatus, string> = { online: 'en ligne', reachable: 'joignables', offline: 'hors ligne' };

function SectionTitle({ status, count }: { status: PresenceStatus; count: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.background }]}>
      <PresenceDot status={status} size={9} showOffline borderColor="transparent" />
      <ThemedText style={[styles.sectionText, { color: status === 'offline' ? theme.textSecondary : PRESENCE_COLOR[status] }]}>
        {SECTION_TITLE[status].toUpperCase()} · {count}
      </ThemedText>
    </View>
  );
}

function ContactRow({ c, busy, onPress }: { c: LiveContact; busy: boolean; onPress: () => void }) {
  const theme = useTheme();
  /* Suivi en direct des contacts affichés (ils ne sont pas forcément des correspondants déjà connus). */
  useEffect(() => watchPresence(c.userId), [c.userId]);
  const statusColor = c.status === 'offline' ? theme.textSecondary : PRESENCE_COLOR[c.status];
  /* Nom de MON répertoire en titre ; le nom public Shoneya juste dessous (le
   * numéro n'étant pas vérifié par SMS, on montre toujours qui est derrière). */
  const title = c.localName || c.name;
  const sameName = !c.localName || c.localName.toLowerCase() === c.name.toLowerCase();
  const subtitle = [sameName ? null : `${c.name} sur Shoneya`, TYPE_LABEL[c.type]].filter(Boolean).join(' · ');
  const state = presenceText(c.status, c.seen, { short: true });
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={`Écrire à ${title}, ${state}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View>
        <View style={c.status === 'offline' ? styles.dimmed : undefined}>
          <Avatar u={{ name: c.name, logo: c.logo }} size={48} />
        </View>
        <PresenceDot status={c.status} size={15} showOffline style={styles.dotPos} />
      </View>
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.name}>{title}</ThemedText>
        <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">{subtitle}</ThemedText>
        <ThemedText numberOfLines={1} type="small" style={[styles.state, { color: statusColor }]}>
          {c.status === 'reachable' ? 'Joignable · données internet actives' : state}
        </ThemedText>
      </View>
      {busy ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="chatbubble-ellipses-outline" size={20} color={Brand.primary} />}
    </Pressable>
  );
}

function Fact({ icon, text, last }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.fact, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Ionicons name={icon} size={17} color={Brand.primary} style={styles.factIcon} />
      <ThemedText type="small" style={styles.flex}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.85 },
  loader: { marginTop: 40 },
  list: { paddingBottom: Spacing.five, flexGrow: 1 },
  consent: { alignItems: 'center', gap: 12, paddingHorizontal: Spacing.four, paddingVertical: Spacing.four },
  consentIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  consentTitle: { fontSize: 19, lineHeight: 25, fontWeight: '800', textAlign: 'center' },
  facts: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  factIcon: { marginTop: 1 },
  primaryBtn: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.primary, borderRadius: 999, paddingVertical: 14, marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  errorLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: Spacing.three, marginBottom: 6, padding: 10, borderRadius: 12, backgroundColor: '#FFF7ED' },
  errorText: { flex: 1, color: '#B45309' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  dotPos: { position: 'absolute', right: -1, bottom: -1 },
  dimmed: { opacity: 0.55 },
  state: { fontWeight: '700', marginTop: 1 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.three, paddingBottom: 8 },
  sumChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  sumText: { fontSize: 12.5, fontWeight: '700' },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.three, paddingTop: 14, paddingBottom: 6 },
  sectionText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  name: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  inviteIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: Spacing.four },
  emptyTitle: { fontSize: 17, lineHeight: 23, fontWeight: '800', textAlign: 'center' },
});

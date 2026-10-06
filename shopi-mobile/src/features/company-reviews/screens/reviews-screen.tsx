/**
 * Espace entreprise › Avis clients — équivalent mobile de
 * /dashboard/entreprise/avis (AvisPage.tsx) :
 *   · chiffres clés : note globale, avis au total, satisfaction (4 et 5
 *     étoiles), avis sans réponse ;
 *   · distribution des notes (grande note, étoiles, barres 5 → 1) — toucher
 *     une ligne filtre sur ce nombre d'étoiles ;
 *   · filtres : tous / avec réponse / sans réponse (avec compteurs) ;
 *   · une carte par avis : client, produit, étoiles, date, commentaire, votre
 *     réponse ; Répondre / Modifier la réponse (messaging.send), Voir la
 *     commande, Signaler (envoyé à la modération) ;
 *   · conseils Shoneya.
 * La satisfaction est calculée sur les avis eux-mêmes : sur le site, elle
 * divise des pourcentages par le nombre d'avis et donne un chiffre faux.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { PrimaryButton } from '@/components/form';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { Sheet } from '@/features/company-clients/components';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchReviews, initialsOf, replyToReview, REPORT_REASONS, reportReview, type ReportReason, type Review, type ReviewsData } from '../api';

type Filter = 'all' | 'replied' | 'pending';
const STAR = '#F5A524';

export default function ReviewsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canView = perms.isOwner || perms.can('orders', 'view');
  const canReply = perms.isOwner || perms.can('messaging', 'send');
  const canSeeOrders = perms.isOwner || perms.can('orders', 'view');
  const [filter, setFilter] = useState<Filter>('all');
  const [stars, setStars] = useState<number | null>(null);
  const [replying, setReplying] = useState<Review | null>(null);
  const [reporting, setReporting] = useState<Review | null>(null);
  const snack = useSnack();
  const q = useQuery({ queryKey: qk.company.reviews, queryFn: fetchReviews, enabled: canView });

  const avis = useMemo(() => q.data?.avis ?? [], [q.data]);
  const replied = avis.filter((a) => !!a.reponse).length;
  const pending = avis.length - replied;
  const list = avis.filter((a) => (filter === 'replied' ? !!a.reponse : filter === 'pending' ? !a.reponse : true)).filter((a) => stars == null || Math.round(a.note) === stars);

  const header = q.data ? (
    <View style={styles.header}>
      <Kpis data={q.data} pending={pending} />
      <Distribution data={q.data} active={stars} onPick={(n) => setStars(stars === n ? null : n)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(
          [
            ['all', 'Tous les avis', avis.length],
            ['replied', '✅ Avec réponse', replied],
            ['pending', '⏳ Sans réponse', pending],
          ] as const
        ).map(([k, label, n]) => {
          const on = filter === k;
          return (
            <Pressable
              key={k}
              onPress={() => setFilter(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
              <ThemedText style={[styles.chipText, on && { color: Brand.primaryInk, fontWeight: '800' }]}>
                {label} ({n})
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      {stars != null ? (
        <Pressable onPress={() => setStars(null)} accessibilityRole="button" style={[styles.starFilter, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Avis {stars} ★ uniquement</ThemedText>
          <Ionicons name="close-circle" size={17} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  ) : null;

  let body: React.ReactNode;
  if (perms.loading || (q.isPending && canView)) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.h2}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de consulter les avis. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else if (q.isError && !q.data) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <FlatList
        {...hideOnScroll}
        data={list}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIco}>
              <Ionicons name="star-outline" size={28} color={Brand.primary} />
            </View>
            <ThemedText style={styles.h2}>Aucun avis</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {stars != null
                ? `Aucun avis ${stars} ★ avec ce filtre.`
                : filter === 'pending'
                  ? 'Tous les avis ont reçu une réponse.'
                  : filter === 'replied'
                    ? 'Aucun avis n’a encore été répondu.'
                    : 'Aucun avis client pour le moment. Ils apparaîtront ici après les premières livraisons notées.'}
            </ThemedText>
          </View>
        }
        ListFooterComponent={avis.length ? <Tips /> : null}
        renderItem={({ item }) => (
          <ReviewCard
            r={item}
            canReply={canReply}
            onReply={() => setReplying(item)}
            onReport={() => setReporting(item)}
            onOrder={canSeeOrders && item.commandeId ? () => router.push({ pathname: '/entreprise/commandes/[id]', params: { id: item.commandeId as string } }) : undefined}
          />
        )}
      />
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Avis clients" subtitle="Notes et commentaires de vos clients" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="avis" />
      <Snack msg={snack.msg} bottom={96} />
      {replying ? (
        <ReplySheet
          r={replying}
          onClose={() => setReplying(null)}
          onDone={(text) => {
            qc.setQueryData<ReviewsData>(qk.company.reviews, (d) => (d ? { ...d, avis: d.avis.map((a) => (a.id === replying.id ? { ...a, reponse: text } : a)) } : d));
            setReplying(null);
            snack.show('✅ Réponse publiée');
            void qc.invalidateQueries({ queryKey: qk.company.badges });
          }}
        />
      ) : null}
      {reporting ? (
        <ReportSheet
          r={reporting}
          onClose={() => setReporting(null)}
          onDone={() => {
            setReporting(null);
            snack.show('🚩 Avis signalé — l’équipe de modération va l’examiner');
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <View style={styles.stars} accessible accessibilityLabel={`${n} sur 5`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Ionicons key={v} name={v <= Math.round(n) ? 'star' : 'star-outline'} size={size} color={v <= Math.round(n) ? STAR : '#C9C9C9'} />
      ))}
    </View>
  );
}

function Kpis({ data, pending }: { data: ReviewsData; pending: number }) {
  const total = data.stats.total || data.avis.length;
  const happy = data.avis.filter((a) => a.note >= 4).length;
  const satisfaction = data.avis.length ? `${Math.round((happy / data.avis.length) * 100)} %` : '—';
  return (
    <View style={styles.kpis}>
      <Kpi icon="⭐" value={data.stats.moyenne.toFixed(1).replace('.', ',')} label="Note globale" sub="Sur 5 étoiles" />
      <Kpi icon="💬" value={String(total)} label="Avis au total" sub="Clients vérifiés" />
      <Kpi icon="✅" value={satisfaction} label="Satisfaction" sub="4 et 5 étoiles" />
      <Kpi icon="⏳" value={String(pending)} label="Sans réponse" sub="À traiter" warn={pending > 0} />
    </View>
  );
}

function Kpi({ icon, value, label, sub, warn }: { icon: string; value: string; label: string; sub: string; warn?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.kpi, { borderColor: warn ? Brand.primaryLine : theme.border, backgroundColor: warn ? Brand.primarySoft : theme.background }]} accessible accessibilityLabel={`${label} : ${value}`}>
      <ThemedText style={styles.kpiIcon}>{icon}</ThemedText>
      <ThemedText style={styles.kpiV}>{value}</ThemedText>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {sub}
      </ThemedText>
    </View>
  );
}

function Distribution({ data, active, onPick }: { data: ReviewsData; active: number | null; onPick: (n: number) => void }) {
  const theme = useTheme();
  const total = data.stats.total || data.avis.length;
  return (
    <View style={[styles.box, { borderColor: theme.border }]}>
      <View style={styles.boxHead}>
        <Ionicons name="star-outline" size={17} color={Brand.primary} />
        <ThemedText style={styles.boxTitle}>Distribution des notes</ThemedText>
      </View>
      <View style={styles.dist}>
        <View style={styles.score}>
          <ThemedText style={styles.scoreV}>{data.stats.moyenne.toFixed(1).replace('.', ',')}</ThemedText>
          <Stars n={data.stats.moyenne} size={16} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {total} avis vérifié{total > 1 ? 's' : ''}
          </ThemedText>
        </View>
        <View style={styles.flex}>
          {[5, 4, 3, 2, 1].map((s) => {
            const pct = data.stats.distribution[String(s)] ?? 0;
            const color = s >= 4 ? Brand.success : s === 3 ? STAR : Brand.danger;
            const on = active === s;
            return (
              <Pressable key={s} onPress={() => onPick(s)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${s} étoiles : ${pct} %. Filtrer`} style={[styles.distRow, on && { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" style={styles.distLabel}>
                  {s} ★
                </ThemedText>
                <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
                <ThemedText type="small" style={[styles.distPct, { color }]}>
                  {pct} %
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function ReviewCard({ r, canReply, onReply, onReport, onOrder }: { r: Review; canReply: boolean; onReply: () => void; onReport: () => void; onOrder?: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>{initialsOf(r)}</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.client} numberOfLines={1}>
            {r.clientNom}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            Sur : <ThemedText type="small" style={styles.bold}>{r.produitNom}</ThemedText>
          </ThemedText>
        </View>
        <View style={styles.rate}>
          <Stars n={r.note} />
          <ThemedText style={styles.date} themeColor="textSecondary">
            {r.date}
          </ThemedText>
        </View>
      </View>

      {r.commentaire ? (
        <View style={[styles.comment, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.commentText}>« {r.commentaire} »</ThemedText>
        </View>
      ) : null}

      {r.reponse ? (
        <View style={[styles.reply, { borderLeftColor: Brand.primary, backgroundColor: theme.backgroundElement }]}>
          <View style={styles.replyHead}>
            <Ionicons name="storefront-outline" size={13} color={theme.textSecondary} />
            <ThemedText type="smallBold" themeColor="textSecondary">
              Votre réponse
            </ThemedText>
          </View>
          <ThemedText type="small">{r.reponse}</ThemedText>
        </View>
      ) : null}

      <View style={styles.actions}>
        {canReply ? (
          <Pressable onPress={onReply} accessibilityRole="button" style={[styles.act, !r.reponse ? styles.actMain : { borderColor: theme.border }]}>
            <Ionicons name={r.reponse ? 'create-outline' : 'arrow-undo-outline'} size={15} color={Brand.primaryInk} />
            <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>
              {r.reponse ? 'Modifier la réponse' : 'Répondre'}
            </ThemedText>
          </Pressable>
        ) : null}
        {onOrder ? (
          <Pressable onPress={onOrder} accessibilityRole="button" style={[styles.act, { borderColor: theme.border }]}>
            <Ionicons name="cube-outline" size={15} color={theme.text} />
            <ThemedText type="smallBold">Commande</ThemedText>
          </Pressable>
        ) : null}
        <Pressable onPress={onReport} accessibilityRole="button" accessibilityLabel="Signaler cet avis" style={[styles.act, { borderColor: theme.border }]}>
          <Ionicons name="flag-outline" size={15} color={theme.textSecondary} />
          <ThemedText type="smallBold" themeColor="textSecondary">
            Signaler
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function ReplySheet({ r, onClose, onDone }: { r: Review; onClose: () => void; onDone: (text: string) => void }) {
  const theme = useTheme();
  const [text, setText] = useState(r.reponse ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = text.trim().length >= 2;
  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      await replyToReview(r.id, text.trim());
      onDone(text.trim());
    } catch (e) {
      setError(toUserMessage(e) || '❌ Erreur lors de la publication');
      setSaving(false);
    }
  };
  return (
    <Sheet title={r.reponse ? 'Modifier la réponse' : 'Répondre à l’avis'} icon="arrow-undo-outline" onClose={onClose} footer={<PrimaryButton title={saving ? 'Envoi…' : 'Publier'} onPress={() => void publish()} loading={saving} disabled={!ok} pill />}>
      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        <View style={[styles.comment, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.rowBetween}>
            <ThemedText type="smallBold">{r.clientNom}</ThemedText>
            <Stars n={r.note} />
          </View>
          <ThemedText style={styles.commentText}>{r.commentaire ? `« ${r.commentaire} »` : 'Note sans commentaire.'}</ThemedText>
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Répondre à cet avis…"
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={1000}
          autoFocus
          style={[styles.area, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          accessibilityLabel="Votre réponse"
        />
        <View style={styles.rowBetween}>
          <ThemedText type="small" themeColor="textSecondary">
            Réponse publique, visible par tous. Le client est prévenu.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {text.length}/1000
          </ThemedText>
        </View>
        {error ? (
          <ThemedText type="small" style={styles.err} accessibilityRole="alert">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function ReportSheet({ r, onClose, onDone }: { r: Review; onClose: () => void; onDone: () => void }) {
  const theme = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!reason) return;
    setSending(true);
    setError(null);
    try {
      await reportReview(r, reason, details);
      onDone();
    } catch (e) {
      setError(toUserMessage(e));
      setSending(false);
    }
  };
  return (
    <Sheet title="Signaler cet avis" icon="flag-outline" onClose={onClose} footer={<PrimaryButton title="Envoyer le signalement" onPress={() => void send()} loading={sending} disabled={!reason} pill />}>
      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        <ThemedText type="small" themeColor="textSecondary">
          L’équipe de modération Shoneya examinera l’avis de {r.clientNom} et vous répondra dans votre centre d’aide. L’avis reste visible en attendant.
        </ThemedText>
        <ThemedText type="smallBold">Motif</ThemedText>
        <View style={styles.reasons} accessibilityRole="radiogroup">
          {REPORT_REASONS.map((x) => {
            const on = reason === x.value;
            return (
              <Pressable key={x.value} onPress={() => setReason(x.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.reason, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? Brand.primary : theme.textSecondary} />
                <ThemedText style={on ? styles.bold : undefined}>{x.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder="Précisions (facultatif)"
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={1000}
          style={[styles.area, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          accessibilityLabel="Précisions"
        />
        {error ? (
          <ThemedText type="small" style={styles.err} accessibilityRole="alert">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function Tips() {
  const theme = useTheme();
  return (
    <View style={[styles.box, styles.tips, { borderColor: theme.border }]}>
      <View style={styles.boxHead}>
        <Ionicons name="bulb-outline" size={17} color={Brand.primary} />
        <ThemedText style={styles.boxTitle}>Conseils Shoneya</ThemedText>
      </View>
      {[
        ['⚡', 'Répondez en moins de 24h pour +12% de satisfaction.'],
        ['🎯', 'Un vendeur qui répond obtient 2× plus de nouveaux avis.'],
        ['💬', 'Remerciez toujours les avis positifs — même brièvement.'],
      ].map(([ic, txt]) => (
        <View key={ic} style={[styles.tip, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText>{ic}</ThemedText>
          <ThemedText type="small" style={styles.flex}>
            {txt}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  loader: { marginVertical: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  h2: { fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  err: { color: Brand.danger },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  header: { gap: 12, marginBottom: 2 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 1 },
  kpiIcon: { fontSize: 18, lineHeight: 24 },
  kpiV: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  box: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  boxTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  dist: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  score: { alignItems: 'center', gap: 4, width: 96 },
  scoreV: { fontSize: 40, lineHeight: 46, fontWeight: '900' },
  stars: { flexDirection: 'row', gap: 1 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 4 },
  distLabel: { width: 26, fontWeight: '700' },
  distPct: { width: 40, textAlign: 'right', fontWeight: '800' },
  bar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  starFilter: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Brand.primaryInk, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  client: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  rate: { alignItems: 'flex-end', gap: 3 },
  date: { fontSize: 11, lineHeight: 15 },
  comment: { borderRadius: 12, padding: 12, gap: 6 },
  commentText: { fontStyle: 'italic', lineHeight: 21 },
  reply: { borderLeftWidth: 3, borderRadius: 10, padding: 10, gap: 3 },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36 },
  actMain: { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  area: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 120, textAlignVertical: 'top', fontSize: 15 },
  reasons: { gap: 8 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 46 },
  tips: { marginTop: 4 },
  tip: { flexDirection: 'row', gap: 9, borderRadius: 12, padding: 10 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 16 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.primarySoft },
});

/**
 * Espace livreur › Mon évaluation — équivalent mobile de
 * /dashboard/livreur/evaluation (EvaluationPage.tsx), mêmes données
 * (GET /dashboard/livreur/avis : avis + stats moyenne, total, distribution,
 * tauxReponse ; POST …/avis/:id/reponse { reponse } — 2 à 1000 caractères,
 * le client est prévenu) :
 *   · note moyenne, étoiles, nombre d'avis, satisfaction (4 et 5 étoiles) ;
 *   · en plus du site : taux de réponse (fourni par le serveur) et avis sans
 *     réponse ; nombre d'avis à côté de chaque pourcentage ;
 *   · avis des clients (commande, date, commentaire, réponse) avec
 *     « Répondre » / « Modifier la réponse » ; filtres (à répondre, avec
 *     commentaire, par étoiles — toucher une barre filtre aussi) et tri
 *     (plus récents / moins bonnes notes d'abord) ;
 *   · si la note est masquée au public (Confidentialité), on le rappelle.
 * La satisfaction est calculée sur les avis eux-mêmes (le site additionne des
 * pourcentages déjà arrondis).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/catalog';
import { PrimaryButton } from '@/components/form';
import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchPrivacy } from '@/features/livreur-settings/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchAvis, replyAvis, type Avis, type AvisData } from '../api';
import { Box, CARD, Empty, LivreurScreen } from '../components';

const STAR = '#F5A524';
const MIN = 2;
const MAX = 1000;

type Filter = 'all' | 'todo' | 'comment' | '5' | '4' | '3' | '2' | '1';
type Sort = 'recent' | 'worst';

const clamp = (n: number) => Math.max(0, Math.min(5, Math.round(n)));
const stars = (n: number) => '★'.repeat(clamp(n)) + '☆'.repeat(5 - clamp(n));
const initials = (a: Avis) =>
  a.clientInitiales ||
  a.clientNom
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') ||
  '?';

export default function LivreurEvaluationScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.livreur.avis, queryFn: fetchAvis });
  const privacy = useQuery({ queryKey: qk.livreur.privacy, queryFn: fetchPrivacy });
  const [replying, setReplying] = useState<Avis | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const snack = useSnack();
  const d = q.data;

  const list = useMemo(() => {
    const avis = d?.avis ?? [];
    const f = avis.filter((a) => (filter === 'all' ? true : filter === 'todo' ? !a.reponse : filter === 'comment' ? !!a.commentaire : a.note === Number(filter)));
    /* Le serveur renvoie déjà les avis du plus récent au plus ancien */
    return sort === 'worst' ? [...f].sort((x, y) => x.note - y.note) : f;
  }, [d, filter, sort]);

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError || !d) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else {
    const total = d.stats.total || d.avis.length;
    const counts = [5, 4, 3, 2, 1].map((s) => ({ s, n: d.avis.filter((a) => a.note === s).length, p: d.stats.distribution[String(s)] ?? 0 }));
    const happy = d.avis.filter((a) => a.note >= 4).length;
    const satisfaction = d.avis.length ? Math.round((happy / d.avis.length) * 100) : 0;
    const todo = d.avis.filter((a) => !a.reponse).length;
    const withComment = d.avis.filter((a) => !!a.commentaire).length;
    const tauxReponse = d.stats.tauxReponse ?? (total ? Math.round(((total - todo) / total) * 100) : 0);

    const FILTERS: { id: Filter; label: string; n: number }[] = [
      { id: 'all', label: 'Tous', n: total },
      { id: 'todo', label: 'À répondre', n: todo },
      { id: 'comment', label: 'Avec commentaire', n: withComment },
      ...counts.filter((c) => c.n > 0).map((c) => ({ id: String(c.s) as Filter, label: `${c.s} ★`, n: c.n })),
    ];

    body = (
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => {
              void q.refetch();
              void privacy.refetch();
            }}
            colors={[Brand.primary]}
            tintColor={Brand.primary}
          />
        }>
        <Box icon="star-outline" title="Mon évaluation">
          <View style={styles.score}>
            <ThemedText style={styles.scoreV}>{total > 0 ? d.stats.moyenne.toFixed(1).replace('.', ',') : '—'}</ThemedText>
            <ThemedText style={styles.stars} accessibilityLabel={`${d.stats.moyenne} sur 5`}>
              {stars(d.stats.moyenne)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {total} avis{total > 0 ? ` · ${satisfaction} % de satisfaction` : ''}
            </ThemedText>
          </View>
          {total > 0 ? (
            <View style={styles.kpis}>
              <Kpi v={`${satisfaction} %`} l="Satisfaction" sub="4 et 5 étoiles" />
              <Kpi v={`${tauxReponse} %`} l="Réponses" sub={`${total - todo} sur ${total}`} />
              <Kpi v={String(todo)} l="À répondre" sub={todo ? 'sans réponse' : 'tout est à jour'} warn={todo > 0} />
            </View>
          ) : null}
          {counts.map((c) => (
            <Pressable
              key={c.s}
              onPress={() => c.n > 0 && setFilter(String(c.s) as Filter)}
              disabled={c.n === 0}
              accessibilityRole="button"
              accessibilityLabel={`${c.s} étoiles : ${c.n} avis, ${c.p} %`}
              style={styles.dist}>
              <ThemedText type="small" style={styles.distL}>
                {c.s} ★
              </ThemedText>
              <View style={[styles.bar, { backgroundColor: theme.background }]}>
                <View style={[styles.fill, { width: `${c.p}%` }]} />
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.distP}>
                {c.p} % · {c.n}
              </ThemedText>
            </Pressable>
          ))}
          {privacy.data && !privacy.data.showRating ? (
            <Pressable
              onPress={() => router.push('/livreur/parametres/confidentialite')}
              accessibilityRole="button"
              accessibilityLabel="Votre note est masquée au public. Modifier dans Confidentialité"
              style={[styles.notice, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <Ionicons name="eye-off-outline" size={17} color={Brand.primary} />
              <ThemedText type="small" style={styles.flex}>
                Votre note est masquée au public (profil, liste, carte). Modifier dans Confidentialité.
              </ThemedText>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </Box>

        {d.avis.length === 0 ? (
          <Empty emoji="⭐" title="Aucun avis pour l’instant" text="Il apparaîtra ici dès qu’un client note l’une de vos livraisons." />
        ) : (
          <>
            <ThemedText style={styles.section}>Avis des clients</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((f) => {
                const on = f.id === filter;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${f.label} (${f.n})`}
                    style={[styles.chip, { backgroundColor: on ? Brand.primary : CARD, borderColor: on ? Brand.primary : theme.border }]}>
                    <ThemedText style={[styles.chipText, on && styles.white]}>
                      {f.label} ({f.n})
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.sortRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Trier :
              </ThemedText>
              {(
                [
                  ['recent', 'Plus récents'],
                  ['worst', 'Moins bonnes notes d’abord'],
                ] as const
              ).map(([id, label]) => (
                <Pressable key={id} onPress={() => setSort(id)} accessibilityRole="button" accessibilityState={{ selected: sort === id }} accessibilityLabel={`Trier : ${label}`}>
                  <ThemedText type="smallBold" style={sort === id ? styles.sortOn : { color: theme.textSecondary }}>
                    {label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {list.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {filter === 'todo' ? 'Vous avez répondu à tous vos avis. 👍' : 'Aucun avis pour ce filtre.'}
              </ThemedText>
            ) : (
              list.map((a) => (
                <View key={a.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={[styles.ava, { backgroundColor: theme.background }]}>
                      <ThemedText style={styles.avaText}>{initials(a)}</ThemedText>
                    </View>
                    <View style={styles.flex}>
                      <ThemedText style={styles.bold}>{a.clientNom}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {a.commandeRef} · {a.date}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.cardStars} accessibilityLabel={`${a.note} sur 5`}>
                      {stars(a.note)}
                    </ThemedText>
                  </View>
                  {a.commentaire ? (
                    <View style={[styles.comment, { backgroundColor: theme.background }]}>
                      <ThemedText style={styles.italic}>« {a.commentaire} »</ThemedText>
                    </View>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Note sans commentaire.
                    </ThemedText>
                  )}
                  {a.reponse ? (
                    <View style={[styles.reply, { backgroundColor: theme.background }]}>
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        🛵 Votre réponse
                      </ThemedText>
                      <ThemedText type="small">{a.reponse}</ThemedText>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => setReplying(a)}
                    accessibilityRole="button"
                    accessibilityLabel={`${a.reponse ? 'Modifier la réponse' : 'Répondre'} — ${a.clientNom}`}
                    style={[styles.btn, !a.reponse ? styles.btnMain : { borderColor: theme.border }]}>
                    <Ionicons name={a.reponse ? 'create-outline' : 'arrow-undo-outline'} size={14} color={Brand.primary} />
                    <ThemedText type="smallBold">{a.reponse ? 'Modifier la réponse' : 'Répondre'}</ThemedText>
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <LivreurScreen title="Mon évaluation" subtitle="Notes et avis de vos clients" snack={snack.msg}>
      {body}
      {replying ? (
        <ReplySheet
          a={replying}
          onClose={() => setReplying(null)}
          onDone={(text) => {
            const wasNew = !replying.reponse;
            qc.setQueryData<AvisData>(qk.livreur.avis, (x) => (x ? { ...x, avis: x.avis.map((v) => (v.id === replying.id ? { ...v, reponse: text } : v)) } : x));
            /* Taux de réponse recalculé par le serveur */
            void qc.invalidateQueries({ queryKey: qk.livreur.avis });
            setReplying(null);
            snack.show(wasNew ? 'Réponse publiée — le client est prévenu' : 'Réponse modifiée');
          }}
        />
      ) : null}
    </LivreurScreen>
  );
}

function Kpi({ v, l, sub, warn }: { v: string; l: string; sub: string; warn?: boolean }) {
  return (
    <View style={styles.kpi} accessible accessibilityLabel={`${l} : ${v}, ${sub}`}>
      <ThemedText style={[styles.kpiV, warn && styles.warn]}>{v}</ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {l}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {sub}
      </ThemedText>
    </View>
  );
}

function ReplySheet({ a, onClose, onDone }: { a: Avis; onClose: () => void; onDone: (t: string) => void }) {
  const theme = useTheme();
  const [text, setText] = useState(a.reponse ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const len = text.trim().length;
  const unchanged = !!a.reponse && text.trim() === a.reponse;
  const send = async () => {
    if (len < MIN) return setError('Votre réponse doit contenir au moins 2 caractères.');
    setSaving(true);
    setError(null);
    try {
      await replyAvis(a.id, text.trim());
      onDone(text.trim());
    } catch (e) {
      setError(toUserMessage(e) || 'Impossible d’envoyer la réponse.');
      setSaving(false);
    }
  };
  return (
    <BottomSheet title={a.reponse ? 'Modifier la réponse' : 'Répondre à l’avis'} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={[styles.comment, { backgroundColor: CARD }]}>
          <ThemedText type="smallBold">
            {a.clientNom} · <ThemedText style={styles.cardStars}>{stars(a.note)}</ThemedText>
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {a.commandeRef} · {a.date}
          </ThemedText>
          {a.commentaire ? <ThemedText style={styles.italic}>« {a.commentaire} »</ThemedText> : null}
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX}
          autoFocus
          placeholder="Répondre à cet avis…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.area, { color: theme.text, borderColor: error ? Brand.danger : theme.border }]}
          accessibilityLabel="Votre réponse"
        />
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Visible par le client, qui est prévenu de votre réponse.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {text.length} / {MAX}
          </ThemedText>
        </View>
        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        <PrimaryButton title={a.reponse ? 'Enregistrer' : 'Publier'} onPress={() => void send()} loading={saving} disabled={len < MIN || unchanged} pill />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  center: { textAlign: 'center', paddingVertical: 16 },
  white: { color: '#fff' },
  warn: { color: '#B45309' },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic', lineHeight: 21 },
  err: { color: Brand.danger },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  score: { alignItems: 'center', gap: 2, paddingVertical: 6 },
  scoreV: { fontSize: 46, lineHeight: 52, fontWeight: '900' },
  stars: { fontSize: 22, lineHeight: 28, color: STAR, letterSpacing: 1 },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, borderRadius: 14, padding: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)' },
  kpiV: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  dist: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  distL: { width: 30, fontWeight: '700' },
  distP: { width: 64, textAlign: 'right' },
  bar: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, backgroundColor: STAR },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  section: { fontSize: 16, lineHeight: 21, fontWeight: '900', marginTop: 4 },
  chips: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, minHeight: 34, justifyContent: 'center' },
  chipText: { fontSize: 12.5, lineHeight: 17, fontWeight: '800' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  sortOn: { color: Brand.primary, textDecorationLine: 'underline' },
  card: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ava: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avaText: { fontWeight: '900' },
  cardStars: { color: STAR, fontSize: 14, lineHeight: 18 },
  comment: { borderRadius: 12, padding: 10, gap: 3 },
  reply: { borderRadius: 12, padding: 10, gap: 3, borderLeftWidth: 3, borderLeftColor: Brand.primary },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36 },
  btnMain: { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine },
  sheet: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  area: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 110, textAlignVertical: 'top', fontSize: 15 },
});

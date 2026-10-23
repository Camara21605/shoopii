/**
 * Onglet Avis : note moyenne, répartition par étoiles, avis et réponses de la boutique.
 */
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { initials } from '@/components/catalog';
import { AvatarPhoto } from '@/components/avatar-photo';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Review } from '../api';
import { Stars, Empty } from './shared';

/* ── Avis ───────────────────────────────────────────────────────────── */

export function ReviewsTab({ average, total, reviews, loading }: { average: number; total: number; reviews: Review[]; loading: boolean }) {
  const theme = useTheme();
  /* Répartition par étoiles calculée sur les avis reçus (le serveur ne l'envoie pas). */
  const dist = useMemo(() => {
    const d = [0, 0, 0, 0, 0];
    for (const r of reviews) {
      const n = Math.min(5, Math.max(1, Math.round(r.note)));
      d[n - 1]++;
    }
    return d;
  }, [reviews]);
  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  return (
    <View style={s.gap12}>
      <View style={[s.card, s.reviewHead, { borderColor: theme.border }]}>
        <View style={s.reviewScore}>
          <ThemedText style={s.bigNote}>{average > 0 ? average.toFixed(1) : '—'}</ThemedText>
          <Stars value={average} size={15} />
          <ThemedText type="small" themeColor="textSecondary">
            {total} avis
          </ThemedText>
        </View>
        <View style={s.flex}>
          {[5, 4, 3, 2, 1].map((n) => {
            const c = dist[n - 1];
            const pct = reviews.length ? c / reviews.length : 0;
            return (
              <View key={n} style={s.distRow}>
                <ThemedText type="small" style={s.distN}>
                  {n}★
                </ThemedText>
                <View style={[s.distBar, { backgroundColor: theme.backgroundElement }]}>
                  <View style={[s.distFill, { width: `${pct * 100}%` }]} />
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={s.distC}>
                  {c}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>
      {reviews.length === 0 ? (
        <Empty icon="chatbubble-ellipses-outline" title="Aucun avis pour le moment" text="Les clients peuvent noter la boutique après une commande livrée." />
      ) : (
        reviews.map((r) => (
          <View key={r.id} style={[s.card, s.review, { borderColor: theme.border }]}>
            <View style={s.row8}>
              <View style={[s.reviewAva, { backgroundColor: theme.backgroundSelected }]}>
                {r.clientPhoto ? <AvatarPhoto uri={r.clientPhoto} size={40} /> : <ThemedText style={s.reviewInit}>{r.clientInitiales || initials(r.clientNom)}</ThemedText>}
              </View>
              <View style={s.flex}>
                <ThemedText style={s.actorName}>{r.clientNom}</ThemedText>
                <View style={s.row6}>
                  <Stars value={r.note} size={12} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {r.date}
                  </ThemedText>
                </View>
              </View>
            </View>
            {r.commentaire ? <ThemedText style={s.reviewText}>{r.commentaire}</ThemedText> : null}
            {r.reponse ? (
              <View style={[s.reply, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Réponse de la boutique</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {r.reponse}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  loader: { marginVertical: 40 },
  gap12: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  reviewScore: { alignItems: 'center', gap: 2, minWidth: 84 },
  bigNote: { fontSize: 38, lineHeight: 44, fontWeight: '900' },
  flex: { flex: 1 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 },
  distN: { width: 24 },
  distBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  distFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  distC: { width: 22, textAlign: 'right' },
  review: { padding: 14, gap: 8 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewAva: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reviewInit: { fontWeight: '800', color: Brand.primary },
  actorName: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewText: { fontSize: 15, lineHeight: 21 },
  reply: { borderRadius: 10, padding: 10, gap: 2 },
});

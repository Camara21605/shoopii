/**
 * Promotions de l'accueil — comme PromotionsSection du site :
 *   GET /promotions/public?limit=5   promotions actives de toutes les boutiques
 * Grande carte pour la première offre (boutique, valeur −20 % / −5 000 GNF /
 * Livraison, nom, « sur toute la boutique » ou « sur une sélection », compte à
 * rebours (J:H:M au-delà de 24 h, sinon H:M:S), « Voir l'offre »), puis une ligne par autre offre.
 * Une promo liée à des produits ouvre le premier produit ; sinon la boutique.
 * Section masquée quand il n'y a aucune promotion active.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { SectionHeader } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { openProduct, openShop } from '@/features/catalog/open';
import { apiFetch } from '@/lib/api/client';
import { qk } from '@/lib/query-keys';

const promoSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    type: z.string().catch('discount'),
    valueType: z.string().catch(''),
    valeur: z.coerce.number().nullable().optional().catch(null),
    scope: z.string().catch('global'),
    endDate: z.string().nullable().optional().catch(null),
    productIds: z.array(z.string()).catch([]),
    company: z.object({ id: z.string(), nom: z.string().catch(''), logo: z.string().nullable().optional().catch(null) }),
  })
  .passthrough();
type Promo = z.infer<typeof promoSchema>;

export const fetchHomePromos = () => apiFetch('/promotions/public', { auth: false, query: { limit: 5 }, schema: z.array(promoSchema).catch([]) });

const TYPE: Record<string, { emoji: string; color: string; bg: string }> = {
  discount: { emoji: '🏷️', color: '#BE123C', bg: '#FFF1F2' },
  'free-ship': { emoji: '🚚', color: '#1F1F1F', bg: 'rgba(0,0,0,0.05)' },
  bundle: { emoji: '🎁', color: '#7C3AED', bg: '#F5F0FF' },
  flash: { emoji: '⚡', color: '#B45309', bg: '#FFF7E6' },
};

function value(p: Promo) {
  if (p.valueType === 'percent' && p.valeur != null) return `−${Number(p.valeur)}%`;
  if (p.valueType === 'fixed' && p.valeur != null) return `−${String(Math.round(p.valeur)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;
  if (p.type === 'free-ship') return 'Livraison';
  return 'Promo';
}

const open = (p: Promo) => (p.scope === 'products' && p.productIds.length ? openProduct(p.productIds[0]) : openShop(p.company.id));

/** Temps restant jusqu'à `end` (heures totales, minutes, secondes), mis à jour chaque seconde. */
function useCountdown(end: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!end) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [end]);
  if (!end) return null;
  const left = new Date(end).getTime() - now;
  if (!(left > 0)) return null;
  const s = Math.floor(left / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function HomePromotions() {
  const q = useQuery({ queryKey: qk.homePromos, queryFn: fetchHomePromos, staleTime: 120_000 });
  const [big, ...small] = q.data ?? [];
  const timer = useCountdown(big?.endDate);
  if (!big) return null;
  const t = TYPE[big.type] ?? TYPE.discount;

  return (
    <View style={styles.section}>
      <SectionHeader title="Promotions" />
      <View style={styles.body}>
        <Pressable onPress={() => open(big)} accessibilityRole="button" accessibilityLabel={`${big.nom}, ${value(big)}, ${big.company.nom}`} style={({ pressed }) => [styles.big, pressed && styles.pressed]}>
          <View style={styles.bubble} />
          <ThemedText style={styles.bigEmoji}>{t.emoji}</ThemedText>
          <View style={styles.tag}>
            <Ionicons name="flash" size={12} color="#fff" />
            <ThemedText style={styles.tagText} numberOfLines={1}>
              {big.company.nom}
            </ThemedText>
          </View>
          <ThemedText style={styles.pct}>{value(big)}</ThemedText>
          <ThemedText style={styles.bigTitle} numberOfLines={2}>
            {big.nom}
          </ThemedText>
          <ThemedText style={styles.bigSub}>{big.scope === 'global' ? 'Sur toute la boutique' : 'Sur une sélection de produits'}</ThemedText>
          {timer ? (
            <View style={styles.timer} accessibilityLabel={`Se termine dans ${timer.d ? `${timer.d} jours ` : ''}${timer.h} heures ${timer.m} minutes`}>
              {(timer.d > 0
                ? [
                    { v: timer.d, l: 'J' },
                    { v: timer.h, l: 'H' },
                    { v: timer.m, l: 'M' },
                  ]
                : [
                    { v: timer.h, l: 'H' },
                    { v: timer.m, l: 'M' },
                    { v: timer.s, l: 'S' },
                  ]
              ).map((b, i) => (
                <View key={b.l} style={styles.timerItem}>
                  {i > 0 ? <ThemedText style={styles.sep}>:</ThemedText> : null}
                  <View style={styles.block}>
                    <ThemedText style={styles.num}>{String(b.v).padStart(2, '0')}</ThemedText>
                    <ThemedText style={styles.lbl}>{b.l}</ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.cta}>
            <Ionicons name="flash" size={15} color="#1F1F1F" />
            <ThemedText style={styles.ctaText}>Voir l’offre</ThemedText>
          </View>
        </Pressable>

        {small.map((p) => {
          const s = TYPE[p.type] ?? TYPE.discount;
          return (
            <Pressable key={p.id} onPress={() => open(p)} accessibilityRole="button" accessibilityLabel={`${p.nom}, ${value(p)}, ${p.company.nom}`} style={({ pressed }) => [styles.small, pressed && styles.pressed]}>
              <View style={[styles.smIco, { backgroundColor: s.bg }]}>
                <ThemedText style={styles.smEmoji}>{s.emoji}</ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.smTitle} numberOfLines={1}>
                  {p.nom}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {p.company.nom}
                </ThemedText>
              </View>
              <ThemedText style={[styles.smPct, { color: s.color }]}>{value(p)}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  section: { paddingTop: 28, gap: 10 },
  body: { paddingHorizontal: 16, gap: 10 },
  big: { backgroundColor: '#1F1F1F', borderRadius: 22, padding: 18, gap: 6, overflow: 'hidden' },
  bubble: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -90, right: -60, backgroundColor: 'rgba(255,255,255,0.07)' },
  bigEmoji: { position: 'absolute', right: 18, top: 16, fontSize: 46, lineHeight: 56 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: '70%' },
  tagText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  pct: { color: '#fff', fontSize: 38, lineHeight: 46, fontWeight: '900', marginTop: 4 },
  bigTitle: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  bigSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 18 },
  timer: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  timerItem: { flexDirection: 'row', alignItems: 'center' },
  sep: { color: '#fff', fontSize: 20, fontWeight: '900', marginHorizontal: 6 },
  block: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', minWidth: 50 },
  num: { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: '900' },
  lbl: { color: 'rgba(255,255,255,0.65)', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, minHeight: 42, marginTop: 8 },
  ctaText: { color: '#1F1F1F', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  small: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 16, padding: 12 },
  smIco: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smEmoji: { fontSize: 22, lineHeight: 28 },
  smTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  smPct: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
});

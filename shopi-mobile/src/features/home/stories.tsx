/**
 * Stories de l'accueil — comme HomeStoriesStrip du site :
 *   GET  /public/stories               produits en story (1 bulle = 1 produit, jamais mélangés)
 *   POST /public/stories/:id/view      vue (visiteur accepté)
 *   POST /public/stories/:id/like      ❤ (connexion requise)
 * Bande horizontale de cartes (image de couverture, logo de la boutique, nom du
 * produit, anneau tant que la story n'a pas été vue), puis visionneuse plein
 * écran : barres de progression, précédente / suivante au toucher, passage
 * automatique au produit suivant, prix (+ barré), ❤, deux boutons « Voir le
 * produit » et « Voir la boutique ». Mise à jour toutes les 2 minutes.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Dimensions, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { SectionHeader } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/features/auth/session-store';
import { thumb } from '@/features/catalog/format';
import { openProduct, openShop } from '@/features/catalog/open';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

const str = z.string().nullable().optional().catch(null);
const slideSchema = z
  .object({
    id: z.string(),
    productId: z.string(),
    produit: z.string().catch(''),
    prix: z.string().catch(''),
    prixBarre: str,
    img: z.string().catch(''),
    badge: str,
    tag: str,
    likesCount: z.coerce.number().catch(0),
    liked: z.boolean().catch(false),
  })
  .passthrough();
const bubbleSchema = z
  .object({
    productId: z.string(),
    produit: z.string().catch(''),
    companyId: z.string(),
    shopNom: z.string().catch(''),
    shopLogo: str,
    hasPromo: z.boolean().catch(false),
    images: z.array(slideSchema).catch([]),
  })
  .passthrough();
export type StoryBubble = z.infer<typeof bubbleSchema>;
type Slide = z.infer<typeof slideSchema>;

export const fetchHomeStories = () =>
  apiFetch('/public/stories', { schema: z.array(bubbleSchema).catch([]) }).then((l) => l.filter((b) => b.images.length > 0));

/** Durée d'affichage d'une image (comme le site : on peut passer au toucher). */
const DURATION = 30_000;

const BADGE: Record<string, { label: string; bg: string }> = {
  promo: { label: 'PROMO', bg: '#DC2626' },
  new: { label: 'NOUVEAU', bg: '#1F1F1F' },
  flash: { label: 'FLASH', bg: '#7C3AED' },
  top: { label: 'TOP', bg: '#B45309' },
};

export function HomeStories() {
  const q = useQuery({ queryKey: qk.homeStories, queryFn: fetchHomeStories, refetchInterval: 120_000 });
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState<number | null>(null);
  const bubbles = q.data ?? [];
  if (!bubbles.length) return null;

  const show = (i: number) => {
    setOpen(i);
    setSeen((s) => new Set(s).add(bubbles[i].productId));
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="Stories" />
      <FlatList
        horizontal
        data={bubbles}
        keyExtractor={(b) => b.productId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        renderItem={({ item, index }) => {
          const cover = thumb(item.images[0]?.img, 300);
          const logo = thumb(item.shopLogo, 80);
          const isSeen = seen.has(item.productId);
          return (
            <Pressable onPress={() => show(index)} accessibilityRole="button" accessibilityLabel={`Stories de ${item.produit}, ${item.shopNom}`} style={[styles.card, { borderColor: isSeen ? 'rgba(0,0,0,0.12)' : '#1F1F1F' }]}>
              {cover ? <Image source={{ uri: cover }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" /> : null}
              <View style={styles.shade} />
              <View style={[styles.logo, { borderColor: isSeen ? '#fff' : '#1F1F1F' }]}>
                {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <Ionicons name="storefront" size={14} color="#1F1F1F" />}
              </View>
              {item.hasPromo ? (
                <View style={[styles.mini, { backgroundColor: BADGE.promo.bg }]}>
                  <ThemedText style={styles.miniText}>PROMO</ThemedText>
                </View>
              ) : null}
              {item.images.length > 1 ? (
                <View style={styles.count}>
                  <ThemedText style={styles.miniText}>{item.images.length}</ThemedText>
                </View>
              ) : null}
              <ThemedText style={styles.cardName} numberOfLines={2}>
                {item.produit}
              </ThemedText>
            </Pressable>
          );
        }}
      />
      {open !== null && bubbles[open] ? (
        <StoryViewer
          bubbles={bubbles}
          index={open}
          onIndex={(i) => (i === null ? setOpen(null) : show(i))}
        />
      ) : null}
    </View>
  );
}

function StoryViewer({ bubbles, index, onIndex }: { bubbles: StoryBubble[]; index: number; onIndex: (i: number | null) => void }) {
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const bubble = bubbles[index];
  const [slide, setSlide] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const current: Slide | undefined = bubble.images[slide];

  const next = () => {
    progress.setValue(0);
    if (slide < bubble.images.length - 1) setSlide(slide + 1);
    else if (index < bubbles.length - 1) {
      setSlide(0);
      onIndex(index + 1);
    } else onIndex(null);
  };
  const prev = () => {
    progress.setValue(0);
    if (slide > 0) setSlide(slide - 1);
    else if (index > 0) {
      setSlide(0);
      onIndex(index - 1);
    }
  };

  /* Vue enregistrée + avance automatique */
  useEffect(() => {
    if (!current) return;
    void apiFetch(`/public/stories/${current.id}/view`, { method: 'POST' }).catch(() => undefined);
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: DURATION, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) next();
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2500);
    return () => clearTimeout(t);
  }, [msg]);

  if (!current) return null;

  const like = async () => {
    if (!user) return setMsg('Connectez-vous pour aimer cette story.');
    const patch = (liked: boolean, likesCount: number) =>
      qc.setQueryData<StoryBubble[]>(qk.homeStories, (l) =>
        l?.map((b) => (b.productId !== bubble.productId ? b : { ...b, images: b.images.map((s) => (s.id === current.id ? { ...s, liked, likesCount } : s)) })),
      );
    const before = { liked: current.liked, likesCount: current.likesCount };
    patch(!before.liked, before.likesCount + (before.liked ? -1 : 1));
    try {
      const res = await apiFetch(`/public/stories/${current.id}/like`, { method: 'POST', schema: z.object({ liked: z.boolean(), likesCount: z.coerce.number() }) });
      patch(res.liked, res.likesCount);
    } catch (e) {
      patch(before.liked, before.likesCount);
      setMsg(toUserMessage(e));
    }
  };

  const go = (fn: () => void) => () => {
    onIndex(null);
    fn();
  };
  const W = Dimensions.get('window').width;
  const badge = current.badge ? BADGE[current.badge] : null;

  return (
    <Modal visible animationType="fade" onRequestClose={() => onIndex(null)} statusBarTranslucent>
      <View style={styles.viewer}>
        <Image source={{ uri: current.img }} style={styles.viewerImg} contentFit="contain" transition={150} />
        <Pressable style={[styles.zone, { left: 0, width: W * 0.33 }]} onPress={prev} accessibilityLabel="Story précédente" />
        <Pressable style={[styles.zone, { right: 0, width: W * 0.67 }]} onPress={next} accessibilityLabel="Story suivante" />

        <SafeAreaView edges={['top']} style={styles.top}>
          <View style={styles.bars}>
            {bubble.images.map((s, i) => (
              <View key={s.id} style={styles.barBg}>
                {i < slide ? <View style={[styles.barFill, { width: '100%' }]} /> : null}
                {i === slide ? <Animated.View style={[styles.barFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /> : null}
              </View>
            ))}
          </View>
          <View style={styles.head}>
            <Pressable onPress={go(() => openShop(bubble.companyId))} accessibilityRole="button" accessibilityLabel={`Voir la boutique ${bubble.shopNom}`} style={styles.shop}>
              <View style={styles.headLogo}>
                {bubble.shopLogo ? <Image source={{ uri: thumb(bubble.shopLogo, 80) ?? bubble.shopLogo }} style={styles.fill} contentFit="cover" /> : <Ionicons name="storefront" size={16} color="#1F1F1F" />}
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.shopName} numberOfLines={1}>
                  {bubble.shopNom}
                </ThemedText>
                <ThemedText style={styles.shopSub} numberOfLines={1}>
                  Voir la boutique
                </ThemedText>
              </View>
            </Pressable>
            <Pressable onPress={() => onIndex(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer" style={styles.close}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>

        <SafeAreaView edges={['bottom']} style={styles.bottom}>
          {msg ? (
            <View style={styles.msg}>
              <ThemedText style={styles.msgText}>{msg}</ThemedText>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <View style={styles.flex}>
              {badge || current.tag ? (
                <View style={styles.badges}>
                  {badge ? (
                    <View style={[styles.mini, styles.inline, { backgroundColor: badge.bg }]}>
                      <ThemedText style={styles.miniText}>{badge.label}</ThemedText>
                    </View>
                  ) : null}
                  {current.tag ? (
                    <View style={[styles.mini, styles.inline, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <ThemedText style={styles.miniText}>{current.tag}</ThemedText>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <ThemedText style={styles.prodName} numberOfLines={2}>
                {current.produit}
              </ThemedText>
              <View style={styles.prices}>
                <ThemedText style={styles.price}>{current.prix}</ThemedText>
                {current.prixBarre ? <ThemedText style={styles.old}>{current.prixBarre}</ThemedText> : null}
              </View>
            </View>
            <Pressable onPress={() => void like()} accessibilityRole="button" accessibilityLabel={current.liked ? 'Je n’aime plus' : 'J’aime'} style={styles.like}>
              <Ionicons name={current.liked ? 'heart' : 'heart-outline'} size={28} color={current.liked ? '#EF4444' : '#fff'} />
              <ThemedText style={styles.likeCount}>{current.likesCount}</ThemedText>
            </Pressable>
          </View>
          <View style={styles.ctaRow}>
            <Pressable onPress={go(() => openProduct(current.productId))} accessibilityRole="button" style={[styles.cta, styles.flex]}>
              <Ionicons name="cube-outline" size={18} color="#1F1F1F" />
              <ThemedText style={styles.ctaText}>Voir le produit</ThemedText>
            </Pressable>
            <Pressable onPress={go(() => openShop(bubble.companyId))} accessibilityRole="button" style={[styles.cta, styles.ctaGhost, styles.flex]}>
              <Ionicons name="storefront-outline" size={18} color="#fff" />
              <ThemedText style={[styles.ctaText, { color: '#fff' }]}>Voir la boutique</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  section: { gap: 10, paddingTop: 20 },
  strip: { gap: 10, paddingHorizontal: 16 },
  card: { width: 104, height: 172, borderRadius: 16, overflow: 'hidden', borderWidth: 2, backgroundColor: 'rgba(0,0,0,0.05)' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.45)' },
  logo: { position: 'absolute', top: 8, left: 8, width: 34, height: 34, borderRadius: 17, borderWidth: 2, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  mini: { position: 'absolute', top: 8, right: 8, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  inline: { position: 'relative', top: 0, right: 0 },
  count: { position: 'absolute', top: 8, right: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  miniText: { color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '900' },
  cardName: { position: 'absolute', left: 8, right: 8, bottom: 8, color: '#fff', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  zone: { position: 'absolute', top: 110, bottom: 190 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 10, paddingTop: 6, backgroundColor: 'rgba(0,0,0,0.35)' },
  bars: { flexDirection: 'row', gap: 4, paddingTop: 6 },
  barBg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  shop: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headLogo: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shopName: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  shopSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 12, backgroundColor: 'rgba(0,0,0,0.55)' },
  msg: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  msgText: { color: '#1F1F1F', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  badges: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  prodName: { color: '#fff', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  prices: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  price: { color: '#fff', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  old: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 17, textDecorationLine: 'line-through' },
  like: { alignItems: 'center', gap: 2, minWidth: 44 },
  likeCount: { color: '#fff', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  ctaRow: { flexDirection: 'row', gap: 10 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 999, minHeight: 50, paddingHorizontal: 10 },
  ctaGhost: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  ctaText: { color: '#1F1F1F', fontSize: 15, lineHeight: 20, fontWeight: '800' },
});

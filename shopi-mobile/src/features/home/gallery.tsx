/**
 * Galerie de l'accueil — comme ProduitPlusConsulteGallery du site :
 *   GET /public/produits/plus-consulte   images du produit le plus consulté
 * Grandes cartes verticales arrondies (9:16) qui défilent horizontalement,
 * sans aucun texte ; toucher une image ouvre la fiche du produit.
 * Défilement automatique (une carte toutes les AUTO_DELAI ms, retour au début en
 * fin de rangée), mis en pause un moment dès que l'utilisateur fait défiler à la
 * main, quand l'écran n'est pas affiché, l'app en arrière-plan, ou si l'option
 * « Réduire les animations » du téléphone est active.
 * Tant qu'aucun produit n'a de vues, le serveur renvoie le dernier ajouté ; si
 * le serveur ne connaît pas encore cet endpoint, repli sur le dernier produit
 * avec image de /public/produits. Section masquée s'il n'y a aucune image.
 */
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { z } from 'zod';

import { Spacing } from '@/constants/theme';
import { fetchProducts } from '@/features/catalog/api';
import { thumb } from '@/features/catalog/format';
import { openProduct } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api/client';
import { qk } from '@/lib/query-keys';

const AUTO_DELAI = 3000;
const PAUSE_APRES_INTERACTION = 6000;
const GAP = 10;
const PAD = Spacing.three;

const gallerySchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    images: z
      .array(z.object({ id: z.string(), url: z.string(), alt: z.string().nullable().optional().catch(null) }).passthrough())
      .catch([]),
  })
  .passthrough()
  .nullable();
type Gallery = NonNullable<z.infer<typeof gallerySchema>>;

/** Dernier produit ajouté ayant au moins une image (repli). */
async function lastProduct(): Promise<Gallery | null> {
  const list = await fetchProducts({ limit: 10 });
  for (const p of list) {
    const images = [...p.images]
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .filter((i) => (i.type ?? 'image') === 'image');
    if (images.length) return { id: p.id, nom: p.nom, images: images.map((i, n) => ({ id: `${p.id}-${n}`, url: i.url, alt: null })) };
  }
  return null;
}

export async function fetchHomeGallery(): Promise<Gallery | null> {
  try {
    const top = await apiFetch('/public/produits/plus-consulte', { auth: false, schema: gallerySchema });
    if (top?.images.length) return top;
  } catch {
    /* endpoint absent (serveur pas redéployé) : repli ci-dessous */
  }
  return lastProduct();
}

export function HomeGallery() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(Math.min(300, Math.max(150, width * 0.46)));
  const step = cardWidth + GAP;

  const q = useQuery({ queryKey: qk.homeGallery, queryFn: fetchHomeGallery, staleTime: 300_000 });
  const product = q.data;
  const count = product?.images.length ?? 0;

  const listRef = useRef<FlatList<Gallery['images'][number]>>(null);
  const indexRef = useRef(0);
  const pauseUntil = useRef(0);
  const [focused, setFocused] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  /* Combien de cartes tiennent entièrement à l'écran : au-delà, la rangée est au bout */
  const lastIndex = Math.max(0, count - Math.max(1, Math.floor((width - PAD) / step)));

  useEffect(() => {
    if (count < 2 || !focused || !active || reduceMotion) return;
    const t = setInterval(() => {
      if (Date.now() < pauseUntil.current) return;
      const next = indexRef.current >= lastIndex ? 0 : indexRef.current + 1;
      indexRef.current = next;
      listRef.current?.scrollToOffset({ offset: next * step, animated: true });
    }, AUTO_DELAI);
    return () => clearInterval(t);
  }, [count, focused, active, reduceMotion, lastIndex, step]);

  if (!product || !count) return null;

  const height = Math.round((cardWidth * 16) / 9);

  return (
    <View style={styles.section} accessibilityLabel={product.nom}>
      <FlatList
        ref={listRef}
        horizontal
        data={product.images}
        keyExtractor={(img) => img.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={step}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: step, offset: step * index, index })}
        onScrollBeginDrag={() => {
          pauseUntil.current = Date.now() + PAUSE_APRES_INTERACTION;
        }}
        onMomentumScrollEnd={(e) => {
          indexRef.current = Math.round(e.nativeEvent.contentOffset.x / step);
          pauseUntil.current = Date.now() + PAUSE_APRES_INTERACTION;
        }}
        initialNumToRender={3}
        windowSize={5}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => openProduct(product.id)}
            accessibilityRole="button"
            accessibilityLabel={`${product.nom} — image ${index + 1}`}
            style={({ pressed }) => [
              styles.card,
              { width: cardWidth, height, backgroundColor: theme.backgroundElement, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}>
            <Image
              source={{ uri: thumb(item.url, Math.round(cardWidth * 2)) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 28 },
  list: { paddingHorizontal: PAD, gap: GAP },
  card: { borderRadius: 18, overflow: 'hidden' },
});

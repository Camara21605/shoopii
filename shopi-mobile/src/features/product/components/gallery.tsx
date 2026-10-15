/**
 * Galerie de la fiche produit : photos et vidéos en balayage, miniatures,
 * compteur, badges, ❤ favori, plein écran (visionneuse de la messagerie).
 *
 * Cadrage « studio » : chaque photo est entière (contain, jamais rognée),
 * centrée sur fond blanc avec une marge régulière — une bouteille haute ou un
 * sac large gardent leurs proportions. Les marges propres à chaque photo sont
 * retirées côté Cloudinary (productFrame) pour un rendu homogène.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { productFrame } from '@/features/catalog/format';
import MediaViewer from '@/features/messagerie/MediaViewer';
import { useTheme } from '@/hooks/use-theme';

import type { ProductDetail } from '../api';

/* ── Galerie ────────────────────────────────────────────────────────── */

export function Gallery({
  product,
  width,
  fav,
  onFav,
  badges,
}: {
  product: ProductDetail;
  width: number;
  fav: boolean;
  /** Absent = mon propre produit (pas de ❤). */
  onFav?: () => void;
  badges: { label: string; color: string }[];
}) {
  const theme = useTheme();
  const media = [...product.images].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [list, setList] = useState<FlatList | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };
  const goTo = (i: number) => {
    setIndex(i);
    list?.scrollToOffset({ offset: i * width, animated: true });
  };
  const open = viewer != null ? media[viewer] : null;

  return (
    <View>
      <View style={[styles.stage, { width, height: width }]}>
        {media.length ? (
          <FlatList
            ref={setList}
            data={media}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            onScroll={onScroll}
            scrollEventThrottle={32}
            keyExtractor={(m, i) => m.id ?? String(i)}
            renderItem={({ item, index: i }) => (
              <Pressable onPress={() => setViewer(i)} style={{ width, height: width }} accessibilityRole="imagebutton" accessibilityLabel={`Image ${i + 1} sur ${media.length}, agrandir`}>
                {item.type === 'video' ? (
                  <View style={[styles.fill, styles.videoBox]}>
                    <Ionicons name="play-circle" size={72} color="#fff" />
                    <ThemedText style={styles.videoText}>Lire la vidéo</ThemedText>
                  </View>
                ) : (
                  <View style={[styles.fill, { padding: Math.round(width * 0.07) }]}>
                    <Image
                      source={{ uri: productFrame(item.url, 1000) }}
                      style={styles.fill}
                      contentFit="contain"
                      contentPosition="center"
                      transition={150}
                      accessibilityLabel={`${product.nom}, image ${i + 1}`}
                    />
                  </View>
                )}
              </Pressable>
            )}
          />
        ) : (
          <View style={[styles.fill, styles.center]}>
            <ThemedText style={styles.bigEmoji}>{product.category?.icone || '📦'}</ThemedText>
          </View>
        )}

        <View style={styles.badges} pointerEvents="none">
          {badges.map((b) => (
            <View key={b.label} style={[styles.badge, { backgroundColor: b.color }]}>
              <ThemedText style={styles.badgeText}>{b.label}</ThemedText>
            </View>
          ))}
        </View>
        {onFav ? (
          <Pressable onPress={onFav} style={styles.heart} accessibilityRole="button" accessibilityLabel={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            <Ionicons name={fav ? 'heart' : 'heart-outline'} size={22} color={fav ? Brand.danger : '#1F1F1F'} />
          </Pressable>
        ) : null}
        {media.length > 1 ? (
          <View style={styles.counter} pointerEvents="none">
            <ThemedText style={styles.counterText}>
              {index + 1} / {media.length}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {media.length > 1 ? (
        <FlatList
          data={media}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(m, i) => `t${m.id ?? i}`}
          contentContainerStyle={[styles.thumbs, { minWidth: width }]}
          renderItem={({ item, index: i }) => (
            <Pressable
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={`Voir l’image ${i + 1}`}
              style={[styles.thumb, i === index ? styles.thumbOn : { borderColor: theme.border }]}>
              {item.type === 'video' ? (
                <Ionicons name="videocam" size={22} color={theme.textSecondary} />
              ) : (
                <Image source={{ uri: productFrame(item.url, 200) }} style={styles.fill} contentFit="contain" />
              )}
            </Pressable>
          )}
        />
      ) : null}

      {open ? (
        <MediaViewer
          visible
          onClose={() => setViewer(null)}
          kind={open.type === 'video' ? 'video' : 'image'}
          url={open.url}
          name={`${product.nom}${open.type === 'video' ? '.mp4' : '.jpg'}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  /* Fond blanc : les photos produit sont presque toujours détourées sur blanc, le cadre se fond avec elles */
  stage: { backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EDEDED' },
  videoBox: { backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center', gap: 6 },
  videoText: { color: '#fff', fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center' },
  bigEmoji: { fontSize: 90, lineHeight: 104 },
  badges: { position: 'absolute', top: 12, left: 12, gap: 6, zIndex: 2 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  heart: { position: 'absolute', top: 12, right: 12, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  counterText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  /* Miniatures centrées sous la photo (défilent si elles dépassent la largeur) */
  thumbs: { gap: 10, paddingHorizontal: 16, paddingTop: 12, justifyContent: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 12, borderWidth: 1.5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: 5 },
  thumbOn: { borderColor: Brand.primary, borderWidth: 2 },
});

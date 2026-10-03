/**
 * Stories des produits (comme ProduitsPage du site) :
 *   · StoriesManager  stories actives d'un produit (vues, retirer) + publication EN
 *                     UN TOUCHER de toutes ses images pas encore en story (24 h) ;
 *   · StoriesTray     bandeau du catalogue : « Créer une story » + mes stories actives
 *                     regroupées par produit (vues cumulées, nombre) ;
 *   · StoryViewer     visionneuse plein écran (6 s par story, barres de progression,
 *                     précédente / suivante, « Qui a vu » avec ❤, retirer) ;
 *   · CreateStorySheet choisir un produit (avec image, sans story active) puis publier.
 * Une story expirée disparaît partout (elle a déjà disparu de l'accueil des clients).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import {
  addStory,
  deleteStory,
  expiresIn,
  fetchMyStories,
  fetchProductStories,
  fetchStoryViewers,
  isStoryActive,
  normalize,
  type Product,
  type Story,
} from '../api';

const DURATION = 6000;

/** Heure courante, rafraîchie chaque minute (statut et compte à rebours des stories). */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ── Gestion des stories d'un produit ──────────────────────────────── */

export function StoriesManager({
  product,
  canEdit,
  onMessage,
  onConfirm,
}: {
  product: Product;
  canEdit: boolean;
  onMessage: (text: string, error?: boolean) => void;
  onConfirm: (title: string, message: string, ok: string) => Promise<boolean>;
}) {
  const theme = useTheme();
  const qc = useQueryClient();
  const now = useNow();
  const q = useQuery({ queryKey: qk.company.productStories(product.id), queryFn: () => fetchProductStories(product.id) });
  const active = (q.data ?? []).filter((s) => isStoryActive(s, now));
  const activeUrls = new Set(active.map((s) => s.mediaUrl));
  const pending = product.images.filter((img) => !activeUrls.has(img.url));

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.company.productStories(product.id) });
    void qc.invalidateQueries({ queryKey: qk.company.myStories });
  };

  const publish = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(pending.map((img) => addStory(product.id, img.url)));
      return { ok: results.filter((r) => r.status === 'fulfilled').length, total: results.length };
    },
    onSuccess: ({ ok, total }) => {
      refresh();
      if (ok === total) onMessage(total > 1 ? `${total} stories publiées` : 'Story publiée');
      else if (ok > 0) onMessage(`${ok}/${total} stories publiées`, true);
      else onMessage('Impossible de publier ces stories', true);
    },
  });

  const remove = async (s: Story) => {
    if (!(await onConfirm('Retirer cette story ?', 'Elle disparaîtra tout de suite de l’accueil des clients.', 'Retirer'))) return;
    try {
      await deleteStory(product.id, s.id);
      refresh();
      onMessage('Story retirée');
    } catch {
      onMessage('Impossible de retirer cette story', true);
    }
  };

  if (!product.images.length) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Ajoutez au moins une image au produit pour publier une story.
      </ThemedText>
    );
  }

  return (
    <View style={styles.gap}>
      {q.isPending ? (
        <ActivityIndicator color={Brand.primary} />
      ) : active.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Aucune story publiée pour ce produit.
        </ThemedText>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {active.map((s) => (
            <View key={s.id} style={styles.storyThumb}>
              <Image source={{ uri: thumb(s.mediaUrl, 300) ?? s.mediaUrl }} style={styles.fill} contentFit="cover" />
              <View style={styles.activeBadge}>
                <ThemedText style={styles.activeText}>Active · {expiresIn(s.expiresAt, now)}</ThemedText>
              </View>
              {canEdit ? (
                <Pressable onPress={() => void remove(s)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Retirer cette story" style={styles.trash}>
                  <Ionicons name="trash" size={13} color="#fff" />
                </Pressable>
              ) : null}
              <View style={styles.views}>
                <Ionicons name="eye" size={11} color="#fff" />
                <ThemedText style={styles.viewsText}>{s.viewsCount} vue{s.viewsCount > 1 ? 's' : ''}</ThemedText>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {canEdit && !q.isPending ? (
        <View style={[styles.publishBox, { borderColor: theme.border }]}>
          <ThemedText style={styles.bold}>Publier les images en story</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {pending.length === 0
              ? 'Toutes les images de ce produit sont déjà en story — attendez leur expiration pour republier.'
              : 'Toutes les images du produit sont publiées en story en un toucher (visibles 24 h sur l’accueil).'}
          </ThemedText>
          {pending.length ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {pending.map((img) => (
                  <View key={img.id} style={styles.pendingThumb}>
                    <Image source={{ uri: thumb(img.url, 200) ?? img.url }} style={styles.fill} contentFit="cover" />
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  </View>
                ))}
              </ScrollView>
              <PrimaryButton title={`Publier ${pending.length > 1 ? `les ${pending.length} images` : 'l’image'} en story`} onPress={() => publish.mutate()} loading={publish.isPending} pill />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/* ── Bandeau du catalogue ──────────────────────────────────────────── */

export type StoryGroup = { productId: string; productNom: string; items: Story[] };

export function useMyStoryGroups() {
  const now = useNow();
  const q = useQuery({ queryKey: qk.company.myStories, queryFn: fetchMyStories, refetchInterval: 60_000 });
  const groups = Object.values(
    (q.data ?? [])
      .filter((s) => isStoryActive(s, now) && s.productId)
      .reduce<Record<string, StoryGroup>>((acc, s) => {
        const id = s.productId as string;
        (acc[id] ??= { productId: id, productNom: s.productNom ?? '', items: [] }).items.push(s);
        return acc;
      }, {}),
  );
  return { groups, loading: q.isPending };
}

export function StoriesTray({ groups, canCreate, onCreate, onOpen }: { groups: StoryGroup[]; canCreate: boolean; onCreate: () => void; onOpen: (g: StoryGroup) => void }) {
  const theme = useTheme();
  if (!canCreate && !groups.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray}>
      {canCreate ? (
        <Pressable onPress={onCreate} accessibilityRole="button" accessibilityLabel="Créer une story" style={[styles.tile, styles.createTile, { borderColor: Brand.primaryLine }]}>
          <View style={styles.createIco}>
            <Ionicons name="camera" size={22} color={Brand.primaryInk} />
          </View>
          <View style={styles.plus}>
            <Ionicons name="add" size={16} color="#fff" />
          </View>
          <ThemedText style={styles.createText}>Créer une story</ThemedText>
        </Pressable>
      ) : null}
      {groups.map((g) => {
        const views = g.items.reduce((s, x) => s + x.viewsCount, 0);
        return (
          <Pressable key={g.productId} onPress={() => onOpen(g)} accessibilityRole="button" accessibilityLabel={`Stories de ${g.productNom}, ${views} vues`} style={[styles.tile, { borderColor: Brand.primary, backgroundColor: theme.backgroundElement }]}>
            <Image source={{ uri: thumb(g.items[0].mediaUrl, 300) ?? g.items[0].mediaUrl }} style={styles.fill} contentFit="cover" />
            <View style={styles.tileShade} />
            <View style={styles.activeBadge}>
              <ThemedText style={styles.activeText}>Active</ThemedText>
            </View>
            {g.items.length > 1 ? (
              <View style={styles.nb}>
                <ThemedText style={styles.nbText}>{g.items.length}</ThemedText>
              </View>
            ) : null}
            <View style={styles.tileFoot}>
              <ThemedText style={styles.tileName} numberOfLines={2}>
                {g.productNom}
              </ThemedText>
              <View style={styles.rowSmall}>
                <Ionicons name="eye" size={11} color="#fff" />
                <ThemedText style={styles.viewsText}>{views}</ThemedText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ── Visionneuse plein écran ───────────────────────────────────────── */

export function StoryViewer({
  group,
  canEdit,
  onClose,
  onMessage,
  onConfirm,
}: {
  group: StoryGroup;
  canEdit: boolean;
  onClose: () => void;
  onMessage: (text: string, error?: boolean) => void;
  onConfirm: (title: string, message: string, ok: string) => Promise<boolean>;
}) {
  const qc = useQueryClient();
  const now = useNow();
  const [items, setItems] = useState(group.items);
  const [idx, setIdx] = useState(0);
  const [viewers, setViewers] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const current = items[idx];

  /* Avance automatique : 6 s par story, en pause pendant « Qui a vu » */
  useEffect(() => {
    if (!current) return;
    if (viewers) {
      progress.stopAnimation();
      return;
    }
    let remaining = DURATION;
    progress.stopAnimation((v) => {
      remaining = Math.max(200, DURATION * (1 - v));
    });
    const anim = Animated.timing(progress, { toValue: 1, duration: remaining, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (!finished) return;
      if (idx < items.length - 1) {
        progress.setValue(0);
        setIdx(idx + 1);
      } else onClose();
    });
    return () => anim.stop();
  }, [idx, items.length, viewers, current, progress, onClose]);

  const go = (d: 1 | -1) => {
    const next = idx + d;
    if (next < 0) return;
    if (next >= items.length) return onClose();
    progress.setValue(0);
    setIdx(next);
  };

  const remove = async () => {
    if (!current) return;
    if (!(await onConfirm('Retirer cette story ?', 'Elle disparaîtra tout de suite de l’accueil des clients.', 'Retirer'))) return;
    try {
      await deleteStory(group.productId, current.id);
      void qc.invalidateQueries({ queryKey: qk.company.myStories });
      void qc.invalidateQueries({ queryKey: qk.company.productStories(group.productId) });
      onMessage('Story retirée');
      const next = items.filter((s) => s.id !== current.id);
      if (!next.length) return onClose();
      progress.setValue(0);
      setItems(next);
      setIdx(Math.min(idx, next.length - 1));
    } catch {
      onMessage('Impossible de retirer cette story', true);
    }
  };

  if (!current) return null;
  const W = Dimensions.get('window').width;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        <Image source={{ uri: current.mediaUrl }} style={styles.viewerImg} contentFit="contain" />
        <Pressable style={[styles.zone, { left: 0, width: W * 0.35 }]} onPress={() => go(-1)} accessibilityLabel="Story précédente" />
        <Pressable style={[styles.zone, { right: 0, width: W * 0.65 }]} onPress={() => go(1)} accessibilityLabel="Story suivante" />
        <SafeAreaView edges={['top']} style={styles.viewerTop}>
          <View style={styles.bars}>
            {items.map((s, i) => (
              <View key={s.id} style={styles.barBg}>
                {i < idx ? <View style={[styles.barFill, { width: '100%' }]} /> : null}
                {i === idx ? <Animated.View style={[styles.barFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /> : null}
              </View>
            ))}
          </View>
          <View style={styles.viewerHead}>
            <View style={styles.flex}>
              <ThemedText style={styles.viewerName} numberOfLines={1}>
                {group.productNom}
              </ThemedText>
              <ThemedText style={styles.viewerSub}>
                <Ionicons name="time-outline" size={11} /> Expire dans {expiresIn(current.expiresAt, now)}
              </ThemedText>
            </View>
            <Pressable onPress={() => setViewers(true)} accessibilityRole="button" accessibilityLabel={`Qui a vu : ${current.viewsCount} vues`} style={styles.viewsBtn}>
              <Ionicons name="eye" size={15} color="#fff" />
              <ThemedText style={styles.viewsBtnText}>{current.viewsCount}</ThemedText>
            </Pressable>
            {canEdit ? (
              <Pressable onPress={() => void remove()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retirer cette story" style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={19} color="#fff" />
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer" style={styles.iconBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
      {viewers ? <ViewersSheet storyId={current.id} onClose={() => setViewers(false)} /> : null}
    </Modal>
  );
}

function ViewersSheet({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.company.storyViewers(storyId), queryFn: () => fetchStoryViewers(storyId) });
  return (
    <BottomSheet title="Qui a vu" onClose={onClose} height={0.6}>
      {q.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : q.isError ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          Impossible d’afficher les vues.
        </ThemedText>
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.viewersList}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              Aucune vue pour l’instant.
            </ThemedText>
          }
          renderItem={({ item: v }) => (
            <View style={styles.viewerRow}>
              <View style={[styles.ava, { backgroundColor: Brand.primarySoft }]}>
                {v.avatar ? <Image source={{ uri: v.avatar }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.avaText}>{v.name.trim().charAt(0).toUpperCase() || '?'}</ThemedText>}
              </View>
              <ThemedText style={[styles.flex, styles.bold]} numberOfLines={1}>
                {v.name}
              </ThemedText>
              {v.liked ? <Ionicons name="heart" size={16} color={Brand.danger} accessibilityLabel="A aimé" /> : null}
              <ThemedText type="small" themeColor="textSecondary">
                {v.viewedAt ? new Date(v.viewedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
              </ThemedText>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
        />
      )}
    </BottomSheet>
  );
}

/* ── Créer une story ───────────────────────────────────────────────── */

export function CreateStorySheet({
  products,
  activeProductIds,
  onClose,
  onMessage,
  onConfirm,
}: {
  products: Product[];
  activeProductIds: Set<string>;
  onClose: () => void;
  onMessage: (text: string, error?: boolean) => void;
  onConfirm: (title: string, message: string, ok: string) => Promise<boolean>;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const n = normalize(search.trim());
  const eligible = products.filter((p) => p.images.length > 0 && !activeProductIds.has(p.id)).filter((p) => !n || normalize(p.nom).includes(n));

  return (
    <BottomSheet
      title={selected ? selected.nom : 'Créer une story'}
      onClose={onClose}
      height={0.8}
      left={
        selected ? (
          <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour à la liste">
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
        ) : null
      }>
      {selected ? (
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <StoriesManager product={selected} canEdit onMessage={onMessage} onConfirm={onConfirm} />
        </ScrollView>
      ) : (
        <>
          <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="search" size={17} color={theme.textSecondary} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher un produit" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} accessibilityLabel="Rechercher un produit" />
          </View>
          <FlatList
            data={eligible}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                Aucun produit avec image disponible (les produits déjà en story réapparaissent après leur expiration).
              </ThemedText>
            }
            renderItem={({ item: p }) => (
              <Pressable onPress={() => setSelected(p)} accessibilityRole="button" style={({ pressed }) => [styles.pick, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
                <Image source={{ uri: thumb(p.images[0].url, 160) ?? p.images[0].url }} style={styles.pickImg} contentFit="cover" />
                <View style={styles.flex}>
                  <ThemedText style={styles.bold} numberOfLines={1}>
                    {p.nom}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {p.category?.nom ?? ''} · {p.images.length} image{p.images.length > 1 ? 's' : ''}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  gap: { gap: 12 },
  row: { gap: 8, paddingRight: 4 },
  rowSmall: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', marginTop: 24, paddingHorizontal: 20 },
  sep: { height: StyleSheet.hairlineWidth },
  storyThumb: { width: 104, height: 160, borderRadius: 14, overflow: 'hidden', backgroundColor: '#eee' },
  activeBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#059669', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  activeText: { color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  trash: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(220,38,38,0.9)', alignItems: 'center', justifyContent: 'center' },
  views: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 7, paddingVertical: 4 },
  viewsText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  publishBox: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  pendingThumb: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: Brand.primary },
  check: { position: 'absolute', right: 3, bottom: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  tray: { gap: 10, paddingRight: 8 },
  tile: { width: 96, height: 150, borderRadius: 16, overflow: 'hidden', borderWidth: 2 },
  createTile: { backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center', gap: 8 },
  createIco: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', top: 70, right: 22, width: 22, height: 22, borderRadius: 11, backgroundColor: Brand.primary, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  createText: { color: Brand.primaryInk, fontSize: 12, lineHeight: 15, fontWeight: '800', textAlign: 'center', paddingHorizontal: 6 },
  tileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, backgroundColor: 'rgba(0,0,0,0.45)' },
  nb: { position: 'absolute', top: 6, right: 6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  nbText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  tileFoot: { position: 'absolute', left: 6, right: 6, bottom: 6, gap: 2 },
  tileName: { color: '#fff', fontSize: 11.5, lineHeight: 14, fontWeight: '800' },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  zone: { position: 'absolute', top: 90, bottom: 0 },
  viewerTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 10, paddingTop: 6, backgroundColor: 'rgba(0,0,0,0.35)' },
  bars: { flexDirection: 'row', gap: 4, paddingTop: 6 },
  barBg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
  viewerHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  viewerName: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  viewerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5, lineHeight: 15, fontWeight: '600' },
  viewsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  viewsBtnText: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  viewersList: { paddingHorizontal: 16, paddingBottom: 16 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  ava: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avaText: { color: Brand.primaryInk, fontWeight: '900' },
  sheetBody: { padding: 16, gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, marginHorizontal: 16, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10 },
  pickImg: { width: 52, height: 52, borderRadius: 12 },
});

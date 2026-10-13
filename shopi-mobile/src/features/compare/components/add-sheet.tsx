/**
 * Feuille « Ajouter un produit » — comme AjouterProduitSheet du site : ne propose
 * QUE des produits de la même catégorie que ceux comparés, par défaut de la même
 * sous-catégorie (puce « Toute la catégorie » pour élargir), avec recherche dans
 * ce périmètre. Chaque ligne montre l'écart de prix par rapport à la moyenne des
 * produits comparés, « Même marque », la remise et la rupture de stock.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { formatPrice, thumb } from '@/features/catalog/format';
import type { ProductDetail } from '@/features/product/api';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchComparables, firstImageOf, MAX_COMPARE, metaOf, useCompareStore } from '../api';
import { remisePct } from '../insights';

export function AddProductSheet({
  compares,
  onClose,
}: {
  compares: ProductDetail[];
  onClose: () => void;
}) {
  const theme = useTheme();
  /* Messages affichés DANS la feuille (une fenêtre par-dessus l'écran cacherait ceux de l'écran) */
  const snack = useSnack();
  const onToast = snack.show;
  const items = useCompareStore((s) => s.items);
  const add = useCompareStore((s) => s.add);
  const ids = items.map((i) => i.id);

  const [scope, setScope] = useState<'sub' | 'cat'>('sub');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const q = useQuery({
    queryKey: qk.comparables(ids, scope, search, 24),
    queryFn: () => fetchComparables(ids, scope, search, 24),
    enabled: ids.length > 0,
    /* Les résultats précédents restent affichés pendant qu'on tape (pas de clignotement) */
    placeholderData: keepPreviousData,
  });
  const res = q.data;
  const list = (res?.data ?? []).filter((p) => !ids.includes(p.id));
  const places = MAX_COMPARE - items.length;
  const prixMoy = compares.length ? compares.reduce((s, p) => s + p.prix, 0) / compares.length : 0;
  const marques = new Set(compares.map((p) => (p.marque ?? '').trim().toLowerCase()).filter(Boolean));

  const onAdd = (p: ProductDetail) => {
    const r = add(p.id, metaOf(p));
    if (r.full) return onToast(`Comparaison pleine (${MAX_COMPARE} produits au plus)`, true);
    if (r.mismatch != null) return onToast('Ce produit n’est pas de la même catégorie', true);
    if (r.added) {
      onToast(`« ${p.nom} » ajouté`);
      if (places - 1 <= 0) onClose();
    }
  };

  return (
    <BottomSheet title="Ajouter un produit" onClose={onClose} height={0.86}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>
        Encore {places} place{places > 1 ? 's' : ''}
        {res?.categorie?.nom ? ` · ${res.categorie.nom}` : ''}
      </ThemedText>

      {res?.sousCategorie || scope === 'cat' ? (
        <View style={styles.chips}>
          {res?.sousCategorie ? <Chip icon="layers-outline" label={res.sousCategorie.nom} on={res.scope === 'sub'} onPress={() => setScope('sub')} /> : null}
          <Chip icon="folder-open-outline" label="Toute la catégorie" on={res?.scope === 'cat'} onPress={() => setScope('cat')} />
        </View>
      ) : null}

      <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={`Rechercher dans ${res?.categorie?.nom ?? 'la catégorie'}…`}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Rechercher un produit à comparer"
        />
        {input ? (
          <Pressable onPress={() => setInput('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer">
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {res?.fallback ? (
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Aucun autre produit dans cette sous-catégorie : voici ceux de la même catégorie.
          </ThemedText>
        </View>
      ) : null}

      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          q.isPending ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : q.isError ? (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Impossible de charger les produits. Réessayez dans un instant.
            </ThemedText>
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={30} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                {search ? `Aucun produit comparable pour « ${search} ».` : 'Aucun autre produit comparable pour le moment.'}
              </ThemedText>
              {res?.scope === 'sub' && res.sousCategorie ? (
                <Pressable onPress={() => setScope('cat')} accessibilityRole="button">
                  <ThemedText style={styles.link}>Voir toute la catégorie</ThemedText>
                </Pressable>
              ) : null}
            </View>
          )
        }
        renderItem={({ item: p }) => {
          const img = thumb(firstImageOf(p), 160);
          const ecart = prixMoy > 0 ? Math.round(((p.prix - prixMoy) / prixMoy) * 100) : 0;
          const memeMarque = !!p.marque && marques.has(p.marque.trim().toLowerCase());
          const remise = remisePct(p);
          return (
            <View style={[styles.item, { borderBottomColor: theme.border }]}>
              <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons name="cube-outline" size={22} color={theme.textSecondary} />}
              </View>
              <View style={styles.flex}>
                <ThemedText numberOfLines={2} style={styles.bold}>
                  {p.nom}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {p.companyName}
                  {p.companyVerified ? ' ✓' : ''}
                </ThemedText>
                <View style={styles.priceRow}>
                  <ThemedText style={styles.price}>{formatPrice(p.prix)}</ThemedText>
                  {compares.length && ecart !== 0 ? (
                    <ThemedText style={[styles.ecart, { color: ecart < 0 ? Brand.success : '#B45309' }]}>
                      {ecart < 0 ? '−' : '+'}
                      {Math.abs(ecart)} %
                    </ThemedText>
                  ) : null}
                </View>
                <View style={styles.tags}>
                  {res?.scope === 'cat' && p.subCategory?.nom ? <Tag label={p.subCategory.nom} /> : null}
                  {memeMarque ? <Tag label="Même marque" /> : null}
                  {remise > 0 ? <Tag label={`−${remise} %`} color="#BE123C" /> : null}
                  {p.stock <= 0 ? <Tag label="Rupture de stock" color={Brand.danger} /> : null}
                </View>
              </View>
              <Pressable
                onPress={() => onAdd(p)}
                disabled={places <= 0}
                style={[styles.addBtn, { backgroundColor: Brand.primary, opacity: places <= 0 ? 0.4 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter ${p.nom} à la comparaison`}>
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>
          );
        }}
      />
      <Snack msg={snack.msg} />
    </BottomSheet>
  );
}

function Chip({ icon, label, on, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? Brand.primary : theme.backgroundElement }]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}>
      <Ionicons name={icon} size={14} color={on ? '#fff' : theme.text} />
      <ThemedText numberOfLines={1} style={[styles.chipText, { color: on ? '#fff' : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Tag({ label, color }: { label: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={[styles.tagText, { color: color ?? theme.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  sub: { paddingHorizontal: 16, marginTop: -4, marginBottom: 10 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, maxWidth: '100%' },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700', flexShrink: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, minHeight: 46 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginTop: 10 },
  list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 },
  loader: { marginTop: 30 },
  emptyBox: { alignItems: 'center', gap: 8, paddingTop: 30 },
  empty: { textAlign: 'center', paddingTop: 10 },
  link: { fontWeight: '800', textDecorationLine: 'underline' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  price: { fontWeight: '900' },
  ecart: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

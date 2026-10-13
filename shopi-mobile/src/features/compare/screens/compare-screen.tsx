/**
 * Comparer les produits — même page que /comparer du site, en version téléphone :
 *   · une seule catégorie par comparaison (ligne « Catégorie › Sous-catégorie »),
 *     alerte et bouton « Retirer les intrus » pour les anciennes listes mélangées ;
 *   · « L'avis Shoneya » : meilleur choix + raisons, économie, ruptures (insights.ts) ;
 *   · tableau côte à côte (compare-table.tsx) avec gagnants par ligne et écart de prix ;
 *   · « Seulement les différences » ; « Ajouter un produit » (même catégorie) ;
 *   · suggestions « À comparer aussi » ; panier depuis chaque colonne ;
 *   · les produits supprimés ou dépubliés sont retirés automatiquement.
 * Liste locale au téléphone (store.ts), aucun compte requis — sauf pour le panier.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { requireClient } from '@/features/auth/auth-gate';
import { fetchProduct, type ProductDetail } from '@/features/product/api';
import { addToCart } from '@/features/shop/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { MAX_COMPARE, metaOf, useCompareStore } from '../api';
import { AddProductSheet, CompareSuggestions, CompareTable, EmptyStart, Verdict } from '../components';
import { computeInsights } from '../insights';
import { buildRows, visibleRows } from '../rows';

/** Produit supprimé, dépublié ou boutique suspendue : le serveur ne le sert plus. */
const isGone = (e: unknown) => e instanceof ApiError && [400, 403, 404, 410].includes(e.status);

export default function CompareScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const snack = useSnack();
  const items = useCompareStore((s) => s.items);
  const { add, remove, removeMany, clear, setMeta } = useCompareStore.getState();
  const ids = items.map((i) => i.id);

  const [diffsOnly, setDiffsOnly] = useState(false);
  const [sheet, setSheet] = useState(false);

  /* Même cache que la fiche produit : une fiche déjà vue s'affiche sans attendre */
  const queries = useQueries({
    queries: ids.map((id) => ({ queryKey: qk.product.detail(id), queryFn: () => fetchProduct(id), retry: (n: number, e: unknown) => !isGone(e) && n < 2 })),
  });
  const produits = queries.map((q) => q.data).filter((p): p is ProductDetail => !!p);
  const loading = produits.length === 0 && queries.some((q) => q.isPending);
  const goneIds = ids.filter((_, i) => isGone(queries[i]?.error));
  const goneKey = goneIds.join(',');

  useEffect(() => {
    if (!goneKey) return;
    const gone = goneKey.split(',');
    removeMany(gone);
    snack.show(gone.length > 1 ? `${gone.length} produits ne sont plus disponibles et ont été retirés` : 'Un produit n’est plus disponible et a été retiré', true);
  }, [goneKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Anciennes entrées sans catégorie : on la complète dès que la fiche est chargée */
  useEffect(() => {
    produits.forEach((p) => {
      if (p.category?.id && !items.find((i) => i.id === p.id)?.categoryId) setMeta(p.id, metaOf(p));
    });
  }, [produits.map((p) => p.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const cart = useMutation({
    mutationFn: (id: string) => addToCart(id, 1),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.cart });
      snack.show('Ajouté au panier');
    },
    onError: (e) => snack.show(toUserMessage(e), true),
  });

  const insights = computeInsights(produits);
  const rows = buildRows(produits, insights);
  const shown = visibleRows(rows, diffsOnly);
  const places = Math.max(0, MAX_COMPARE - ids.length);

  const refCat = produits[0]?.category ?? null;
  const subs = new Set(produits.map((p) => p.subCategory?.id).filter(Boolean));
  const refSub = subs.size === 1 ? (produits.find((p) => p.subCategory)?.subCategory ?? null) : null;
  const intrus = refCat ? produits.filter((p) => p.category?.id !== refCat.id) : [];

  const quickAdd = (p: ProductDetail) => {
    const r = add(p.id, metaOf(p));
    if (r.full) snack.show(`Comparaison pleine (${MAX_COMPARE} produits au plus)`, true);
    else if (r.mismatch != null) snack.show('Ce produit n’est pas de la même catégorie', true);
    else if (r.added) snack.show(`« ${p.nom} » ajouté`);
  };

  const clearAll = () =>
    Alert.alert('Tout retirer ?', 'La comparaison sera vidée.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Tout retirer', style: 'destructive', onPress: () => (clear(), snack.show('Comparaison vidée')) },
    ]);

  const headerRight = ids.length ? (
    <Pressable onPress={clearAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="Tout retirer">
      <Ionicons name="trash-outline" size={22} color={theme.text} />
    </Pressable>
  ) : undefined;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Comparer les produits" right={headerRight} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator color={Brand.primary} style={styles.loader} />
        ) : produits.length === 0 ? (
          <EmptyStart />
        ) : (
          <View style={styles.gap}>
            {refCat ? (
              <View style={styles.catLine}>
                <Ionicons name="folder-open-outline" size={15} color={theme.textSecondary} />
                <ThemedText type="small" style={styles.bold} numberOfLines={1}>
                  {refCat.nom}
                  {refSub ? `  ›  ${refSub.nom}` : ''}
                </ThemedText>
              </View>
            ) : null}

            {intrus.length ? (
              <View style={styles.warn}>
                <Ionicons name="warning-outline" size={18} color="#B45309" />
                <View style={styles.flex}>
                  <ThemedText type="small" style={styles.warnText}>
                    Certains produits ne sont pas de la catégorie « {refCat?.nom} » : la comparaison est moins fiable.
                  </ThemedText>
                  <Pressable onPress={() => removeMany(intrus.map((p) => p.id))} hitSlop={6} accessibilityRole="button">
                    <ThemedText style={styles.warnBtn}>{intrus.length > 1 ? `Retirer les ${intrus.length} intrus` : 'Retirer l’intrus'}</ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Verdict produits={produits} insights={insights} />

            {produits.length === 1 ? (
              <View style={[styles.hint, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="bulb-outline" size={17} color={Brand.primary} />
                <ThemedText type="small" style={styles.flex}>
                  Ajoutez au moins un autre produit de la même catégorie pour lancer la comparaison.
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.toolbar}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.bold}>
                {produits.length} produit{produits.length > 1 ? 's' : ''} sur {MAX_COMPARE}
              </ThemedText>
              {produits.length > 1 ? (
                <View style={styles.toggle}>
                  <ThemedText type="small" style={styles.bold}>
                    Seulement les différences
                  </ThemedText>
                  <Switch
                    value={diffsOnly}
                    onValueChange={setDiffsOnly}
                    trackColor={{ true: Brand.success, false: theme.border }}
                    thumbColor="#fff"
                    accessibilityLabel="Seulement les différences"
                  />
                </View>
              ) : null}
            </View>

            <CompareTable
              produits={produits}
              rows={shown}
              bestId={insights.bestId}
              places={places}
              diffsOnly={diffsOnly}
              addingToCart={cart.isPending ? (cart.variables ?? null) : null}
              onRemove={remove}
              onAddToCart={(id) => requireClient(() => cart.mutate(id), 'Ajoutez ce produit à votre panier et commandez en quelques secondes.')}
              onAddProduct={() => setSheet(true)}
              addHint={refSub?.nom ?? refCat?.nom ?? null}
            />

            {diffsOnly && !shown.length ? (
              <ThemedText themeColor="textSecondary" style={styles.noDiff}>
                Ces produits sont identiques sur tous les points comparés.
              </ThemedText>
            ) : null}

            {places > 0 ? <CompareSuggestions ids={ids} onAdd={quickAdd} onMore={() => setSheet(true)} /> : null}
          </View>
        )}
      </ScrollView>

      {sheet ? <AddProductSheet compares={produits} onClose={() => setSheet(false)} /> : null}
      <Snack msg={snack.msg} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  scroll: { paddingTop: 12, paddingBottom: 40 },
  loader: { marginTop: 60 },
  gap: { gap: 14 },
  catLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  warn: { flexDirection: 'row', gap: 10, marginHorizontal: 16, borderRadius: 14, padding: 12, backgroundColor: '#FFF7E6' },
  warnText: { color: '#92400E', lineHeight: 18 },
  warnBtn: { fontWeight: '800', textDecorationLine: 'underline', color: '#92400E', marginTop: 6 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, borderRadius: 14, padding: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, flexWrap: 'wrap' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noDiff: { textAlign: 'center', paddingHorizontal: 24 },
});

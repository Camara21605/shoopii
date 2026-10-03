/**
 * Onglet Catalogue — comme la page /catalogue du site : tous les types de
 * boutiques, leurs catégories, puis les produits de la catégorie choisie.
 * La recherche filtre types et catégories par leur nom.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { CategoryCard, ErrorState, ProductCard, SectionHeader, SectionState, TypeCard, capitalize } from '@/components/catalog';
import { normalize } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchCategories, fetchCompanyTypes, fetchProducts } from '@/features/catalog/api';
import { openProduct } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

const GAP = 10;

export default function CatalogueScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((width - Spacing.three * 2 - GAP * 2) / 3);
  const productWidth = Math.floor((width - Spacing.three * 2 - 12) / 2);
  const [query, setQuery] = useState('');
  const [typeId, setTypeId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const types = useQuery({ queryKey: qk.companyTypes, queryFn: fetchCompanyTypes, staleTime: 600_000 });
  const categories = useQuery({ queryKey: qk.categories, queryFn: fetchCategories, staleTime: 600_000 });
  const products = useQuery({
    queryKey: qk.products.byCategory(categoryId),
    queryFn: () => fetchProducts({ categoryId: categoryId!, limit: 30 }),
    enabled: !!categoryId,
  });

  const q = normalize(query.trim());
  const visibleTypes = useMemo(() => (types.data ?? []).filter((t) => !q || normalize(t.nom).includes(q)), [types.data, q]);
  const visibleCats = useMemo(
    () =>
      (categories.data ?? []).filter(
        (c) => (!typeId || c.companyTypeId === typeId) && (!q || normalize(c.nom).includes(q)),
      ),
    [categories.data, typeId, q],
  );
  const selectedType = types.data?.find((t) => t.id === typeId);
  const selectedCat = categories.data?.find((c) => c.id === categoryId);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AppHeader search={query} onSearch={setQuery} placeholder="Rechercher un type ou une catégorie…" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        {...hideOnScroll}
        refreshControl={
          <RefreshControl
            refreshing={types.isRefetching || categories.isRefetching}
            onRefresh={() => {
              void types.refetch();
              void categories.refetch();
            }}
            colors={[Brand.primary]}
          />
        }>
        <View style={styles.section}>
          <SectionHeader
            title="Types de boutiques"
            action={typeId ? 'Tous les types' : undefined}
            onAction={() => {
              setTypeId(null);
              setCategoryId(null);
            }}
          />
          {types.isPending ? (
            <ActivityIndicator color={Brand.primary} />
          ) : types.error ? (
            <ErrorState error={types.error} onRetry={() => void types.refetch()} />
          ) : (
            <View style={styles.grid}>
              {visibleTypes.map((t) => (
                <View key={t.id} style={{ width: tileWidth }}>
                  <TypeCard
                    type={t}
                    selected={t.id === typeId}
                    onPress={() => {
                      setTypeId((cur) => (cur === t.id ? null : t.id));
                      setCategoryId(null);
                    }}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.section, styles.separated, { borderTopColor: theme.border }]}>
          <SectionHeader title={selectedType ? `Catégories — ${capitalize(selectedType.nom)}` : 'Toutes les catégories'} />
          {categories.isPending ? (
            <ActivityIndicator color={Brand.primary} />
          ) : categories.error ? (
            <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
          ) : visibleCats.length ? (
            <View style={styles.grid}>
              {visibleCats.map((c) => (
                <View key={c.id} style={{ width: tileWidth }}>
                  <CategoryCard category={c} selected={c.id === categoryId} onPress={() => setCategoryId((cur) => (cur === c.id ? null : c.id))} />
                </View>
              ))}
            </View>
          ) : (
            <SectionState>
              <ThemedText themeColor="textSecondary">Aucune catégorie.</ThemedText>
            </SectionState>
          )}
        </View>

        {selectedCat ? (
          <View style={[styles.section, styles.separated, { borderTopColor: theme.border }]}>
            <SectionHeader title={capitalize(selectedCat.nom)} action="Fermer" onAction={() => setCategoryId(null)} />
            {products.isPending ? (
              <ActivityIndicator color={Brand.primary} />
            ) : products.error ? (
              <ErrorState error={products.error} onRetry={() => void products.refetch()} />
            ) : products.data?.length ? (
              <View style={[styles.grid, { gap: 12 }]}>
                {products.data.map((p) => (
                  <ProductCard key={p.id} product={p} width={productWidth} onPress={() => openProduct(p.id)} />
                ))}
              </View>
            ) : (
              <SectionState>
                <ThemedText themeColor="textSecondary">Aucun produit dans cette catégorie pour le moment.</ThemedText>
              </SectionState>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 100 },
  section: { paddingTop: Spacing.four },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.four },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: Spacing.three },
});

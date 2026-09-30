/**
 * Accueil — même organisation que l'accueil mobile du site, en thème clair :
 *   en-tête (AppHeader) · TYPES DE BOUTIQUES · CATÉGORIES · BOUTIQUES
 *   (« S'abonner ») · PRODUITS · VENTE EN GROS
 * Recherche, type et catégorie filtrent réellement les produits
 * (GET /public/produits?search=&companyTypeId=&categoryId=).
 * Fiche produit / boutique : ouverte sur le site en attendant les écrans natifs.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { CategoryCard, ErrorState, ProductCard, SectionHeader, SectionState, ShopCard, TypeCard } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchCategories, fetchCompanyTypes, fetchProducts, fetchShops, type Product } from '@/features/catalog/api';
import { useFollowedShops, useToggleFollow } from '@/features/catalog/follow';
import { openProduct, openShop } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';

const GAP = 12;
const PAD = Spacing.three;

export default function HomeScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - PAD * 2 - GAP) / 2);

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* Recherche lancée 400 ms après la dernière frappe */
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const filtering = !!(search || typeId || categoryId);

  const types = useQuery({ queryKey: ['company-types'], queryFn: fetchCompanyTypes, staleTime: 600_000 });
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 600_000 });
  const products = useQuery({ queryKey: ['products', 'detail'], queryFn: () => fetchProducts({ type: 'detail', limit: 20 }) });
  const wholesale = useQuery({ queryKey: ['products', 'gros'], queryFn: () => fetchProducts({ type: 'gros', limit: 10 }) });
  const shops = useQuery({ queryKey: ['shops', 'home'], queryFn: () => fetchShops(10) });
  const followed = useFollowedShops();
  const follow = useToggleFollow('entreprises');
  const results = useQuery({
    queryKey: ['products', 'search', search, typeId, categoryId],
    queryFn: () => fetchProducts({ search, companyTypeId: typeId ?? undefined, categoryId: categoryId ?? undefined, limit: 30 }),
    enabled: filtering,
  });

  const visibleCategories = useMemo(
    () => (categories.data ?? []).filter((c) => !typeId || c.companyTypeId === typeId),
    [categories.data, typeId],
  );

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }

  const clearFilters = () => {
    setQuery('');
    setSearch('');
    setTypeId(null);
    setCategoryId(null);
  };

  const grid = (list: Product[]) => (
    <View style={styles.grid}>
      {list.map((p) => (
        <ProductCard key={p.id} product={p} width={cardWidth} onPress={() => openProduct(p.id)} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AppHeader search={query} onSearch={setQuery} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[Brand.primary]} />}>
        {(types.data?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Types de boutiques" action="Tout le catalogue" onAction={() => router.push('/catalogue')} />
            <FlatList
              horizontal
              data={types.data}
              keyExtractor={(t) => t.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <TypeCard
                  type={item}
                  selected={item.id === typeId}
                  onPress={() => {
                    setTypeId((cur) => (cur === item.id ? null : item.id));
                    setCategoryId(null);
                  }}
                />
              )}
            />
          </View>
        )}

        {visibleCategories.length > 0 && (
          <View style={[styles.section, styles.separated, { borderTopColor: theme.border }]}>
            <SectionHeader title="Catégories" action="Tout parcourir" onAction={() => router.push('/catalogue')} />
            <FlatList
              horizontal
              data={visibleCategories}
              keyExtractor={(c) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <CategoryCard
                  category={item}
                  selected={item.id === categoryId}
                  onPress={() => setCategoryId((cur) => (cur === item.id ? null : item.id))}
                />
              )}
            />
          </View>
        )}

        {filtering ? (
          <View style={[styles.section, styles.separated, { borderTopColor: theme.border }]}>
            <SectionHeader title="Résultats" action="Tout effacer" onAction={clearFilters} />
            {results.isPending ? (
              <SectionState>
                <ActivityIndicator color={Brand.primary} />
              </SectionState>
            ) : results.error ? (
              <ErrorState error={results.error} onRetry={() => void results.refetch()} />
            ) : results.data?.length ? (
              grid(results.data)
            ) : (
              <SectionState>
                <Ionicons name="search-outline" size={32} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.center}>
                  Aucun produit ne correspond. Essayez un autre mot ou retirez un filtre.
                </ThemedText>
              </SectionState>
            )}
          </View>
        ) : (
          <>
            {(shops.data?.length ?? 0) > 0 && (
              <View style={[styles.section, styles.separated, { borderTopColor: theme.border }]}>
                <SectionHeader title="Boutiques" action="Toutes les boutiques" onAction={() => router.push('/boutiques')} />
                <FlatList
                  horizontal
                  data={shops.data}
                  keyExtractor={(s) => s.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hListCards}
                  renderItem={({ item }) => (
                    <ShopCard
                      shop={item}
                      followed={followed.data?.has(item.id)}
                      following={follow.pending === item.id}
                      onFollow={() => follow.toggle(item.id)}
                      onPress={() => openShop(item.id)}
                    />
                  )}
                />
              </View>
            )}

            <View style={[styles.section, styles.separated, { borderTopColor: theme.border }]}>
              <SectionHeader title="Produits" />
              {products.isPending ? (
                <SectionState>
                  <ActivityIndicator color={Brand.primary} />
                </SectionState>
              ) : products.error ? (
                <ErrorState error={products.error} onRetry={() => void products.refetch()} />
              ) : products.data?.length ? (
                grid(products.data)
              ) : (
                <SectionState>
                  <ThemedText themeColor="textSecondary">Aucun produit pour le moment.</ThemedText>
                </SectionState>
              )}
            </View>

            {(wholesale.data?.length ?? 0) > 0 && (
              <View style={[styles.section, styles.separated, { borderTopColor: theme.border }]}>
                <SectionHeader title="Vente en gros" />
                <FlatList
                  horizontal
                  data={wholesale.data}
                  keyExtractor={(p) => p.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hListCards}
                  renderItem={({ item }) => <ProductCard product={item} width={150} onPress={() => openProduct(item.id)} />}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: Spacing.five },
  section: { paddingTop: Spacing.four },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.four },
  hList: { paddingHorizontal: PAD, gap: 10 },
  hListCards: { paddingHorizontal: PAD, gap: GAP },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAD },
  center: { textAlign: 'center' },
});

/**
 * Accueil — même organisation que l'accueil mobile du site, en thème clair :
 *   en-tête (AppHeader) · STORIES · TYPES DE BOUTIQUES · CATÉGORIES · PROMOTIONS · BOUTIQUES
 *   (« S'abonner ») · LIVREURS · PRODUITS · VENTE EN GROS · POINTS RELAIS
 * Recherche, type et catégorie filtrent réellement les produits
 * (GET /public/produits?search=&companyTypeId=&categoryId=).
 * Cartes produit complètes (❤, 🔖, Ajouter, 🏪 entreprise, ↗ partager : voir
 * components/product-tile.tsx) ; boutiques en cartes compactes sur fond gris léger.
 * Pas de traits de séparation : les sections respirent par l'espacement.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { CategoryCard, ErrorState, SectionHeader, SectionState, ShopCard, TypeCard } from '@/components/catalog';
import { ProductTile } from '@/components/product-tile';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchCategories, fetchCompanyTypes, fetchProducts, fetchShops, type Product } from '@/features/catalog/api';
import { useFollowedShops, useToggleFollow } from '@/features/catalog/follow';
import { openShop } from '@/features/catalog/open';
import { useProductActions } from '@/features/catalog/product-actions';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { HomeActors } from '../actors';
import { HomePromotions } from '../promotions';
import { HomeStories } from '../stories';

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

  const types = useQuery({ queryKey: qk.companyTypes, queryFn: fetchCompanyTypes, staleTime: 600_000 });
  const categories = useQuery({ queryKey: qk.categories, queryFn: fetchCategories, staleTime: 600_000 });
  const products = useQuery({ queryKey: qk.products.list('detail'), queryFn: () => fetchProducts({ type: 'detail', limit: 20 }) });
  const wholesale = useQuery({ queryKey: qk.products.list('gros'), queryFn: () => fetchProducts({ type: 'gros', limit: 10 }) });
  const shops = useQuery({ queryKey: qk.shops.home, queryFn: () => fetchShops(10) });
  const followed = useFollowedShops();
  const follow = useToggleFollow('entreprises');
  const actions = useProductActions();
  const results = useQuery({
    queryKey: qk.products.search(search, typeId, categoryId),
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
    actions.refresh();
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
        <ProductTile key={p.id} product={p} width={cardWidth} actions={actions} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AppHeader search={query} onSearch={setQuery} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        {...hideOnScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[Brand.primary]} />}>
        {!filtering ? <HomeStories /> : null}

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
          <View style={styles.section}>
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
          <View style={styles.section}>
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
            <HomePromotions />

            {(shops.data?.length ?? 0) > 0 && (
              <View style={styles.section}>
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

            <HomeActors kind="livreur" />

            <View style={styles.section}>
              <SectionHeader title="Produits" action="Explorer" onAction={() => router.push('/explorer')} />
              {products.isPending ? (
                <SectionState>
                  <ActivityIndicator color={Brand.primary} />
                </SectionState>
              ) : products.error ? (
                <ErrorState error={products.error} onRetry={() => void products.refetch()} />
              ) : products.data?.length ? (
                <>
                  {grid(products.data)}
                  <Pressable onPress={() => router.push('/explorer')} style={[styles.more, { backgroundColor: theme.backgroundElement }]} accessibilityRole="button">
                    <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                      Voir plus de produits
                    </ThemedText>
                    <Ionicons name="arrow-forward" size={16} color={Brand.primary} />
                  </Pressable>
                </>
              ) : (
                <SectionState>
                  <ThemedText themeColor="textSecondary">Aucun produit pour le moment.</ThemedText>
                </SectionState>
              )}
            </View>

            {(wholesale.data?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Vente en gros" action="Explorer" onAction={() => router.push('/explorer')} />
                <FlatList
                  horizontal
                  data={wholesale.data}
                  keyExtractor={(p) => p.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hListCards}
                  renderItem={({ item }) => <ProductTile product={item} width={164} actions={actions} />}
                />
              </View>
            )}

            <HomeActors kind="relais" />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 100 },
  section: { paddingTop: 28 },
  hList: { paddingHorizontal: PAD, gap: 10 },
  hListCards: { paddingHorizontal: PAD, gap: GAP },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAD },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: PAD, marginTop: 16, borderRadius: 999, minHeight: 46 },
  center: { textAlign: 'center' },
});
